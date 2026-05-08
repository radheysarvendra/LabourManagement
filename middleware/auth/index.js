const jwt = require("jsonwebtoken");
const db = require("../../model/index");
const { config } = require("../../config/db.config");

const Labour = db.labour;
const Owner = db.owner;
const TokenDetails = db.mobileTokenMap;

const TOKEN_SECRET = config.SECRET_KEY;

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

// Login
const login = async (req, res) => {
  try {
    const { phone, userType } = req.body;

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
  verifyToken,
  logout,
  generateToken,
  saveToken,
};