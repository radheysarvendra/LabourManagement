const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../../model/index.js");
const { config } = require("../../config/db.config");

const Admin = db.admin;
const Role = db.role;
const AdminPermission = db.adminPermission;
const Labour = db.labour;
const Owner = db.owner;
const Order = db.order;
const Booking = db.booking;

const TOKEN_SECRET = config.SECRET_KEY;
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, savedHash) => {
  if (!password || !savedHash || !savedHash.includes(":")) return false;

  const [salt, hash] = savedHash.split(":");
  const verifyHash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  const savedBuffer = Buffer.from(hash, "hex");
  const verifyBuffer = Buffer.from(verifyHash, "hex");

  return savedBuffer.length === verifyBuffer.length && crypto.timingSafeEqual(savedBuffer, verifyBuffer);
};

const buildAdminToken = (admin) => jwt.sign({
  adminId: admin.id,
  roleId: admin.roleId,
  email: admin.email,
  userType: "admin",
}, TOKEN_SECRET, { expiresIn: "8h" });

const getAdminResponse = async (adminId) => {
  return await Admin.findOne({
    where: { id: adminId },
    attributes: { exclude: ["passwordHash"] },
    include: [
      { model: Role, as: "role", required: false },
      { model: AdminPermission, as: "permissions", required: false },
    ],
  });
};

const ensureDefaultAdmin = async () => {
  const defaultRoles = [
    { name: "super_admin", description: "Full admin dashboard access", accessLevel: 100 },
    { name: "admin", description: "Admin dashboard access", accessLevel: 90 },
    { name: "sub_admin", description: "Limited admin dashboard access", accessLevel: 70 },
    { name: "field_officer", description: "Field verification and order coordination", accessLevel: 50 },
    { name: "support", description: "Customer support access", accessLevel: 40 },
    { name: "verifier", description: "Labour and owner verification access", accessLevel: 30 },
  ];

  const savedRoles = [];

  for (const item of defaultRoles) {
    const [role] = await Role.findOrCreate({
      where: { name: item.name },
      defaults: item,
    });
    savedRoles.push(role);
  }

  const superAdminRole = savedRoles.find((role) => role.name === "super_admin") || savedRoles[0];
  const defaultEmail = normalizeEmail(process.env.DEFAULT_ADMIN_EMAIL || "admin@dehaadi.com");
  const existingAdmin = await Admin.findOne({ where: { email: defaultEmail } });

  if (!existingAdmin) {
    await Admin.create({
      roleId: superAdminRole.id,
      name: "Super Admin",
      email: defaultEmail,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      status: "active",
    });
  }
};
const loginAdmin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).send({ success: false, message: "email and password required" });
    }

    const admin = await Admin.findOne({ where: { email } });

    if (!admin || !verifyPassword(password, admin.passwordHash)) {
      return res.status(401).send({ success: false, message: "Invalid admin email or password" });
    }

    if (admin.status !== "active") {
      return res.status(403).send({ success: false, message: "Admin account is not active" });
    }

    await admin.update({ lastLoginAt: new Date() });
    const token = buildAdminToken(admin);
    const data = await getAdminResponse(admin.id);

    return res.status(200).send({
      success: true,
      message: "Admin login successful",
      token,
      data,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const createAdmin = async (req, res) => {
  try {
    const { name, roleId, phone, status } = req.body;
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || DEFAULT_ADMIN_PASSWORD;

    if (!name || !email || !roleId) {
      return res.status(400).send({ success: false, message: "name, email and roleId required" });
    }

    const role = await Role.findOne({ where: { id: roleId } });

    if (!role) {
      return res.status(404).send({ success: false, message: "Role not found" });
    }

    const existing = await Admin.findOne({ where: { email } });

    if (existing) {
      return res.status(400).send({ success: false, message: "Admin email already exists" });
    }

    const admin = await Admin.create({
      name,
      email,
      phone,
      roleId,
      status: status || "active",
      passwordHash: hashPassword(password),
      createdById: req.admin?.id || null,
    });

    const data = await getAdminResponse(admin.id);

    return res.status(201).send({
      success: true,
      message: "Admin created successfully",
      data,
      defaultPasswordUsed: !req.body.password,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getAdmins = async (req, res) => {
  try {
    const data = await Admin.findAll({
      attributes: { exclude: ["passwordHash"] },
      include: [{ model: Role, as: "role", required: false }],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).send({ success: true, data });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getAdminProfile = async (req, res) => {
  try {
    const data = await getAdminResponse(req.admin.id);
    return res.status(200).send({ success: true, data });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const createPermission = async (req, res) => {
  try {
    const { roleId, moduleName, canView, canCreate, canUpdate, canDelete, canApprove } = req.body;

    if (!roleId || !moduleName) {
      return res.status(400).send({ success: false, message: "roleId and moduleName required" });
    }

    const [data] = await AdminPermission.upsert({
      roleId,
      moduleName,
      canView: canView !== undefined ? canView : true,
      canCreate: !!canCreate,
      canUpdate: !!canUpdate,
      canDelete: !!canDelete,
      canApprove: !!canApprove,
    }, { returning: true });

    return res.status(201).send({
      success: true,
      message: "Permission saved successfully",
      data,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const [labours, owners, totalOrders, pendingOrders, approvedOrders, bookings] = await Promise.all([
      Labour.count(),
      Owner.count(),
      Order.count(),
      Order.count({ where: { adminStatus: "pending" } }),
      Order.count({ where: { adminStatus: "approved" } }),
      Booking.count(),
    ]);

    return res.status(200).send({
      success: true,
      data: {
        labours,
        owners,
        totalOrders,
        pendingOrders,
        approvedOrders,
        bookings,
      },
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

module.exports = {
  ensureDefaultAdmin,
  loginAdmin,
  createAdmin,
  getAdmins,
  getAdminProfile,
  createPermission,
  getDashboardStats,
};

