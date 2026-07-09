const jwt = require("jsonwebtoken");
const db = require("../../model/index");
const { config } = require("../../config/db.config");

const Admin = db.admin;
const Role = db.role;
const AdminPermission = db.adminPermission;
const TOKEN_SECRET = config.SECRET_KEY;
const VALID_PERMISSION_ACTIONS = [
  "canView",
  "canCreate",
  "canUpdate",
  "canDelete",
  "canApprove",
  "view",
  "create",
  "edit",
  "delete",
];

const PERMISSION_ACTION_ALIASES = {
  view: "canView",
  create: "canCreate",
  edit: "canUpdate",
  delete: "canDelete",
};

const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) return null;
  return authHeader.replace("Bearer ", "").trim();
};

const verifyAdminToken = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.header("Authorization"));

    if (!token) {
      return res.status(401).send({ success: false, message: "Admin authentication required" });
    }

    const decoded = jwt.verify(token, TOKEN_SECRET);

    if (decoded.userType !== "admin") {
      return res.status(403).send({ success: false, message: "Admin access required" });
    }

    const admin = await Admin.findOne({
      where: { id: decoded.adminId, status: "active" },
      attributes: { exclude: ["passwordHash"] },
      include: [
        { model: Role, as: "role", required: false },
        { model: AdminPermission, as: "permissions", required: false },
      ],
    });

    if (!admin) {
      return res.status(401).send({ success: false, message: "Admin account not found or inactive" });
    }

    req.admin = admin;
    req.adminToken = decoded;
    next();
  } catch (err) {
    return res.status(401).send({ success: false, message: "Admin session expired. Log in again." });
  }
};

const allowAdminModule = (moduleName, action = "canView") => async (req, res, next) => {
  try {
    const normalizedAction = PERMISSION_ACTION_ALIASES[action] || action;

    if (!VALID_PERMISSION_ACTIONS.includes(normalizedAction)) {
      return res.status(500).send({
        success: false,
        message: `Invalid permission action ${action}`,
      });
    }

    const roleName = String(req.admin?.role?.name || "").toLowerCase();

    if (roleName === "super_admin" || roleName === "admin") {
      return next();
    }

    const permission = (req.admin?.permissions || []).find(
      (item) => String(item.moduleName).toLowerCase() === String(moduleName).toLowerCase()
    );

    if (!permission || !permission[normalizedAction]) {
      return res.status(403).send({
        success: false,
        message: `No permission for ${moduleName}`,
      });
    }

    next();
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

module.exports = {
  verifyAdminToken,
  allowAdminModule,
};
