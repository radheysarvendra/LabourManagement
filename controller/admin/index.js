const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../../model/index.js");
const { config } = require("../../config/db.config");
const { fn, col, Op } = require("sequelize");

const Admin = db.admin;
const Role = db.role;
const AdminPermission = db.adminPermission;
const Labour = db.labour;
const Owner = db.owner;
const Order = db.order;
const Booking = db.booking;
const {
  ADMIN_ACTIONS,
  ADMIN_MODULES,
  ADMIN_MODULE_DETAILS,
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
  if (process.env.SKIP_DEFAULT_ADMIN_BOOTSTRAP === "true") {
    return;
  }

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
    const { Op } = require("sequelize");
    const pageNumber = Math.max(Number(req.query.page) || 1, 1);
    const pageLimit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = (pageNumber - 1) * pageLimit;
    const where = {};
    const { search, status, roleId } = req.query;
    if (search) {
      const q = `%${String(search).trim()}%`;
      where[Op.or] = [
        { name:  { [Op.iLike]: q } },
        { email: { [Op.iLike]: q } },
        { phone: { [Op.iLike]: q } },
      ];
    }
    if (status)  where.status = status;
    if (roleId)  where.roleId = Number(roleId);
    const result = await Admin.findAndCountAll({
      where,
      attributes: { exclude: ["passwordHash"] },
      include: [{ model: Role, as: "role", required: false }],
      order: [["createdAt", "DESC"]],
      distinct: true,
      offset,
      limit: pageLimit,
    });

    return res.status(200).send({
      success: true,
      page: pageNumber,
      limit: pageLimit,
      data: {
        rows: result.rows,
        total: result.count,
        totalPages: Math.ceil(result.count / pageLimit) || 1,
      },
    });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getAdminProfile = async (req, res) => {
  try {
    const admin = await getAdminResponse(req.admin.id);
    const json = admin.toJSON ? admin.toJSON() : admin;
    const permissions = (json.permissions || []).map((permission) => ({
      module: permission.moduleName,
      canView: permission.canView,
      canCreate: permission.canCreate,
      canEdit: permission.canUpdate,
      canUpdate: permission.canUpdate,
      canDelete: permission.canDelete,
      canApprove: permission.canApprove,
    }));
    const data = {
      id: json.id,
      name: json.name,
      email: json.email,
      role: json.role,
      permissions,
    };
    return res.status(200).send({ success: true, data });
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const admin = await getAdminResponse(req.admin.id);
    const json = admin.toJSON ? admin.toJSON() : admin;
    return res.status(200).json({
      success: true,
      data: {
        id: json.id,
        name: json.name,
        email: json.email,
        role: json.role?.name || null,
        avatar: null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getMePermissions = async (req, res) => {
  try {
    const admin = await getAdminResponse(req.admin.id);
    const json = admin.toJSON ? admin.toJSON() : admin;
    const roleName = String(json.role?.name || "").toLowerCase();
    const isFullAccess = roleName === "super_admin" || roleName === "admin";
    const permissionMap = new Map(
      (json.permissions || []).map((permission) => [String(permission.moduleName).toLowerCase(), permission])
    );

    const data = ADMIN_MODULE_DETAILS.map((moduleInfo) => {
      const permission = permissionMap.get(moduleInfo.key.toLowerCase());
      return {
        module: moduleInfo.key,
        view: isFullAccess || !!permission?.canView,
        create: isFullAccess || !!permission?.canCreate,
        edit: isFullAccess || !!permission?.canUpdate,
        delete: isFullAccess || !!permission?.canDelete,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
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
      order: [["name", "ASC"]],
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

const getOverviewStats = async (req, res) => {
  try {
    const LabourProfile = db.labourProfile;
    const ContractorProfile = db.contractorProfile;
    const WorkAssignment = db.workAssignment;
    const Skill = db.skill;
    const Category = db.category;

    const [
      ownersTotal,
      ownersActive,
      laboursTotal,
      laboursVerified,
      laboursAvailable,
      newContractorsTotal,
      newContractorsActive,
      oldContractorsTotal,
      oldContractorsActive,
      ordersTotal,
      ordersPending,
      ordersApproved,
      ordersCompleted,
      bookingsTotal,
      bookingsPending,
      bookingsConfirmed,
      bookingsCancelled,
      workAssignmentsTotal,
      workAssignmentsActive,
      workAssignmentsCompleted,
      skillsTotal,
      skillsActive,
      categoriesTotal,
      adminsTotal,
      adminsActive,
      rolesTotal,
    ] = await Promise.all([
      Owner.count(),
      Owner.count({
        include: [{ model: db.user, as: "user", required: true, where: { isActive: true } }],
      }).catch(() => Owner.count()),
      Labour.count(),
      Labour.count({ where: { isVerified: true } }).catch(() => LabourProfile.count({ where: { verificationStatus: "verified" } })),
      Labour.count({ where: { isAvailable: true } }),
      ContractorProfile.count(),
      ContractorProfile.count({ where: { isAvailable: true } }),
      Owner.count({ where: { registeredFrom: "contractor" } }),
      Owner.count({
        where: { registeredFrom: "contractor" },
        include: [{ model: db.user, as: "user", required: true, where: { isActive: true } }],
      }).catch(() => Owner.count({ where: { registeredFrom: "contractor" } })),
      Order.count(),
      Order.count({ where: { adminStatus: "pending" } }),
      Order.count({ where: { adminStatus: "approved" } }),
      Order.count({ where: { status: "completed" } }),
      Booking.count(),
      Booking.count({ where: { status: "pending" } }),
      Booking.count({ where: { status: "confirmed" } }),
      Booking.count({ where: { status: "cancelled" } }),
      WorkAssignment.count(),
      WorkAssignment.count({ where: { status: "active" } }),
      WorkAssignment.count({ where: { status: "completed" } }),
      Skill.count(),
      Skill.count({ where: { isActive: true } }),
      Category.count({ where: { isActive: true } }),
      Admin.count(),
      Admin.count({ where: { status: "active" } }),
      Role.count(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        owners: {
          total: ownersTotal,
          active: ownersActive,
          inactive: Math.max(ownersTotal - ownersActive, 0),
        },
        labours: {
          total: laboursTotal,
          verified: laboursVerified,
          available: laboursAvailable,
        },
        contractors: {
          total: newContractorsTotal + oldContractorsTotal,
          active: newContractorsActive + oldContractorsActive,
        },
        orders: {
          total: ordersTotal,
          pending: ordersPending,
          approved: ordersApproved,
          completed: ordersCompleted,
        },
        bookings: {
          total: bookingsTotal,
          pending: bookingsPending,
          confirmed: bookingsConfirmed,
          cancelled: bookingsCancelled,
        },
        workAssignments: {
          total: workAssignmentsTotal,
          active: workAssignmentsActive,
          completed: workAssignmentsCompleted,
        },
        skills: {
          total: skillsTotal,
          active: skillsActive,
          categories: categoriesTotal,
        },
        admins: {
          total: adminsTotal,
          active: adminsActive,
        },
        roles: {
          total: rolesTotal,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getDashboardSummary = async (_req, res) => {
  try {
    const [totalLabourers, totalOwners, newContractors, oldContractors, totalOrders, pendingOrders, approvedOrders, totalBookings] = await Promise.all([
      Labour.count(),
      Owner.count({ where: { registeredFrom: { [Op.ne]: "contractor" } } }).catch(() => Owner.count()),
      db.contractorProfile.count(),
      Owner.count({ where: { registeredFrom: "contractor" } }),
      Order.count(),
      Order.count({ where: { adminStatus: "pending" } }),
      Order.count({ where: { adminStatus: "approved" } }),
      Booking.count(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalLabourers,
        totalOwners,
        totalContractors: newContractors + oldContractors,
        totalOrders,
        pendingOrders,
        approvedOrders,
        totalBookings,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getStaffStrength = async (req, res) => {
  try {
    const { state, city, groupBy } = req.query;
    const where = {};

    if (state) {
      where.state = { [Op.iLike]: `%${String(state).trim()}%` };
    }

    if (String(groupBy || "").toLowerCase() === "state") {
      const rows = await db.user.findAll({
        where,
        attributes: [
          "stateId",
          "state",
          [fn("COUNT", col("user.id")), "count"],
        ],
        group: ["stateId", "state"],
        order: [["state", "ASC"]],
        raw: true,
      });

      const stateIds = [...new Set(rows.map((row) => row.stateId).filter(Boolean))];
      const states = stateIds.length
        ? await db.state.findAll({ where: { id: stateIds }, attributes: ["id", "stateName"], raw: true })
        : [];
      const stateNameById = new Map(states.map((item) => [Number(item.id), item.stateName]));

      const data = rows
        .map((row) => ({
          stateId: row.stateId || null,
          state: row.state || stateNameById.get(Number(row.stateId)) || "Unknown",
          count: Number(row.count || 0),
        }))
        .filter((row) => row.count > 0);

      return res.status(200).json({ success: true, data });
    }

    const rows = await db.user.findAll({
      where,
      attributes: [
        "state",
        "district",
        "city",
        "village",
        [fn("COUNT", col("id")), "count"],
      ],
      group: ["state", "district", "city", "village"],
      order: [["state", "ASC"]],
      raw: true,
    });

    const normalizedRows = rows
      .map((row) => {
        const derivedCity = row.city || row.district || row.village || "";
        return {
          state: row.state || "",
          city: derivedCity,
          count: Number(row.count || 0),
        };
      })
      .filter((row) => {
        if (!city) return true;
        return row.city.toLowerCase().includes(String(city).trim().toLowerCase());
      });

    return res.status(200).json({
      success: true,
      data: { rows: normalizedRows },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getStateWiseStaff = async (req, res) => {
  req.query.groupBy = "state";

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (!payload?.success || !Array.isArray(payload.data)) {
      return originalJson(payload);
    }

    return originalJson({
      success: true,
      data: payload.data.map((row) => ({
        stateId: row.stateId,
        state: row.state,
        staffCount: row.count,
      })),
    });
  };

  return getStaffStrength(req, res);
};

const getRecentActivity = async (req, res) => {
  try {
    const moduleName = String(req.query.module || "all").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const activities = [];

    const shouldInclude = (name) => moduleName === "all" || moduleName === name;
    const pushActivity = (item) => activities.push(item);

    if (shouldInclude("orders")) {
      const rows = await Order.findAll({
        attributes: ["id", "orderCode", "adminStatus", "status", "updatedAt", "createdAt"],
        order: [["updatedAt", "DESC"]],
        limit,
        raw: true,
      });
      rows.forEach((row) => pushActivity({
        id: `order-${row.id}`,
        module: "orders",
        action: row.adminStatus === "approved" ? "Order approved" : "Order updated",
        message: `Order #${row.orderCode || row.id} is ${row.adminStatus || row.status}`,
        createdAt: row.updatedAt || row.createdAt,
      }));
    }

    if (shouldInclude("bookings")) {
      const rows = await Booking.findAll({
        attributes: ["id", "bookingCode", "status", "updatedAt", "createdAt"],
        order: [["updatedAt", "DESC"]],
        limit,
        raw: true,
      });
      rows.forEach((row) => pushActivity({
        id: `booking-${row.id}`,
        module: "bookings",
        action: "Booking updated",
        message: `Booking #${row.bookingCode || row.id} is ${row.status}`,
        createdAt: row.updatedAt || row.createdAt,
      }));
    }

    if (shouldInclude("work_assignments") || shouldInclude("work-assignments")) {
      const rows = await db.workAssignment.findAll({
        attributes: ["id", "assignmentCode", "status", "updatedAt", "createdAt"],
        order: [["updatedAt", "DESC"]],
        limit,
        raw: true,
      });
      rows.forEach((row) => pushActivity({
        id: `work-assignment-${row.id}`,
        module: "work_assignments",
        action: "Work assignment updated",
        message: `Assignment #${row.assignmentCode || row.id} is ${row.status}`,
        createdAt: row.updatedAt || row.createdAt,
      }));
    }

    if (shouldInclude("admins")) {
      const rows = await Admin.findAll({
        attributes: ["id", "name", "status", "updatedAt", "createdAt"],
        order: [["updatedAt", "DESC"]],
        limit,
        raw: true,
      });
      rows.forEach((row) => pushActivity({
        id: `admin-${row.id}`,
        module: "admins",
        action: "Admin updated",
        message: `${row.name || "Admin"} is ${row.status}`,
        createdAt: row.updatedAt || row.createdAt,
      }));
    }

    const data = activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getRoleModules = async (_req, res) => {
  try {
    return res.status(200).json({ success: true, data: ADMIN_MODULE_DETAILS });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getGlobalSearch = async (req, res) => {
  try {
    const q = String(req.query.q || req.query.search || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);

    if (!q) {
      return res.status(400).json({ success: false, message: "Search query is required" });
    }

    const like = `%${q}%`;
    const [labours, owners, orders, bookings, assignments] = await Promise.all([
      Labour.findAll({
        include: [{ model: db.user, as: "user", required: true, attributes: ["id", "name", "phone"], where: {
          [Op.or]: [{ name: { [Op.iLike]: like } }, { phone: { [Op.iLike]: like } }],
        } }],
        limit,
        order: [["createdAt", "DESC"]],
      }),
      Owner.findAll({
        include: [{ model: db.user, as: "user", required: true, attributes: ["id", "name", "phone"], where: {
          [Op.or]: [{ name: { [Op.iLike]: like } }, { phone: { [Op.iLike]: like } }],
        } }],
        limit,
        order: [["createdAt", "DESC"]],
      }),
      Order.findAll({
        where: {
          [Op.or]: [
            { orderCode: { [Op.iLike]: like } },
            { ownerName: { [Op.iLike]: like } },
            { ownerPhone: { [Op.iLike]: like } },
            { skill: { [Op.iLike]: like } },
          ],
        },
        attributes: ["id", "orderCode", "ownerName", "ownerPhone", "skill", "status", "adminStatus", "createdAt"],
        limit,
        order: [["createdAt", "DESC"]],
      }),
      Booking.findAll({
        where: {
          [Op.or]: [
            { bookingCode: { [Op.iLike]: like } },
            { ownerName: { [Op.iLike]: like } },
            { ownerPhone: { [Op.iLike]: like } },
            { skill: { [Op.iLike]: like } },
          ],
        },
        attributes: ["id", "bookingCode", "ownerName", "ownerPhone", "skill", "status", "createdAt"],
        limit,
        order: [["createdAt", "DESC"]],
      }),
      db.workAssignment.findAll({
        where: { assignmentCode: { [Op.iLike]: like } },
        attributes: ["id", "assignmentCode", "status", "fromDate", "toDate", "createdAt"],
        limit,
        order: [["createdAt", "DESC"]],
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        labours: labours.map((item) => {
          const json = item.toJSON ? item.toJSON() : item;
          return { id: json.id, userId: json.userId, name: json.user?.name || null, phone: json.user?.phone || null, labourCode: json.labourCode };
        }),
        owners: owners.map((item) => {
          const json = item.toJSON ? item.toJSON() : item;
          return { id: json.id, userId: json.userId, name: json.user?.name || null, phone: json.user?.phone || null, workType: json.workType };
        }),
        orders,
        bookings,
        assignments,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getNotifications = async (_req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const LabourProfile = db.labourProfile;
    const [pendingOrders, pendingLabourVerifications, failedWorkPayments, failedOrderPayments, newBookings, newOrders] = await Promise.all([
      Order.count({ where: { adminStatus: "pending" } }),
      LabourProfile.count({ where: { verificationStatus: "pending" } }).catch(() => Labour.count({ where: { isVerified: false } })),
      db.workPayment.count({ where: { paymentStatus: { [Op.in]: ["failed", "cancelled"] } } }).catch(() => 0),
      db.orderPayment.count({ where: { status: { [Op.in]: ["failed", "cancelled"] } } }).catch(() => 0),
      Booking.count({ where: { createdAt: { [Op.gte]: since } } }),
      Order.count({ where: { createdAt: { [Op.gte]: since } } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        pendingOrders,
        pendingLabourVerifications,
        failedPayments: failedWorkPayments + failedOrderPayments,
        newBookings,
        newOrders,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getOrderStrength = async (req, res) => {
  try {
    const { fromDate, toDate, state } = req.query;
    const where = {};

    if (state) {
      where.state = { [Op.iLike]: `%${String(state).trim()}%` };
    }
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt[Op.gte] = new Date(fromDate);
      if (toDate) where.createdAt[Op.lte] = new Date(toDate);
    }

    const rows = await Order.findAll({
      where,
      attributes: [
        "state",
        [fn("COUNT", col("id")), "count"],
      ],
      group: ["state"],
      order: [["state", "ASC"]],
      raw: true,
    });

    const normalizedRows = rows
      .map((row) => ({
        state: String(row.state || "").trim(),
        count: Number(row.count || 0),
      }))
      .filter((row) => row.state);

    return res.status(200).json({
      success: true,
      data: { rows: normalizedRows },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
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
      page,
      limit,
      data: {
        rows: result.rows,
        total: result.count,
        totalPages: Math.ceil(result.count / limit) || 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getRolePermissions = async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);
    if (!roleId) {
      return res.status(400).json({ success: false, message: "Role ID is required" });
    }

    const role = await Role.findOne({ where: { id: roleId } });
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    const permissions = await AdminPermission.findAll({
      where: { roleId },
      order: [["moduleName", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: {
        roleId,
        permissions: permissions.map((permission) => ({
          module: permission.moduleName,
          canView: permission.canView,
          canEdit: permission.canUpdate,
          canCreate: permission.canCreate,
          canDelete: permission.canDelete,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const updateRolePermissions = async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];

    if (!roleId) {
      return res.status(400).json({ success: false, message: "Role ID is required" });
    }

    const role = await Role.findOne({ where: { id: roleId } });
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    if (permissions.length === 0) {
      return res.status(400).json({ success: false, message: "Permissions array is required" });
    }

    const normalizedRows = permissions
      .map((permission) => ({
        roleId,
        moduleName: String(permission.module || permission.moduleName || "").trim(),
        canView: !!permission.canView,
        canCreate: !!permission.canCreate,
        canUpdate: !!(permission.canUpdate ?? permission.canEdit),
        canDelete: !!permission.canDelete,
        canApprove: !!permission.canApprove,
      }))
      .filter((permission) => permission.moduleName);

    if (normalizedRows.length === 0) {
      return res.status(400).json({ success: false, message: "At least one valid permission is required" });
    }

    const seenModules = new Set();
    for (const permission of normalizedRows) {
      if (seenModules.has(permission.moduleName)) {
        return res.status(400).json({ success: false, message: `Duplicate module permission: ${permission.moduleName}` });
      }
      seenModules.add(permission.moduleName);
    }

    await db.sequelize.transaction(async (transaction) => {
      await AdminPermission.destroy({ where: { roleId }, transaction });

      await AdminPermission.bulkCreate(normalizedRows, { transaction });
    });

    return res.status(200).json({
      success: true,
      message: "Permissions updated successfully",
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
  getMe,
  getMePermissions,
  createPermission,
  getPermissionMatrix,
  getDashboardStats,
  getOverviewStats,
  getDashboardSummary,
  getStaffStrength,
  getStateWiseStaff,
  getOrderStrength,
  getRecentActivity,
  getRoleModules,
  getGlobalSearch,
  getNotifications,
  getRolePermissions,
  updateRolePermissions,
  getAllUsers,
};
