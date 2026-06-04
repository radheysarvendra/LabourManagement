const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../../model/index");
const { config } = require("../../config/db.config");

const Labour = db.labour;
const Owner = db.owner;
const TokenDetails = db.mobileTokenMap;
const AuthOtp = db.authOtp;

const TOKEN_SECRET = config.SECRET_KEY;
const DEFAULT_TEST_OTP = process.env.DEFAULT_TEST_OTP || "1234";
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);

const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "").trim();
};

// Generate Token
const generateToken = (user, userType) => {
  return jwt.sign(
    { id: user.id, phone: user.phone, userType },
    TOKEN_SECRET,
    { expiresIn: "7d" }
  );
};

// Save Token
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

const findUserByPhone = async (phone) => {
  const labour = await Labour.findOne({ where: { phone } });
  if (labour) return { user: labour, userType: "labour" };

  const owner = await Owner.findOne({ where: { phone } });
  if (owner) return { user: owner, userType: "owner" };

  return { user: null, userType: null };
};

const findUsersByPhone = async (phone) => {
  const [labour, owner] = await Promise.all([
    Labour.findOne({ where: { phone } }),
    Owner.findOne({ where: { phone } }),
  ]);
  const users = [];

  if (labour) {
    users.push({ user: labour, userType: "labour" });
  }

  if (owner) {
    users.push({ user: owner, userType: "owner" });
  }

  return users;
};

const isProfileRegistered = (user) => Number(user?.status ?? 1) === 1;

const requestOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);

    if (phone.length !== 10) {
      return res.status(400).send({
        success: false,
        message: "10 digit mobile number required",
      });
    }

    const requestedUserType = req.body.userType;
    const users = await findUsersByPhone(phone);
    const selectedUser =
      users.find((item) => item.userType === requestedUserType) ||
      users[0];

    if (!selectedUser) {
      return res.status(404).send({
        success: false,
        message: "User not found. Please register first.",
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
        })
      )
    );

    return res.status(200).send({
      success: true,
      message: "OTP sent successfully",
      userType: selectedUser.userType,
      roles: users.map((item) => item.userType),
      requiresRoleSelection: users.length > 1 && !requestedUserType,
      isRegistered: isProfileRegistered(selectedUser.user),
      testOtp: DEFAULT_TEST_OTP,
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();
    const requestedUserType = req.body.userType;

    if (phone.length !== 10 || !otp) {
      return res.status(400).send({
        success: false,
        message: "phone aur otp required hai",
      });
    }

    const otpWhere = { phone, verified: false };

    if (requestedUserType) {
      otpWhere.userType = requestedUserType;
    }

    const otpRecord = await AuthOtp.findOne({
      where: otpWhere,
      order: [["createdAt", "DESC"]],
    });

    if (!otpRecord) {
      return res.status(404).send({
        success: false,
        message: "OTP not found. Please request OTP again.",
      });
    }

    if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
      return res.status(400).send({
        success: false,
        message: "OTP expired. Please request OTP again.",
      });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(429).send({
        success: false,
        message: "Too many wrong attempts. Please request OTP again.",
      });
    }

    if (!verifyOtpHash(otp, otpRecord.otpHash)) {
      await otpRecord.update({ attempts: otpRecord.attempts + 1 });
      return res.status(400).send({
        success: false,
        message: "Invalid OTP",
      });
    }

    const user =
      otpRecord.userType === "labour"
        ? await Labour.findOne({ where: { id: otpRecord.userId } })
        : await Owner.findOne({ where: { id: otpRecord.userId } });

    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    const token = generateToken(user, otpRecord.userType);
    await saveToken(user, token, otpRecord.userType);
    await otpRecord.update({ verified: true });
    const registeredUsers = await findUsersByPhone(phone);

    return res.status(200).send({
      success: true,
      message: "Login successful",
      token,
      user,
      userType: otpRecord.userType,
      roles: registeredUsers.map((item) => item.userType),
      isRegistered: isProfileRegistered(user),
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { userType } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (req.body.otp) {
      return verifyOtp(req, res);
    }

    if (!phone || !userType) {
      return res.status(400).send({
        success: false,
        message: "phone aur userType required hai",
      });
    }

    const user =
      userType === "labour"
        ? await Labour.findOne({ where: { phone } })
        : await Owner.findOne({ where: { phone } });

    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    const token = generateToken(user, userType);
    await saveToken(user, token, userType);

    return res.status(200).send({
      success: true,
      message: "Login successful",
      token,
      user,
      userType,
      isRegistered: isProfileRegistered(user),
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

// Verify Token
const verifyToken = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.header("Authorization"));

    if (!token) {
      return res.status(401).send({
        success: false,
        message: "Token required",
      });
    }

    const tokenRecord = await TokenDetails.findOne({
      where: { token },
    });

    if (!tokenRecord) {
      return res.status(401).send({
        success: false,
        message: "Invalid token",
      });
    }

    req.user = jwt.verify(token, TOKEN_SECRET);
    req.tokenRecord = tokenRecord;

    next();
  } catch (err) {
    return res.status(401).send({
      success: false,
      message: "Token expired or invalid",
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const token = extractTokenFromHeader(req.header("Authorization"));

    if (!token) {
      return res.status(400).send({
        success: false,
        message: "Token not found",
      });
    }

    await TokenDetails.destroy({
      where: { token },
    });

    return res.status(200).send({
      success: true,
      message: "Logout successful",
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  login,
  requestOtp,
  verifyOtp,
  verifyToken,
  logout,
  generateToken,
  saveToken,
};
