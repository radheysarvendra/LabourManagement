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
const EXPOSE_TEST_OTP = process.env.EXPOSE_TEST_OTP === "true" || process.env.NODE_ENV !== "production";
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);

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

  return await TokenDetails.create({
    userId: user.id,
    phone: user.phone,
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

// ── Old-flow user lookups (kept for backward compat) ─────────────────────────

const findUserByPhone = async (phone) => {
  const labour = await Labour.findOne({ where: { phone } });
  if (labour) return { user: labour, userType: ROLE_TYPES.LABOUR };

  const owner = await Owner.findOne({ where: { phone } });
  if (owner) return { user: owner, userType: ROLE_TYPES.OWNER };

  return { user: null, userType: null };
};

const findUsersByPhone = async (phone) => {
  const [labour, owner] = await Promise.all([
    Labour.findOne({ where: { phone } }),
    Owner.findOne({ where: { phone } }),
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
    const globalUser = await User.findOne({ where: { phone } });
    if (globalUser) {
      try {
        const newOwner = await Owner.create({
          userId: globalUser.id,
          name: labour.name,
          phone,
          workType: "both",
          isActive: true,
          registeredFrom: "owner",
          status: 1,
        });
        users.push({ user: newOwner, userType: ROLE_TYPES.OWNER });
        users.push({ user: newOwner, userType: ROLE_TYPES.CONTRACTOR });
        users.push({ user: newOwner, userType: ROLE_TYPES.CONTRACTOR_CUSTOMER });
      } catch (e) {
        console.warn("Cross-role owner auto-create skipped for phone", phone, ":", e.message);
      }
    }
  }

  return users;
};

const getUserForRole = async (userType, idOrPhone, byPhone = false) => {
  const where = byPhone ? { phone: idOrPhone } : { id: idOrPhone };

  if (userType === ROLE_TYPES.LABOUR) {
    return await Labour.findOne({ where });
  }

  if (OWNER_PROFILE_ROLES.includes(userType)) {
    return await Owner.findOne({ where });
  }

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
      const otpHash = hashOtp(DEFAULT_TEST_OTP);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await AuthOtp.create({ phone, userId: globalUser.id, otpHash, expiresAt });

      const roles = globalUser.userRoles.map((ur) => ur.appRole?.code).filter(Boolean);

      const response = {
        success: true,
        message: "OTP sent successfully",
        isRegistered: true,
        roles,
        requiresRoleSelection: roles.length > 1,
        flow: "new",
      };

      if (EXPOSE_TEST_OTP) response.testOtp = DEFAULT_TEST_OTP;

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
    const otpHash = hashOtp(DEFAULT_TEST_OTP);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await Promise.all(
      users.map((item) =>
        AuthOtp.create({
          phone,
          userId: item.user.id,
          userType: item.userType,
          otpHash,
          expiresAt,
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

    if (EXPOSE_TEST_OTP) response.testOtp = DEFAULT_TEST_OTP;

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
      where: { phone, verifiedAt: null },
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
      const roles = globalUser.userRoles.map((ur) => ur.appRole?.code).filter(Boolean);
      const selectedRole = activeRole || roles[0];

      if (!roles.includes(selectedRole)) {
        return res.status(400).send({
          success: false,
          message: `Role ${selectedRole} not available for this user. Available: ${roles.join(", ")}`,
        });
      }

      await otpRecord.update({ verifiedAt: new Date() });
      const { token } = await generateSession(globalUser.id, selectedRole);

      return res.status(200).send({
        success: true,
        message: "Login successful",
        token,
        userId: globalUser.id,
        activeRole: selectedRole,
        roles,
        user: { id: globalUser.id, name: globalUser.name, phone: globalUser.phone },
        flow: "new",
      });
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
      return res.status(200).send({
        success: true,
        isRegistered: true,
        phone,
        userId: globalUser.id,
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
        isRegistered: false,
        phone,
        message: "User not registered. Registration required.",
      });
    }

    const primary = users[0];

    return res.status(200).send({
      success: true,
      isRegistered: true,
      phone,
      userId: primary.user.id,
      registeredFrom: primary.user.registeredFrom || primary.userType,
      roles: users.map((item) => item.userType),
      flow: "legacy",
      message: "User is already registered",
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

module.exports = {
  login,
  requestOtp,
  verifyOtp,
  verifyToken,
  logout,
  checkPhone,
  generateToken,
  generateSession,
  saveToken,
  switchRole,
};
