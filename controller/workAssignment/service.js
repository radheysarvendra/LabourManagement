const { Op } = require("sequelize");
const db = require("../../model/index.js");

const WorkAssignment = db.workAssignment;
const WorkAssignmentLabour = db.workAssignmentLabour;
const WorkAttendance = db.workAttendance;
const WorkPayment = db.workPayment;
const Order = db.order;
const OrderMapping = db.orderMapping;
const Labour = db.labour;
const Owner = db.owner;
const Admin = db.admin;
const Skill = db.skill;

const OrderAssignment = db.orderAssignment;

const assignmentInclude = [
  {
    model: Order,
    as: "order",
    required: false,
    include: [
      {
        model: OrderAssignment,
        as: "orderAssignments",
        required: false,
        separate: true,
        limit: 1,
        order: [["createdAt", "DESC"]],
        include: [{ model: Admin, as: "assignedByAdmin", required: false, attributes: ["id", "name", "email"] }],
      },
    ],
  },
  { model: Owner, as: "owner", required: false, include: [{ model: db.user, as: "user", attributes: ["name", "phone"] }] },
  { model: Admin, as: "middleman", required: false, attributes: { exclude: ["passwordHash"] } },
  {
    model: WorkAssignmentLabour,
    as: "assignmentLabours",
    required: false,
    include: [
      { model: Labour, as: "labour", required: false, include: [{ model: db.user, as: "user", attributes: ["id", "name", "phone"] }] },
      { model: Skill, as: "skillDetail", required: false },
    ],
  },
  { model: WorkAttendance, as: "attendances", required: false },
  { model: WorkPayment, as: "payments", required: false },
];

// Labour platform fee tiers (charged per day, deducted from gross)
// Up to ₹800 → ₹30 | ₹800–₹1200 → ₹50 | ₹1200–₹2000 → ₹75 | ₹2000+ → 5% capped ₹100
const calcLabourPlatformFee = (dailyWage) => {
  const wage = Number(dailyWage) || 0;
  if (wage <= 0)    return 0;
  if (wage <= 800)  return 30;
  if (wage <= 1200) return 50;
  if (wage <= 2000) return 75;
  return Math.min(wage * 0.05, 100);
};

const generateAssignmentCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `WA-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = await WorkAssignment.findOne({ where: { assignmentCode: code } });

    if (!existing) {
      return code;
    }
  }

  return `WA-${Date.now().toString().slice(-6)}`;
};

const normalizeAssignmentLabours = (labours = [], defaultSkill = null) => {
  const list = Array.isArray(labours) ? labours : [];
  const seen = new Set();

  return list
    .map((labour) => {
      const labourId = Number(labour.labourId || labour.id);

      if (!labourId || seen.has(labourId)) {
        return null;
      }

      seen.add(labourId);

      return {
        labourId,
        skillId: labour.skillId || null,
        skill: labour.skill || defaultSkill || null,
        dailyWage: labour.dailyWage || labour.wage || null,
        assignmentStatus: labour.assignmentStatus || "assigned",
        joinedAt: labour.joinedAt || null,
      };
    })
    .filter(Boolean);
};

const resolveOwnerIdFromOrderMapping = async (ownerMapping, transaction) => {
  if (!ownerMapping) return null;
  if (ownerMapping.ownerId) return ownerMapping.ownerId;
  if (!ownerMapping.userId) return null;

  const ownerById = await Owner.findOne({
    where: { id: ownerMapping.userId },
    attributes: ["id"],
    transaction,
  });

  if (ownerById) return ownerById.id;

  const ownerByUserId = await Owner.findOne({
    where: { userId: ownerMapping.userId },
    attributes: ["id"],
    transaction,
  });

  return ownerByUserId?.id || null;
};

const mapAssignment = (assignment) => {
  const json = assignment.toJSON ? assignment.toJSON() : assignment;
  const order = json.order || {};

  // Middleman: prefer direct WA middlemanId join, else fall back to the admin
  // who approved the related order (orderAssignment.assignedByAdmin).
  const fallbackAdmin = order.orderAssignments?.[0]?.assignedByAdmin || null;
  const resolvedMiddleman = json.middleman || fallbackAdmin || null;
  const middlemanName = resolvedMiddleman?.name || resolvedMiddleman?.email || null;

  return {
    ...json,
    middleman: resolvedMiddleman,
    middlemanName,
    ownerName: json.owner?.user?.name || order.ownerName || null,
    ownerPhone: json.owner?.user?.phone || order.ownerPhone || null,
    labourCount: Array.isArray(json.assignmentLabours) ? json.assignmentLabours.length : 0,
  };
};

const syncAssignmentLabours = async (
  workAssignmentId,
  labours,
  transaction,
  { replace = false, defaultSkill = null } = {}
) => {
  const normalizedLabours = normalizeAssignmentLabours(labours, defaultSkill);

  if (replace) {
    await WorkAssignmentLabour.destroy({ where: { workAssignmentId }, transaction });
  } else if (normalizedLabours.length > 0) {
    // Remove existing rows for these specific labours to avoid duplicates without needing a DB constraint
    await WorkAssignmentLabour.destroy({
      where: { workAssignmentId, labourId: normalizedLabours.map((l) => l.labourId) },
      transaction,
    });
  }

  if (normalizedLabours.length > 0) {
    await WorkAssignmentLabour.bulkCreate(
      normalizedLabours.map((labour) => ({ workAssignmentId, ...labour })),
      { transaction }
    );
  }

  return normalizedLabours.length;
};

const getAssignmentByIdService = async (id) => {
  const data = await WorkAssignment.findOne({
    where: { id },
    include: assignmentInclude,
  });

  if (!data) {
    return {
      statusCode: 404,
      body: { success: false, message: "Work assignment not found" },
    };
  }

  return {
    statusCode: 200,
    body: { success: true, data: mapAssignment(data) },
  };
};

const updateWorkAssignmentService = async (id, payload) => {
  const assignment = await WorkAssignment.findOne({ where: { id } });

  if (!assignment) {
    return {
      statusCode: 404,
      body: { success: false, message: "Work assignment not found" },
    };
  }

  const allowedStatus = ["upcoming", "active", "completed", "cancelled"];

  if (payload.status && !allowedStatus.includes(payload.status)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid assignment status" },
    };
  }

  await assignment.update({
    middlemanId: payload.middlemanId ?? assignment.middlemanId,
    fromDate: payload.fromDate || assignment.fromDate,
    toDate: payload.toDate || assignment.toDate,
    workLocation: payload.workLocation ?? assignment.workLocation,
    status: payload.status || assignment.status,
    notes: payload.notes ?? assignment.notes,
  });

  return getAssignmentByIdService(id);
};

const deleteWorkAssignmentService = async (id) => {
  const assignment = await WorkAssignment.findOne({ where: { id } });

  if (!assignment) {
    return {
      statusCode: 404,
      body: { success: false, message: "Work assignment not found" },
    };
  }

  await db.sequelize.transaction(async (transaction) => {
    await WorkPayment.destroy({ where: { workAssignmentId: id }, transaction });
    await WorkAttendance.destroy({ where: { workAssignmentId: id }, transaction });
    await WorkAssignmentLabour.destroy({ where: { workAssignmentId: id }, transaction });
    await WorkAssignment.destroy({ where: { id }, transaction });
  });

  return {
    statusCode: 200,
    body: { success: true, message: "Work assignment deleted successfully" },
  };
};

const createWorkAssignmentService = async (payload, options = {}) => {
  const {
    orderId,
    ownerId,
    middlemanId,
    fromDate,
    toDate,
    workLocation,
    status,
    notes,
    labours = [],
  } = payload;

  const order = orderId
    ? await Order.findOne({
        where: { id: orderId },
        include: [{ model: OrderMapping, as: "mappings", required: false }],
      })
    : null;

  if (orderId && !order) {
    return {
      statusCode: 404,
      body: { success: false, message: "Order not found" },
    };
  }

  const createAssignment = async (transaction) => {
    const ownerMapping = order
      ? (order.mappings || []).find((item) => item.userType === "owner")
      : null;
    const resolvedOwnerId = ownerId || await resolveOwnerIdFromOrderMapping(ownerMapping, transaction);

    const created = await WorkAssignment.create({
      assignmentCode: await generateAssignmentCode(),
      orderId: orderId || null,
      ownerId: resolvedOwnerId || null,
      middlemanId: middlemanId || null,
      fromDate: fromDate || order?.requiredDate || null,
      toDate: toDate || fromDate || order?.requiredDate || null,
      workLocation:
        workLocation ||
        (order ? [order.postOffice, order.pincode, order.district, order.state].filter(Boolean).join(", ") : null),
      status: status || "upcoming",
      notes,
    }, { transaction });

    await syncAssignmentLabours(created.id, labours, transaction, {
      defaultSkill: order?.skill || null,
    });

    return created;
  };

  const assignment = options.transaction
    ? await createAssignment(options.transaction)
    : await db.sequelize.transaction(createAssignment);

  if (options.transaction) {
    return {
      statusCode: 201,
      body: { success: true, data: assignment },
    };
  }

  return getAssignmentByIdService(assignment.id);
};

const createAssignmentFromOrderService = async (orderId, options = {}) => {
  const order = await Order.findOne({
    where: { id: orderId },
    include: [
      {
        model: OrderMapping,
        as: "mappings",
        required: false,
      },
    ],
    transaction: options.transaction,
  });

  if (!order) {
    return {
      statusCode: 404,
      body: { success: false, message: "Order not found" },
    };
  }

  const existing = await WorkAssignment.findOne({
    where: { orderId: order.id },
    transaction: options.transaction,
  });

  const ownerMapping = (order.mappings || []).find((item) => item.userType === "owner");
  const resolvedOwnerId = await resolveOwnerIdFromOrderMapping(ownerMapping, options.transaction);
  const labourMappings = (order.mappings || []).filter(
    (item) => item.userType === "labour" && item.labourId
  );
  const optionLabours = Array.isArray(options.labours) ? options.labours : null;
  const rawLabours = optionLabours || labourMappings.map((mapping) => ({
    labourId: mapping.labourId,
    skillId: mapping.skillId || null,
    skill: mapping.skill || order.skill,
    dailyWage: mapping.dailyWage,
    assignmentStatus: "assigned",
  }));

  // Fill missing dailyWage from the order's skill defaultWage
  let skillDefaultWage = null;
  if (rawLabours.some((l) => !l.dailyWage) && order.skillId) {
    const skillRecord = await Skill.findOne({ where: { id: order.skillId }, attributes: ["defaultWage"] });
    skillDefaultWage = skillRecord?.defaultWage || null;
  }
  const assignmentLabours = rawLabours.map((l) => ({
    ...l,
    dailyWage: l.dailyWage || skillDefaultWage || null,
  }));

  if (existing) {
    const updateAssignment = async (transaction) => {
      await existing.update({
        ownerId: existing.ownerId || resolvedOwnerId || null,
        middlemanId: options.middlemanId ?? existing.middlemanId,
        fromDate: options.fromDate || existing.fromDate || order.requiredDate,
        toDate: options.toDate || existing.toDate || options.fromDate || order.requiredDate,
        workLocation:
          options.workLocation ||
          existing.workLocation ||
          [order.postOffice, order.pincode, order.district, order.state].filter(Boolean).join(", "),
        status: options.status || existing.status,
        notes: options.notes ?? existing.notes,
      }, { transaction });

      if (optionLabours) {
        await syncAssignmentLabours(existing.id, assignmentLabours, transaction, {
          replace: Boolean(options.replaceLabours),
          defaultSkill: order.skill,
        });
      }
    };

    if (options.transaction) {
      await updateAssignment(options.transaction);
    } else {
      await db.sequelize.transaction(updateAssignment);
    }

    if (options.transaction) {
      return {
        statusCode: 200,
        body: { success: true, data: existing },
      };
    }

    return getAssignmentByIdService(existing.id);
  }

  return createWorkAssignmentService({
    orderId: order.id,
    ownerId: resolvedOwnerId || null,
    middlemanId: options.middlemanId || null,
    fromDate: options.fromDate || order.requiredDate,
    toDate: options.toDate || order.requiredDate,
    workLocation: [order.postOffice, order.pincode, order.district, order.state].filter(Boolean).join(", "),
    status: options.status || "upcoming",
    notes: options.notes || order.note,
    labours: assignmentLabours,
  }, { transaction: options.transaction });
};

const getWorkAssignmentsService = async ({
  orderId,
  ownerId,
  middlemanId,
  labourId,
  status,
  assignedType,
  search,
  page = 1,
  limit = 20,
}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (pageNumber - 1) * pageLimit;
  const where = {};
  const include = [...assignmentInclude];

  if (orderId)     where.orderId     = orderId;
  if (ownerId)     where.ownerId     = ownerId;
  if (middlemanId) where.middlemanId = middlemanId;
  if (status)      where.status      = status;

  // Filter by assignedType via order.needType
  if (assignedType) {
    const orderIncludeIdx = include.findIndex((i) => i.as === "order");
    include[orderIncludeIdx] = {
      ...include[orderIncludeIdx],
      required: true,
      where: { needType: assignedType },
    };
  }

  // Search by assignment code or order number
  if (search) {
    const q = `%${String(search).trim()}%`;
    where[Op.or] = [
      { assignmentCode: { [Op.iLike]: q } },
      { "$order.orderNumber$": { [Op.iLike]: q } },
    ];
  }

  if (labourId) {
    const assignmentLaboursIncludeIndex = include.findIndex((item) => item.as === "assignmentLabours");
    include[assignmentLaboursIncludeIndex] = {
      ...include[assignmentLaboursIncludeIndex],
      required: true,
      where: { labourId },
    };
  }

  const result = await WorkAssignment.findAndCountAll({
    where,
    include,
    distinct: true,
    subQuery: false,
    order: [["createdAt", "DESC"]],
    offset,
    limit: pageLimit,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      total: result.count,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(result.count / pageLimit),
      data: result.rows.map(mapAssignment),
    },
  };
};

const addLabourToAssignmentService = async (workAssignmentId, payload) => {
  const { labourId, skillId, skill, dailyWage, assignmentStatus } = payload;

  if (!labourId) {
    return {
      statusCode: 400,
      body: { success: false, message: "Worker ID is required" },
    };
  }

  const assignment = await WorkAssignment.findOne({ where: { id: workAssignmentId } });

  if (!assignment) {
    return {
      statusCode: 404,
      body: { success: false, message: "Work assignment not found" },
    };
  }

  // Fall back to skill defaultWage when no dailyWage is supplied
  let resolvedWage = dailyWage || null;
  if (!resolvedWage) {
    const resolvedSkillId = skillId || assignment.skillId || null;
    if (resolvedSkillId) {
      const skillRecord = await Skill.findOne({ where: { id: resolvedSkillId }, attributes: ["defaultWage"] });
      resolvedWage = skillRecord?.defaultWage || null;
    }
    if (!resolvedWage && assignment.orderId) {
      const relatedOrder = await Order.findOne({ where: { id: assignment.orderId }, attributes: ["skillId"] });
      if (relatedOrder?.skillId) {
        const skillRecord = await Skill.findOne({ where: { id: relatedOrder.skillId }, attributes: ["defaultWage"] });
        resolvedWage = skillRecord?.defaultWage || null;
      }
    }
  }

  await WorkAssignmentLabour.destroy({ where: { workAssignmentId, labourId } });
  await WorkAssignmentLabour.create({
    workAssignmentId,
    labourId,
    skillId: skillId || null,
    skill: skill || null,
    dailyWage: resolvedWage,
    assignmentStatus: assignmentStatus || "assigned",
    joinedAt: assignmentStatus === "joined" ? new Date() : null,
  });

  return getAssignmentByIdService(workAssignmentId);
};

const getAssignmentLaboursService = async (workAssignmentId) => {
  const assignment = await WorkAssignment.findOne({ where: { id: workAssignmentId } });

  if (!assignment) {
    return {
      statusCode: 404,
      body: { success: false, message: "Work assignment not found" },
    };
  }

  const data = await WorkAssignmentLabour.findAll({
    where: { workAssignmentId },
    include: [
      { model: Labour, as: "labour", required: false, include: [{ model: db.user, as: "user", attributes: ["id", "name", "phone"] }] },
      { model: Skill, as: "skillDetail", required: false },
    ],
    order: [["createdAt", "DESC"]],
  });

  return {
    statusCode: 200,
    body: { success: true, total: data.length, data },
  };
};

const updateAssignmentLabourService = async (workAssignmentId, labourId, payload) => {
  const data = await WorkAssignmentLabour.findOne({
    where: { workAssignmentId, labourId },
  });

  if (!data) {
    return {
      statusCode: 404,
      body: { success: false, message: "Assigned labour not found" },
    };
  }

  const allowedStatus = ["assigned", "joined", "removed", "completed"];

  if (payload.assignmentStatus && !allowedStatus.includes(payload.assignmentStatus)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid assignment status" },
    };
  }

  await data.update({
    skillId: payload.skillId ?? data.skillId,
    skill: payload.skill ?? data.skill,
    dailyWage: payload.dailyWage ?? payload.wage ?? data.dailyWage,
    assignmentStatus: payload.assignmentStatus || data.assignmentStatus,
    joinedAt: payload.assignmentStatus === "joined" ? new Date() : data.joinedAt,
    leftAt: payload.assignmentStatus === "removed" ? new Date() : data.leftAt,
  });

  return getAssignmentLaboursService(workAssignmentId);
};

const removeAssignmentLabourService = async (workAssignmentId, labourId) => {
  const deleted = await WorkAssignmentLabour.destroy({
    where: { workAssignmentId, labourId },
  });

  if (!deleted) {
    return {
      statusCode: 404,
      body: { success: false, message: "Assigned labour not found" },
    };
  }

  return getAssignmentLaboursService(workAssignmentId);
};

const markAttendanceService = async (workAssignmentId, payload) => {
  const {
    labourId,
    attendanceDate,
    status,
    markedById,
    markedByType,
    checkInTime,
    checkOutTime,
    remarks,
  } = payload;
  const allowedStatus = ["present", "absent", "half_day", "leave"];
  const allowedMarkedByType = ["admin", "middleman", "owner"];

  if (!labourId || !attendanceDate) {
    return {
      statusCode: 400,
      body: { success: false, message: "Worker and attendance date are required" },
    };
  }

  if (status && !allowedStatus.includes(status)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid attendance status" },
    };
  }

  if (markedByType && !allowedMarkedByType.includes(markedByType)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid markedByType" },
    };
  }

  const assignmentLabour = await WorkAssignmentLabour.findOne({
    where: { workAssignmentId, labourId },
  });

  if (!assignmentLabour) {
    return {
      statusCode: 404,
      body: { success: false, message: "Worker is not assigned to this job" },
    };
  }

  const [data] = await WorkAttendance.upsert({
    workAssignmentId,
    labourId,
    attendanceDate,
    status: status || "present",
    markedById: markedById || null,
    markedByType: markedByType || "admin",
    checkInTime: checkInTime || null,
    checkOutTime: checkOutTime || null,
    remarks,
  }, { returning: true });

  return {
    statusCode: 200,
    body: {
      success: true,
      message: "Attendance recorded successfully",
      data,
    },
  };
};

const getAttendanceService = async ({ workAssignmentId, labourId, fromDate, toDate, page = 1, limit = 100 }) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const offset = (pageNumber - 1) * pageLimit;
  const where = {};

  if (workAssignmentId) where.workAssignmentId = workAssignmentId;
  if (labourId) where.labourId = labourId;
  if (fromDate || toDate) {
    where.attendanceDate = {
      ...(fromDate ? { [Op.gte]: fromDate } : {}),
      ...(toDate ? { [Op.lte]: toDate } : {}),
    };
  }

  const result = await WorkAttendance.findAndCountAll({
    where,
    include: [{ model: Labour, as: "labour", required: false, include: [{ model: db.user, as: "user", attributes: ["id", "name", "phone"] }] }],
    order: [["attendanceDate", "DESC"]],
    offset,
    limit: pageLimit,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      total: result.count,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(result.count / pageLimit),
      data: result.rows,
    },
  };
};

const updateAttendanceService = async (workAssignmentId, attendanceId, payload) => {
  const allowedStatus = ["present", "absent", "half_day", "leave"];
  const allowedMarkedByType = ["admin", "middleman", "owner"];

  if (payload.status && !allowedStatus.includes(payload.status)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid attendance status" },
    };
  }

  if (payload.markedByType && !allowedMarkedByType.includes(payload.markedByType)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid markedByType" },
    };
  }

  const data = await WorkAttendance.findOne({
    where: { id: attendanceId, workAssignmentId },
  });

  if (!data) {
    return {
      statusCode: 404,
      body: { success: false, message: "Attendance not found" },
    };
  }

  await data.update({
    labourId: payload.labourId ?? data.labourId,
    attendanceDate: payload.attendanceDate || data.attendanceDate,
    status: payload.status || data.status,
    markedById: payload.markedById ?? data.markedById,
    markedByType: payload.markedByType || data.markedByType,
    checkInTime: payload.checkInTime ?? data.checkInTime,
    checkOutTime: payload.checkOutTime ?? data.checkOutTime,
    remarks: payload.remarks ?? data.remarks,
  });

  return getAttendanceService({ workAssignmentId });
};

const generatePaymentService = async (workAssignmentId, payload) => {
  const { labourId, fromDate, toDate, deductions = 0 } = payload;

  if (!labourId || !fromDate || !toDate) {
    return {
      statusCode: 400,
      body: { success: false, message: "Worker and date range are required" },
    };
  }

  const assignmentLabour = await WorkAssignmentLabour.findOne({
    where: { workAssignmentId, labourId },
  });

  if (!assignmentLabour) {
    return {
      statusCode: 404,
      body: { success: false, message: "Worker is not assigned to this job" },
    };
  }

  const attendances = await WorkAttendance.findAll({
    where: {
      workAssignmentId,
      labourId,
      attendanceDate: {
        [Op.gte]: fromDate,
        [Op.lte]: toDate,
      },
    },
  });

  const presentDays = attendances.filter((item) => item.status === "present").length;
  const halfDays = attendances.filter((item) => item.status === "half_day").length;
  const absentDays = attendances.filter((item) => item.status === "absent").length;
  const dailyWage = Number(assignmentLabour.dailyWage || 0);
  const grossAmount = presentDays * dailyWage + halfDays * dailyWage * 0.5;
  const totalWorkingDays = presentDays + halfDays * 0.5;
  const platformFee = parseFloat((calcLabourPlatformFee(dailyWage) * totalWorkingDays).toFixed(2));
  const netAmount = Math.max(grossAmount - Number(deductions || 0) - platformFee, 0);

  const existingPayment = await WorkPayment.findOne({
    where: { workAssignmentId, labourId, fromDate, toDate },
  });

  if (existingPayment) {
    return {
      statusCode: 409,
      body: {
        success: false,
        message: "Payment already generated for this labour and date range",
        data: existingPayment,
      },
    };
  }

  const data = await WorkPayment.create({
    workAssignmentId,
    labourId,
    fromDate,
    toDate,
    presentDays,
    halfDays,
    absentDays,
    dailyWage,
    grossAmount,
    deductions,
    platformFee,
    netAmount,
    paymentStatus: "pending",
  });

  return {
    statusCode: 201,
    body: {
      success: true,
      message: "Payment report generated successfully",
      data,
    },
  };
};

const getPaymentsService = async ({ workAssignmentId, labourId, paymentStatus, page = 1, limit = 100 }) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const offset = (pageNumber - 1) * pageLimit;
  const where = {};

  if (workAssignmentId) where.workAssignmentId = workAssignmentId;
  if (labourId) where.labourId = labourId;
  if (paymentStatus) where.paymentStatus = paymentStatus;

  const result = await WorkPayment.findAndCountAll({
    where,
    include: [{ model: Labour, as: "labour", required: false, include: [{ model: db.user, as: "user", attributes: ["id", "name", "phone"] }] }],
    order: [["createdAt", "DESC"]],
    offset,
    limit: pageLimit,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      total: result.count,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(result.count / pageLimit),
      data: result.rows.map((row) => {
        const json = row.toJSON ? row.toJSON() : row;
        return {
          ...json,
          daysWorked: (json.presentDays || 0) + (json.halfDays || 0) * 0.5,
          totalAmount: json.netAmount,
        };
      }),
    },
  };
};

const updatePaymentStatusService = async (workAssignmentId, paymentId, payload) => {
  const allowedStatus = ["pending", "approved", "paid", "cancelled"];

  if (!allowedStatus.includes(payload.paymentStatus)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid payment status" },
    };
  }

  const data = await WorkPayment.findOne({
    where: { id: paymentId, workAssignmentId },
  });

  if (!data) {
    return {
      statusCode: 404,
      body: { success: false, message: "Payment not found" },
    };
  }

  await data.update({
    paymentStatus: payload.paymentStatus,
    paidAt: payload.paymentStatus === "paid" ? new Date() : data.paidAt,
  });

  return getPaymentsService({ workAssignmentId });
};

module.exports = {
  createWorkAssignmentService,
  createAssignmentFromOrderService,
  getWorkAssignmentsService,
  getAssignmentByIdService,
  updateWorkAssignmentService,
  deleteWorkAssignmentService,
  addLabourToAssignmentService,
  getAssignmentLaboursService,
  updateAssignmentLabourService,
  removeAssignmentLabourService,
  markAttendanceService,
  getAttendanceService,
  updateAttendanceService,
  generatePaymentService,
  getPaymentsService,
  updatePaymentStatusService,
};
