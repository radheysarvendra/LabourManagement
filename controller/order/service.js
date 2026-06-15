const db = require("../../model/index.js");
const workAssignmentService = require("../workAssignment/service");

const Order = db.order;
const OrderMapping = db.orderMapping;
const Labour = db.labour;
const Owner = db.owner;
const Skill = db.skill;
const Category = db.category;
const WorkAssignment = db.workAssignment;

const orderInclude = [
  { model: Skill, as: "skillDetail", required: false },
  { model: Category, as: "categoryDetail", required: false },
  { model: WorkAssignment, as: "workAssignment", required: false, attributes: ["id"] },
  {
    model: OrderMapping,
    as: "mappings",
    include: [
      { model: Owner, as: "owner" },
      { model: Labour, as: "labour" },
    ],
  },
];

const generateOrderCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = await Order.findOne({ where: { orderCode: code } });

    if (!existing) {
      return code;
    }
  }

  return `ORD-${Date.now().toString().slice(-6)}`;
};

const getRequiredLabourCount = (payload) => (
  Number(payload.requiredLabourCount ?? payload.labourRequired) || 1
);

const normalizeSelectedLabours = (payload = {}, defaultSkill = null) => {
  const directLabours = Array.isArray(payload.labours) ? payload.labours : [];
  const labourIds = Array.isArray(payload.labourIds) ? payload.labourIds : [];
  const merged = [
    ...directLabours,
    ...labourIds.map((labourId) => ({ labourId })),
  ];
  const seen = new Set();

  return merged
    .map((labour) => {
      const labourId = Number(labour.labourId || labour.id);

      if (!labourId || seen.has(labourId)) {
        return null;
      }

      seen.add(labourId);

      return {
        labourId,
        skillId: labour.skillId || payload.skillId || null,
        skill: labour.skill || defaultSkill,
        dailyWage: labour.dailyWage || labour.wage || null,
      };
    })
    .filter(Boolean);
};

const mapOrder = (order) => {
  const json = order.toJSON ? order.toJSON() : order;
  const mappings = Array.isArray(json.mappings) ? json.mappings : [];
  const labourMappings = mappings.filter((item) => item.userType === "labour");
  const skillDetail = json.skillDetail || null;

  return {
    ...json,
    requiredLabourCount: json.labourRequired,
    assignedLabourCount: json.labourAllocated,
    category: json.categoryDetail
      ? {
          id: json.categoryDetail.id,
          name: json.categoryDetail.name,
          hindi: json.categoryDetail.hindi,
        }
      : null,
    skill: skillDetail
      ? {
          id: skillDetail.id,
          skillName: skillDetail.skillName,
          hindi: skillDetail.hindi,
        }
      : json.skill,
    skillName: json.skill,
    workAssignmentId: json.workAssignment?.id || null,
    ownerMapping: mappings.find((item) => item.userType === "owner") || null,
    labourMappings,
  };
};

const createOrderService = async (payload) => {
  const {
    ownerId,
    categoryId,
    categoryName,
    skillId,
    skill,
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
    state,
    district,
    pincode,
    postOffice,
    requiredDate,
    address,
    note,
  } = payload;
  const requiredCount = getRequiredLabourCount(payload);

  if (!ownerId) {
    return {
      statusCode: 400,
      body: { success: false, message: "ownerId required hai" },
    };
  }

  if ((!skill && !skillId) || !pincode) {
    return {
      statusCode: 400,
      body: { success: false, message: "Skill aur pincode required hai" },
    };
  }

  if (requiredCount < 1 || requiredCount > 50) {
    return {
      statusCode: 400,
      body: { success: false, message: "Labour required count 1 se 50 ke beech hona chahiye" },
    };
  }

  const skillData = skillId ? await Skill.findOne({ where: { id: skillId } }) : null;
  const categoryData = categoryId ? await Category.findOne({ where: { id: categoryId } }) : null;
  const skillName = skill || skillData?.skillName;

  if (skillId && !skillData) {
    return {
      statusCode: 404,
      body: { success: false, message: "Skill not found" },
    };
  }

  if (categoryId && !categoryData) {
    return {
      statusCode: 404,
      body: { success: false, message: "Category not found" },
    };
  }

  if (!skillName) {
    return {
      statusCode: 404,
      body: { success: false, message: "Skill not found" },
    };
  }

  const order = await db.sequelize.transaction(async (transaction) => {
    const createdOrder = await Order.create({
      orderCode: await generateOrderCode(),
      categoryId: categoryId || null,
      categoryName: categoryName || categoryData?.name || skillData?.category || null,
      skillId: skillId || null,
      skill: skillName,
      stateId: stateId || null,
      districtId: districtId || null,
      pincodeId: pincodeId || null,
      postOfficeId: postOfficeId || null,
      state: state || null,
      district: district || null,
      pincode,
      postOffice: postOffice || null,
      address: address || null,
      requiredDate: requiredDate || null,
      labourRequired: requiredCount,
      labourAllocated: 0,
      status: "pending",
      adminStatus: "pending",
      note,
    }, { transaction });

    await OrderMapping.create({
      orderId: createdOrder.id,
      ownerId,
      labourId: null,
      userType: "owner",
      skill: skillName,
      status: "requested",
      adminStatus: "pending",
    }, { transaction });

    return createdOrder;
  });

  const createdData = await Order.findOne({
    where: { id: order.id },
    include: orderInclude,
  });

  return {
    statusCode: 201,
    body: {
      success: true,
      message: "Request submitted. Admin approval pending.",
      requiredCount,
      allocatedCount: 0,
      data: mapOrder(createdData),
    },
  };
};

const getOrdersService = async ({ ownerId, labourId, status, adminStatus, page = 1, limit = 20 }) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (pageNumber - 1) * pageLimit;
  const where = {};
  const include = [...orderInclude];

  if (status) {
    where.status = status;
  }

  if (adminStatus) {
    where.adminStatus = adminStatus;
  }

  if (ownerId || labourId) {
    const mappingsIncludeIndex = include.findIndex((item) => item.as === "mappings");
    include[mappingsIncludeIndex] = {
      ...include[mappingsIncludeIndex],
      required: true,
      where: {
        ...(ownerId ? { ownerId } : {}),
        ...(labourId ? { labourId, userType: "labour" } : {}),
      },
    };
  }

  const result = await Order.findAndCountAll({
    where,
    include,
    distinct: true,
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
      data: result.rows.map(mapOrder),
    },
  };
};

const getOrderByIdService = async (id) => {
  const data = await Order.findOne({ where: { id }, include: orderInclude });

  if (!data) {
    return {
      statusCode: 404,
      body: { success: false, message: "Order not found" },
    };
  }

  return {
    statusCode: 200,
    body: { success: true, data: mapOrder(data) },
  };
};

const updateOrderAdminStatusService = async (id, payload) => {
  const {
    adminStatus,
    middlemanId,
    staffId,
    fromDate,
    toDate,
    workLocation,
    notes,
  } = payload;
  const allowedStatus = ["pending", "approved", "rejected"];

  if (!allowedStatus.includes(adminStatus)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid admin status" },
    };
  }

  const order = await Order.findOne({ where: { id } });

  if (!order) {
    return {
      statusCode: 404,
      body: { success: false, message: "Order not found" },
    };
  }

  const selectedLabours = normalizeSelectedLabours(payload, order.skill);
  const hasManualLabourSelection =
    Array.isArray(payload.labours) || Array.isArray(payload.labourIds);
  const ownerMapping = await OrderMapping.findOne({
    where: { orderId: id, userType: "owner" },
  });
  const allocatedCount = hasManualLabourSelection
    ? selectedLabours.length
    : order.labourAllocated;

  if (selectedLabours.length > Number(order.labourRequired)) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: "Assigned labour count owner requirement se zyada nahi ho sakta",
      },
    };
  }

  if (selectedLabours.length > 0) {
    const foundLabours = await Labour.findAll({
      where: { id: selectedLabours.map((labour) => labour.labourId) },
    });

    if (foundLabours.length !== selectedLabours.length) {
      return {
        statusCode: 404,
        body: { success: false, message: "One or more selected labours not found" },
      };
    }
  }

  let createdWorkAssignmentId = null;

  await db.sequelize.transaction(async (transaction) => {
    await order.update({
      adminStatus,
      labourAllocated: adminStatus === "approved" ? allocatedCount : order.labourAllocated,
      status: adminStatus === "approved" ? "assigned" : order.status,
    }, { transaction });

    await OrderMapping.update({ adminStatus }, { where: { orderId: id }, transaction });

    if (adminStatus === "approved" && hasManualLabourSelection) {
      await OrderMapping.destroy({
        where: { orderId: id, userType: "labour" },
        transaction,
      });

      await OrderMapping.bulkCreate(selectedLabours.map((labour) => ({
          orderId: id,
          ownerId: ownerMapping?.ownerId || null,
          labourId: labour.labourId,
          userType: "labour",
          skill: labour.skill || order.skill,
          dailyWage: labour.dailyWage,
          status: "assigned",
          adminStatus: "approved",
      })), { transaction });
    }

    if (adminStatus === "approved") {
      const assignmentResult = await workAssignmentService.createAssignmentFromOrderService(id, {
        middlemanId: middlemanId || staffId || null,
        fromDate,
        toDate,
        workLocation,
        notes,
        labours: hasManualLabourSelection ? selectedLabours : undefined,
        replaceLabours: hasManualLabourSelection,
        status: "upcoming",
        transaction,
      });

      if (assignmentResult.statusCode >= 400) {
        throw new Error(assignmentResult.body?.message || "Work assignment creation failed");
      }

      createdWorkAssignmentId = assignmentResult.body?.data?.id || null;
    }
  });

  const orderResult = await getOrderByIdService(id);

  if (orderResult.statusCode === 200 && createdWorkAssignmentId) {
    orderResult.body.workAssignmentId = createdWorkAssignmentId;
  }

  return orderResult;
};

const approveOrderService = async (id, payload) => {
  const result = await updateOrderAdminStatusService(id, {
    ...payload,
    adminStatus: "approved",
  });

  if (result.statusCode >= 400) {
    return result;
  }

  return {
    statusCode: 200,
    body: {
      ...result.body,
      message: "Order approved and labours assigned.",
    },
  };
};

const updateOrderMappingStatusService = async (id, { status }) => {
  const allowedStatus = ["requested", "assigned", "accepted", "rejected", "completed"];

  if (!allowedStatus.includes(status)) {
    return {
      statusCode: 400,
      body: { success: false, message: "Invalid mapping status" },
    };
  }

  const mapping = await OrderMapping.findOne({ where: { id } });

  if (!mapping) {
    return {
      statusCode: 404,
      body: { success: false, message: "Order mapping not found" },
    };
  }

  await mapping.update({
    status,
    confirmedAt: ["accepted", "completed"].includes(status) ? new Date() : mapping.confirmedAt,
  });

  return getOrderByIdService(mapping.orderId);
};

module.exports = {
  createOrderService,
  getOrdersService,
  getOrderByIdService,
  updateOrderAdminStatusService,
  approveOrderService,
  updateOrderMappingStatusService,
};
