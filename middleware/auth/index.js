const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const db = require("../../model/index");
const { config } = require("../../config/db.config");

const Labour = db.labour;
const Owner = db.owner;
const User = db.user;
const TokenDetails = db.mobileTokenMap;
const AuthOtp = db.authOtp;

const TOKEN_SECRET = config.SECRET_KEY;
const DEFAULT_TEST_OTP = process.env.DEFAULT_TEST_OTP || "1234";
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || "";
// Show OTP in response only when not using real SMS (no key = test mode)
const EXPOSE_TEST_OTP = process.env.EXPOSE_TEST_OTP === "true" || !FAST2SMS_API_KEY;
const DEFAULT_PASSWORD = process.env.DEFAULT_LOGIN_PASSWORD || "1234";
const ALLOW_LEGACY_DEFAULT_PASSWORD = process.env.ALLOW_LEGACY_DEFAULT_PASSWORD === "true";

const generateOtp = () => {
  // Only generate random OTP when SMS is actually configured — otherwise use test OTP
  if (FAST2SMS_API_KEY) return String(Math.floor(100000 + Math.random() * 900000));
  return DEFAULT_TEST_OTP;
};

const sendSmsOtp = async (phone, otp) => {
  if (!FAST2SMS_API_KEY) return;
  try {
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${FAST2SMS_API_KEY}&variables_values=${otp}&route=otp&numbers=${phone}`;
    const https = require("https");
    await new Promise((resolve) => {
      https.get(url, (res) => { res.resume(); res.on("end", resolve); }).on("error", resolve);
    });
  } catch (e) {
    console.warn("SMS send failed (non-fatal):", e.message);
  }
};

// ── Legacy role constants (old flow) ──────────────────────────────────────────
const ROLE_TYPES = {
  LABOUR: "labour",
  OWNER: "owner",
  CONTRACTOR: "contractor",
  CONTRACTOR_CUSTOMER: "contractor_customer",
};
const OWNER_LIKE_ROLES = [ROLE_TYPES.OWNER, ROLE_TYPES.CONTRACTOR_CUSTOMER];
const CONTRACTOR_LIKE_ROLES = [ROLE_TYPES.CONTRACTOR];
const OWNER_PROFILE_ROLES = [
  ROLE_TYPES.OWNER,
  ROLE_TYPES.CONTRACTOR,
  ROLE_TYPES.CONTRACTOR_CUSTOMER,
];
const ROLE_PRIORITY = [
  ROLE_TYPES.LABOUR,
  ROLE_TYPES.OWNER,
  ROLE_TYPES.CONTRACTOR,
  ROLE_TYPES.CONTRACTOR_CUSTOMER,
];

const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "").trim();
};

// ── Legacy token generation (old mobile_token_maps flow) ─────────────────────
const generateToken = (user, userType) => {
  const type = userType;
  const profileId = user.id;
  const roleId = `${type}:${profileId || user.id || user.phone}`;

  return jwt.sign(
    {
      id: user.id,
      userId: user.userId || user.id,
      roleId,
      profileId,
      phone: user.phone,
      type,
      userType: type,
      labourId: type === ROLE_TYPES.LABOUR ? user.id : null,
      ownerId: OWNER_LIKE_ROLES.includes(type) ? user.id : null,
      contractorId: CONTRACTOR_LIKE_ROLES.includes(type) ? user.id : null,
    },
    TOKEN_SECRET,
    { expiresIn: "7d" }
  );
};

const saveToken = async (user, token, userType) => {
  await TokenDetails.destroy({
    where: { userId: user.id, userType },
  });

  // phone is now canonical on users table; look it up via userId when not on profile
  let phone = user.phone;
  if (!phone && user.userId) {
    const globalUser = await User.findByPk(user.userId, { attributes: ["phone"] });
    phone = globalUser?.phone || null;
  }

  return await TokenDetails.create({
    userId: user.id,
    phone,
    token,
    userType,
    type: "Primary",
    companyCode: user.companyCode || null,
    expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
};

// ── New session-based flow ────────────────────────────────────────────────────

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex").slice(0, 64);

const generateSession = async (userId, roleCode) => {
  const appRole = await db.appRole.findOne({ where: { code: roleCode, isActive: true } });
  if (!appRole) throw new Error(`Unknown role code: ${roleCode}`);
  const [user, userRole] = await Promise.all([
    User.findOne({ where: { id: userId, accountStatus: "active" } }),
    db.userRole.findOne({ where: { userId, roleId: appRole.id, profileStatus: "complete" } }),
  ]);
  if (!user) throw new Error("User account is not active");
  if (!userRole) throw new Error(`Role ${roleCode} is unavailable or incomplete`);

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const token = jwt.sign(
    { sessionId, userId, activeRole: roleCode },
    TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  const tokenHash = hashToken(token);

  await db.session.create({
    id: sessionId,
    userId,
    activeRoleId: appRole.id,
    tokenHash,
    expiresAt,
  });

  return { token, sessionId };
};

// ── Utilities ────────────────────────────────────────────────────────────────

const normalizePhone = (phone) => String(phone || "").replace(/[^0-9]/g, "").trim();

const hashOtp = (otp) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(otp), salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, savedHash) => {
  if (!savedHash) return false;
  if (!savedHash.includes(":")) return false;
  const [salt, hash] = savedHash.split(":");
  const verifyHash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  const savedBuffer = Buffer.from(hash, "hex");
  const verifyBuffer = Buffer.from(verifyHash, "hex");
  return (
    savedBuffer.length === verifyBuffer.length &&
    crypto.timingSafeEqual(savedBuffer, verifyBuffer)
  );
};

const verifyOtpHash = (otp, savedHash) => {
  if (!otp || !savedHash || !savedHash.includes(":")) return false;

  const [salt, hash] = savedHash.split(":");
  const verifyHash = crypto.scryptSync(String(otp), salt, 64).toString("hex");
  const savedBuffer = Buffer.from(hash, "hex");
  const verifyBuffer = Buffer.from(verifyHash, "hex");

  return (
    savedBuffer.length === verifyBuffer.length &&
    crypto.timingSafeEqual(savedBuffer, verifyBuffer)
  );
};

const normalizeRoleCode = (role) => String(role || "").trim().toUpperCase();

const buildStandardAuthResponse = ({
  token,
  user,
  roles = [],
  activeRole,
  userType,
  labourId = null,
  ownerId = null,
  contractorId = null,
  message = "Login successful",
}) => ({
  success: true,
  message,
  token,
  userId: user?.id || null,
  globalUserId: user?.id || null,
  isRegistered: true,
  roles,
  permissions: [],
  userType,
  type: userType,
  activeRole,
  labourId,
  ownerId,
  contractorId,
  profile: {
    id: user?.id || null,
    phone: user?.phone || null,
    name: user?.name || "",
    email: user?.email || "",
  },
  user: {
    id: user?.id || null,
    phone: user?.phone || null,
    name: user?.name || "",
    email: user?.email || "",
  },
});

// ── Old-flow user lookups (kept for backward compat) ─────────────────────────

const findUserByPhone = async (phone) => {
  const globalUser = await User.findOne({ where: { phone } });
  if (!globalUser) return { user: null, userType: null };

  const labour = await Labour.findOne({ where: { userId: globalUser.id } });
  if (labour) return { user: labour, userType: ROLE_TYPES.LABOUR };

  const owner = await Owner.findOne({ where: { userId: globalUser.id } });
  if (owner) return { user: owner, userType: ROLE_TYPES.OWNER };

  return { user: null, userType: null };
};

const findUsersByPhone = async (phone) => {
  const globalUser = await User.findOne({ where: { phone } });
  if (!globalUser) return [];

  const [labour, owner] = await Promise.all([
    Labour.findOne({ where: { userId: globalUser.id } }),
    Owner.findOne({ where: { userId: globalUser.id } }),
  ]);
  const users = [];

  if (labour) {
    users.push({ user: labour, userType: ROLE_TYPES.LABOUR });
  }

  if (owner) {
    users.push({ user: owner, userType: ROLE_TYPES.OWNER });
    users.push({ user: owner, userType: ROLE_TYPES.CONTRACTOR });
    users.push({ user: owner, userType: ROLE_TYPES.CONTRACTOR_CUSTOMER });
  }

  if (!owner && labour) {
    try {
      const newOwner = await Owner.create({
        userId: globalUser.id,
        workType: "both",
        registeredFrom: "owner",
      });
      users.push({ user: newOwner, userType: ROLE_TYPES.OWNER });
      users.push({ user: newOwner, userType: ROLE_TYPES.CONTRACTOR });
      users.push({ user: newOwner, userType: ROLE_TYPES.CONTRACTOR_CUSTOMER });
    } catch (e) {
      console.warn("Cross-role owner auto-create skipped for phone", phone, ":", e.message);
    }
  }

  return users;
};

const getUserForRole = async (userType, idOrPhone, byPhone = false) => {
  if (byPhone) {
    const globalUser = await User.findOne({ where: { phone: idOrPhone } });
    if (!globalUser) return null;
    if (userType === ROLE_TYPES.LABOUR) return await Labour.findOne({ where: { userId: globalUser.id } });
    if (OWNER_PROFILE_ROLES.includes(userType)) return await Owner.findOne({ where: { userId: globalUser.id } });
    return null;
  }

  const where = { id: idOrPhone };
  if (userType === ROLE_TYPES.LABOUR) return await Labour.findOne({ where });
  if (OWNER_PROFILE_ROLES.includes(userType)) return await Owner.findOne({ where });
  return null;
};

const sortUsersByRolePriority = (users) =>
  [...users].sort(
    (a, b) =>
      ROLE_PRIORITY.indexOf(a.userType) - ROLE_PRIORITY.indexOf(b.userType)
  );

const buildAuthResponse = ({ token, user, userType, roles, message = "Login successful" }) => ({
  success: true,
  message,
  token,
  user,
  profile: user,
  type: userType,
  userType,
  roleId: `${userType}:${user?.id || user?.phone}`,
  profileId: user?.id || null,
  userId: user?.id || null,
  labourId: userType === ROLE_TYPES.LABOUR ? user?.id || null : null,
  ownerId: OWNER_LIKE_ROLES.includes(userType) ? user?.id || null : null,
  contractorId: CONTRACTOR_LIKE_ROLES.includes(userType) ? user?.id || null : null,
  roles,
  registeredFrom: user?.registeredFrom || userType,
  isRegistered: isProfileRegistered(user),
});

const isProfileRegistered = (user) => Number(user?.status ?? 1) === 1;

// ── OTP Request ───────────────────────────────────────────────────────────────
// New flow: no userType required — phone only. Role is selected at verifyOtp.
// Old flow: userType still accepted for backward compat.

const requestOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);

    if (phone.length !== 10) {
      return res.status(400).send({ success: false, message: "Enter a 10-digit mobile number" });
    }

    // New-flow check: does this phone have a users row with userRoles?
    const globalUser = await User.findOne({
      where: { phone },
      include: [{ model: db.userRole, as: "userRoles", required: false,
        include: [{ model: db.appRole, as: "appRole" }] }],
    });

    if (globalUser && globalUser.userRoles && globalUser.userRoles.length > 0) {
      // New flow — send a single OTP (not per-role)
      await AuthOtp.destroy({ where: { phone } });
      const otp = generateOtp();
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await AuthOtp.create({ phone, userId: globalUser.id, otpHash, expiresAt, purpose: "login" });
      await sendSmsOtp(phone, otp);

      const roles = globalUser.userRoles.map((ur) => ur.appRole?.code).filter(Boolean);

      const response = {
        success: true,
        message: "OTP sent successfully",
        isRegistered: true,
        roles,
        requiresRoleSelection: roles.length > 1,
        flow: "new",
      };

      if (EXPOSE_TEST_OTP) response.testOtp = otp;

      return res.status(200).send(response);
    }

    // Old flow fallback
    const requestedUserType = req.body.userType;
    const users = sortUsersByRolePriority(await findUsersByPhone(phone));
    const selectedUser =
      users.find((item) => item.userType === requestedUserType) || users[0];

    if (!selectedUser) {
      return res.status(200).send({
        success: true,
        isRegistered: false,
        phone,
        message: "User not registered. Please register first.",
      });
    }

    await AuthOtp.destroy({ where: { phone } });
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await Promise.all(
      users.map((item) =>
        AuthOtp.create({
          phone,
          userId: item.user.id,
          userType: item.userType,
          otpHash,
          expiresAt,
          purpose: "login",
        }).catch(() => {})
      )
    );

    const response = {
      success: true,
      message: "OTP sent successfully",
      userType: selectedUser.userType,
      type: selectedUser.userType,
      roles: users.map((item) => item.userType),
      requiresRoleSelection: users.length > 1 && !requestedUserType,
      isRegistered: isProfileRegistered(selectedUser.user),
      flow: "legacy",
    };

    await sendSmsOtp(phone, otp);
    if (EXPOSE_TEST_OTP) response.testOtp = otp;

    return res.status(200).send(response);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

// ── OTP Verification ──────────────────────────────────────────────────────────

const verifyOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();
    // For new flow: activeRole = "LABOUR" | "OWNER" | "CONTRACTOR"
    const activeRole = req.body.activeRole;
    const requestedUserType = req.body.userType;

    if (phone.length !== 10 || !otp) {
      return res.status(400).send({ success: false, message: "Phone number and OTP are required" });
    }

    // Find the most recent unverified OTP for this phone
    const otpRecord = await AuthOtp.findOne({
      where: { phone, verifiedAt: null, purpose: "login" },
      order: [["createdAt", "DESC"]],
    });

    if (!otpRecord) {
      return res.status(404).send({ success: false, message: "OTP not found. Request a new OTP." });
    }

    if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
      return res.status(400).send({ success: false, message: "OTP expired. Request a new OTP." });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(429).send({ success: false, message: "Too many attempts. Request a new OTP." });
    }

    if (!verifyOtpHash(otp, otpRecord.otpHash)) {
      await otpRecord.update({ attempts: otpRecord.attempts + 1 });
      return res.status(400).send({ success: false, message: "Invalid OTP" });
    }

    // New flow: user has a globalUser + userRoles, and activeRole is provided
    const globalUser = await User.findOne({
      where: { phone },
      include: [{ model: db.userRole, as: "userRoles", required: false,
        include: [{ model: db.appRole, as: "appRole" }] }],
    });

    if (globalUser && globalUser.userRoles && globalUser.userRoles.length > 0) {
      const roles = globalUser.userRoles.map((ur) => normalizeRoleCode(ur.appRole?.code)).filter(Boolean);
      const selectedRole = activeRole || roles[0];

      if (!roles.includes(selectedRole)) {
        return res.status(400).send({
          success: false,
          message: `Role ${selectedRole} not available for this user. Available: ${roles.join(", ")}`,
        });
      }

      await otpRecord.update({ verifiedAt: new Date() });
      const { token } = await generateSession(globalUser.id, selectedRole);

      // Resolve legacy profile IDs so the app can use ownerId/labourId/contractorId
      const roleCode = normalizeRoleCode(selectedRole);
      let labourId = null, ownerId = null, contractorId = null;
      if (roleCode === "LABOUR") {
        const lp = await Labour.findOne({ where: { userId: globalUser.id }, attributes: ["id"] });
        labourId = lp?.id || null;
      } else {
        const op = await Owner.findOne({ where: { userId: globalUser.id }, attributes: ["id"] });
        ownerId = op?.id || null;
        if (roleCode === "CONTRACTOR") contractorId = ownerId;
      }
      const userType = roleCode === "LABOUR" ? "labour" : roleCode === "CONTRACTOR" ? "contractor" : "owner";
      return res.status(200).send(buildStandardAuthResponse({
        token,
        user: globalUser,
        roles,
        activeRole: roleCode,
        userType,
        labourId,
        ownerId,
        contractorId,
      }));
    }

    // Old flow fallback — userType column no longer exists in authOtps; look up by phone
    const effectiveUserType = requestedUserType || ROLE_TYPES.LABOUR;
    const user = await getUserForRole(effectiveUserType, phone, true);

    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    await otpRecord.update({ verifiedAt: new Date() });
    const token = generateToken(user, effectiveUserType);
    await saveToken(user, token, effectiveUserType);

    const registeredUsers = sortUsersByRolePriority(await findUsersByPhone(phone));

    return res.status(200).send(buildAuthResponse({
      token,
      user,
      userType: effectiveUserType,
      roles: registeredUsers.map((item) => item.userType),
      flow: "legacy",
    }));
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

// ── Role Switch ───────────────────────────────────────────────────────────────

const switchRole = async (req, res) => {
  try {
    const { activeRole } = req.body;
    if (!activeRole) {
      return res.status(400).send({ success: false, message: "activeRole is required" });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).send({ success: false, message: "Authentication required" });
    }

    const appRole = await db.appRole.findOne({ where: { code: activeRole, isActive: true } });
    if (!appRole) {
      return res.status(400).send({ success: false, message: `Invalid role: ${activeRole}` });
    }

    const userRole = await db.userRole.findOne({
      where: { userId, roleId: appRole.id, profileStatus: "complete" },
    });
    if (!userRole) {
      return res.status(403).send({
        success: false,
        message: `You do not have the ${activeRole} role`,
      });
    }

    // Revoke current session (new-flow only)
    if (req.session) {
      await req.session.update({ revokedAt: new Date() });
    }

    const { token } = await generateSession(userId, activeRole);

    return res.status(200).send({
      success: true,
      message: `Switched to ${activeRole}`,
      token,
      activeRole,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const login = async (req, res) => {
  if (!req.body.otp) {
    return res.status(400).send({ success: false, message: "Request an OTP before logging in" });
  }
  return verifyOtp(req, res);
};

// ── Token Verification ────────────────────────────────────────────────────────
// Checks sessions table first (new flow), falls back to mobile_token_maps (old flow).

const verifyToken = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.header("Authorization"));

    if (!token) {
      return res.status(401).send({ success: false, message: "Token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, TOKEN_SECRET);
    } catch (e) {
      return res.status(401).send({ success: false, message: "Session expired. Please log in again." });
    }

    // New flow: session-based JWT has sessionId field
    if (decoded.sessionId) {
      const tokenHash = hashToken(token);
      const session = await db.session.findOne({
        where: { tokenHash, revokedAt: null },
      });

      if (!session || session.expiresAt < new Date()) {
        return res.status(401).send({ success: false, message: "Session expired or revoked." });
      }

      req.user = decoded;
      req.session = session;
      return next();
    }

    // Old flow: check mobile_token_maps
    const tokenRecord = await TokenDetails.findOne({ where: { token } });

    if (!tokenRecord) {
      return res.status(401).send({ success: false, message: "Invalid token" });
    }

    req.user = decoded;
    req.tokenRecord = tokenRecord;
    next();
  } catch (err) {
    return res.status(401).send({ success: false, message: "Session expired. Please log in again." });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

const logout = async (req, res) => {
  try {
    const token = extractTokenFromHeader(req.header("Authorization"));

    if (!token) {
      return res.status(400).send({ success: false, message: "Token not found" });
    }

    // New flow: revoke session
    if (req.session) {
      await req.session.update({ revokedAt: new Date() });
    } else {
      // Old flow: destroy token record
      await TokenDetails.destroy({ where: { token } });
    }

    return res.status(200).send({ success: true, message: "Logout successful" });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

// ── Check Phone ───────────────────────────────────────────────────────────────

const checkPhone = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);

    if (phone.length !== 10) {
      return res.status(400).send({ success: false, message: "Enter a 10-digit mobile number" });
    }

    // New flow check
    const globalUser = await User.findOne({
      where: { phone },
      include: [{ model: db.userRole, as: "userRoles", required: false,
        include: [{ model: db.appRole, as: "appRole" }] }],
    });

    if (globalUser && globalUser.userRoles && globalUser.userRoles.length > 0) {
      const roles = globalUser.userRoles.map((ur) => ur.appRole?.code).filter(Boolean);
      const primaryRole = roles[0] || null;
      const userType = primaryRole ? primaryRole.toLowerCase() : null;
      return res.status(200).send({
        success: true,
        exists: true,
        isRegistered: true,
        phone,
        userId: globalUser.id,
        userType,
        roles,
        flow: "new",
        message: "User is already registered",
      });
    }

    // Old flow fallback
    const users = sortUsersByRolePriority(await findUsersByPhone(phone));

    if (users.length === 0) {
      return res.status(200).send({
        success: true,
        exists: false,
        isRegistered: false,
        phone,
        userType: null,
        message: "User not registered. Registration required.",
      });
    }

    const primary = users[0];

    return res.status(200).send({
      success: true,
      exists: true,
      isRegistered: true,
      phone,
      userId: primary.user.id,
      userType: primary.userType,
      registeredFrom: primary.user.registeredFrom || primary.userType,
      roles: users.map((item) => item.userType),
      flow: "legacy",
      message: "User is already registered",
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const loginPassword = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || "");
    const activeRole = normalizeRoleCode(req.body.activeRole || req.body.userType || req.body.role);

    if (phone.length !== 10 || !password) {
      return res.status(400).send({ success: false, message: "Phone and password are required" });
    }

    const globalUser = await User.findOne({
      where: { phone },
      include: [{ model: db.userRole, as: "userRoles", required: false,
        include: [{ model: db.appRole, as: "appRole" }] }],
    });

    if (!globalUser) {
      return res.status(404).send({ success: false, message: "User not found." });
    }

    if (!verifyPassword(password, globalUser.passwordHash)) {
      if (!(ALLOW_LEGACY_DEFAULT_PASSWORD && password === DEFAULT_PASSWORD)) {
        return res.status(401).send({ success: false, message: "Invalid password." });
      }
    }

    const roles = (globalUser.userRoles || []).map((ur) => normalizeRoleCode(ur.appRole?.code)).filter(Boolean);
    const selectedRole = activeRole || (roles.length === 1 ? roles[0] : null);

    if (!selectedRole) {
      return res.status(400).send({
        success: false,
        message: `Select one active role. Available roles: ${roles.join(", ")}`,
      });
    }

    const { token } = await generateSession(globalUser.id, selectedRole);
    const roleCode = normalizeRoleCode(selectedRole);
    let labourId = null;
    let ownerId = null;
    let contractorId = null;

    if (roleCode === "LABOUR") {
      const lp = await Labour.findOne({ where: { userId: globalUser.id }, attributes: ["id"] });
      labourId = lp?.id || null;
    } else {
      const op = await Owner.findOne({ where: { userId: globalUser.id }, attributes: ["id"] });
      ownerId = op?.id || null;
      if (roleCode === "CONTRACTOR") contractorId = ownerId;
    }

    return res.status(200).send(buildStandardAuthResponse({
      token,
      user: globalUser,
      roles,
      activeRole: roleCode,
      userType: roleCode === "LABOUR" ? "labour" : roleCode === "CONTRACTOR" ? "contractor" : "owner",
      labourId,
      ownerId,
      contractorId,
    }));
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (phone.length !== 10) {
      return res.status(400).send({ success: false, message: "Enter a 10-digit mobile number" });
    }
    const user = await User.findOne({ where: { phone } });
    if (!user) return res.status(404).send({ success: false, message: "User not found." });

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await AuthOtp.destroy({ where: { phone } });
    await AuthOtp.create({ phone, userId: user.id, otpHash, expiresAt, purpose: "password_reset" });

    const response = { success: true, message: "Password reset OTP sent successfully" };
    if (EXPOSE_TEST_OTP) response.testOtp = otp;
    return res.status(200).send(response);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const verifyPasswordResetOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();
    if (phone.length !== 10 || !otp) {
      return res.status(400).send({ success: false, message: "Phone number and OTP are required" });
    }
    const otpRecord = await AuthOtp.findOne({
      where: { phone, verifiedAt: null, purpose: "password_reset" },
      order: [["createdAt", "DESC"]],
    });
    if (!otpRecord) return res.status(404).send({ success: false, message: "OTP not found. Request a new OTP." });
    if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
      return res.status(400).send({ success: false, message: "OTP expired. Request a new OTP." });
    }
    if (!verifyOtpHash(otp, otpRecord.otpHash)) {
      return res.status(400).send({ success: false, message: "Invalid OTP" });
    }
    await otpRecord.update({ verifiedAt: new Date() });
    const resetToken = jwt.sign({ phone, purpose: "password-reset" }, TOKEN_SECRET, { expiresIn: "15m" });
    return res.status(200).send({ success: true, resetToken });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const resetToken = String(req.body.resetToken || "");
    const newPassword = String(req.body.newPassword || "");
    if (!resetToken || !newPassword) {
      return res.status(400).send({ success: false, message: "resetToken and newPassword are required" });
    }
    const decoded = jwt.verify(resetToken, TOKEN_SECRET);
    if (decoded.purpose !== "password-reset") {
      return res.status(401).send({ success: false, message: "Invalid reset token" });
    }
    const user = await User.findOne({ where: { phone: decoded.phone } });
    if (!user) return res.status(404).send({ success: false, message: "User not found." });
    await user.update({ passwordHash: hashPassword(newPassword) });
    return res.status(200).send({ success: true, message: "Password updated successfully." });
  } catch (err) {
    return res.status(401).send({ success: false, message: "Invalid or expired reset token" });
  }
};

module.exports = {
  login,
  loginPassword,
  requestOtp,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
  verifyOtp,
  verifyToken,
  logout,
  checkPhone,
  generateToken,
  generateSession,
  saveToken,
  switchRole,
};
