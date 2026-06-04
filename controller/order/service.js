const db = require("../../model/index.js");
const labourService = require("../Labours/service");

const Order = db.order;
const OrderMapping = db.orderMapping;
const Labour = db.labour;
const Owner = db.owner;

const orderInclude = [
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

const getLabourWageForSkill = (labour, skillName) => {
  const skillWages = Array.isArray(labour.skillWages) ? labour.skillWages : [];
  const matchedSkill = skillWages.find(
    (item) => String(item.skill || "").toLowerCase() === String(skillName || "").toLowerCase()
  );

  return Number(matchedSkill?.dailyWage ?? matchedSkill?.wage ?? 0) || null;
};

const getOrderStatus = (requiredCount, allocatedCount) => {
  if (allocatedCount <= 0) {
    return "pending";
  }

  if (allocatedCount < requiredCount) {
    return "partially_allocated";
  }

  return "allocated";
};

const mapOrder = (order) => {
  const json = order.toJSON ? order.toJSON() : order;
  const mappings = Array.isArray(json.mappings) ? json.mappings : [];

  return {
    ...json,
    ownerMapping: mappings.find((item) => item.userType === "owner") || null,
    labourMappings: mappings.filter((item) => item.userType === "labour"),
  };
};

const createOrderService = async (payload) => {
  const {
    ownerId,
    categoryName,
    skill,
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
    state,
    district,
    pincode,
    postOffice,
    labourRequired = 1,
    note,
  } = payload;
  const requiredCount = Number(labourRequired) || 1;

  if (!ownerId) {
    return {
      statusCode: 400,
      body: { success: false, message: "ownerId required hai" },
    };
  }

  if (!skill || !pincode) {
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

  const searchResult = await labourService.searchLaboursService({
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
    pincode,
    district,
    skill,
    page: 1,
    limit: requiredCount,
  });
  const matchedLabours = searchResult.body?.data || [];
  const allocatedLabours = matchedLabours.slice(0, requiredCount);

  const order = await db.sequelize.transaction(async (transaction) => {
    const createdOrder = await Order.create({
      orderCode: await generateOrderCode(),
      categoryName,
      skill,
      stateId: stateId || null,
      districtId: districtId || null,
      pincodeId: pincodeId || null,
      postOfficeId: postOfficeId || null,
      state: state || searchResult.body?.meta?.state || null,
      district: district || searchResult.body?.meta?.district || null,
      pincode,
      postOffice: postOffice || searchResult.body?.meta?.postOfficeName || null,
      labourRequired: requiredCount,
      labourAllocated: allocatedLabours.length,
      status: getOrderStatus(requiredCount, allocatedLabours.length),
      adminStatus: "pending",
      note,
    }, { transaction });

    await OrderMapping.create({
      orderId: createdOrder.id,
      ownerId,
      labourId: null,
      userType: "owner",
      skill,
      status: "requested",
      adminStatus: "pending",
    }, { transaction });

    for (const labour of allocatedLabours) {
      await OrderMapping.create({
        orderId: createdOrder.id,
        ownerId,
        labourId: labour.id,
        userType: "labour",
        skill,
        dailyWage: getLabourWageForSkill(labour, skill),
        status: "assigned",
        adminStatus: "pending",
      }, { transaction });
    }

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
      message: "Order created successfully",
      requiredCount,
      allocatedCount: allocatedLabours.length,
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
    include[0] = {
      ...include[0],
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

const updateOrderAdminStatusService = async (id, { adminStatus }) => {
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

  await db.sequelize.transaction(async (transaction) => {
    await order.update({
      adminStatus,
      status: adminStatus === "approved" ? "admin_approved" : order.status,
    }, { transaction });

    await OrderMapping.update({ adminStatus }, { where: { orderId: id }, transaction });
  });

  return getOrderByIdService(id);
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
  updateOrderMappingStatusService,
};
