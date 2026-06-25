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
const {
  Op,
} = require("sequelize");
const {
  ADMIN_ACTIONS,
  ADMIN_MODULES,
  DEFAULT_ADMIN_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  getDefaultPermissionsForRole,
} = require("../../constants/adminPermissions");

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
  if (!DEFAULT_ADMIN_PASSWORD) {
    throw new Error("DEFAULT_ADMIN_PASSWORD env var required for default admin setup");
  }

  const savedRoles = [];

  for (const item of DEFAULT_ADMIN_ROLES) {
    const [role] = await Role.findOrCreate({
      where: { name: item.name },
      defaults: item,
    });
    savedRoles.push(role);

  }

  const permissionRows = savedRoles.flatMap((role) => {
    const permissions = getDefaultPermissionsForRole(role.name);

    return Object.entries(permissions).map(([moduleName, access]) => ({
      roleId: role.id,
      moduleName,
      canView: !!access.canView,
      canCreate: !!access.canCreate,
      canUpdate: !!access.canUpdate,
      canDelete: !!access.canDelete,
      canApprove: !!access.canApprove,
    }));
  });

  const existingPermissions = await AdminPermission.findAll({
    where: {
      [Op.or]: permissionRows.map((permission) => ({
        roleId: permission.roleId,
        moduleName: permission.moduleName,
      })),
    },
    attributes: ["roleId", "moduleName"],
  });
  const existingKeys = new Set(
    existingPermissions.map((permission) => `${permission.roleId}:${permission.moduleName}`)
  );
  const missingPermissions = permissionRows.filter(
    (permission) => !existingKeys.has(`${permission.roleId}:${permission.moduleName}`)
  );

  if (missingPermissions.length > 0) {
    await AdminPermission.bulkCreate(missingPermissions);
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
    return;
  }

  const shouldResetDefaultAdmin =
    process.env.RESET_DEFAULT_ADMIN_PASSWORD === "true" ||
    !verifyPassword(DEFAULT_ADMIN_PASSWORD, existingAdmin.passwordHash);

  if (shouldResetDefaultAdmin) {
    await existingAdmin.update({
      roleId: existingAdmin.roleId || superAdminRole.id,
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
      return res.status(400).send({ success: false, message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ where: { email } });

    if (!admin || !verifyPassword(password, admin.passwordHash)) {
      return res.status(401).send({ success: false, message: "Invalid email or password" });
    }

    if (admin.status !== "active") {
      return res.status(403).send({ success: false, message: "Admin account is inactive" });
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
      return res.status(400).send({ success: false, message: "Name, email, and role are required" });
    }

    const role = await Role.findOne({ where: { id: roleId } });

    if (!role) {
      return res.status(404).send({ success: false, message: "Role not found" });
    }

    const existing = await Admin.findOne({ where: { email } });

    if (existing) {
      return res.status(400).send({ success: false, message: "An admin with this email already exists" });
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
      message: "Admin account created successfully",
      data,
      defaultPasswordUsed: !req.body.password,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getAdmins = async (req, res) => {
  try {
    const pageNumber = Math.max(Number(req.query.page) || 1, 1);
    const pageLimit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (pageNumber - 1) * pageLimit;
    const result = await Admin.findAndCountAll({
      attributes: { exclude: ["passwordHash"] },
      include: [{ model: Role, as: "role", required: false }],
      order: [["createdAt", "DESC"]],
      distinct: true,
      offset,
      limit: pageLimit,
    });

    return res.status(200).send({
      success: true,
      total: result.count,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(result.count / pageLimit),
      data: result.rows,
    });
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
      return res.status(400).send({ success: false, message: "Role and module are required" });
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
      message: "Permission updated successfully",
      data,
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getPermissionMatrix = async (req, res) => {
  try {
    const roles = await Role.findAll({
      include: [{ model: AdminPermission, as: "adminPermissions", required: false }],
      order: [["accessLevel", "DESC"], ["name", "ASC"]],
    });

    return res.status(200).send({
      success: true,
      data: {
        modules: Object.values(ADMIN_MODULES),
        actions: Object.values(ADMIN_ACTIONS),
        defaultRoles: DEFAULT_ADMIN_ROLES,
        defaultPermissions: DEFAULT_ROLE_PERMISSIONS,
        roles,
      },
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const LabourProfile = db.labourProfile;
    const [
      labours, owners, totalOrders, pendingOrders, approvedOrders, bookings,
      verifiedLabours, pendingVerifications, rejectedVerifications,
    ] = await Promise.all([
      Labour.count(),
      Owner.count(),
      Order.count(),
      Order.count({ where: { adminStatus: "pending" } }),
      Order.count({ where: { adminStatus: "approved" } }),
      Booking.count(),
      Labour.count({ where: { isVerified: true } }),
      LabourProfile.count({ where: { verificationStatus: "pending" } }),
      LabourProfile.count({ where: { verificationStatus: "rejected" } }),
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
        verifiedLabours,
        pendingVerifications,
        rejectedVerifications,
      },
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const page      = Math.max(Number(req.query.page)  || 1, 1);
    const limit     = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset    = (page - 1) * limit;
    const search    = String(req.query.search || "").trim();
    const status    = req.query.status || null;

    const where = {};
    if (status) where.accountStatus = status;
    if (search) {
      where[Op.or] = [
        { name:  { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const User = db.user;
    const result = await User.findAndCountAll({
      where,
      attributes: { exclude: ["deletedAt"] },
      include: [
        { model: db.labour, as: "labourProfile", required: false, attributes: ["id", "registeredFrom"] },
        { model: db.owner,  as: "ownerProfile",  required: false, attributes: ["id", "registeredFrom", "workType"] },
      ],
      distinct: true,
      order: [["id", "DESC"]],
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      total: result.count,
      page,
      limit,
      totalPages: Math.ceil(result.count / limit),
      data: result.rows,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  ensureDefaultAdmin,
  loginAdmin,
  createAdmin,
  getAdmins,
  getAdminProfile,
  createPermission,
  getPermissionMatrix,
  getDashboardStats,
  getAllUsers,
};

