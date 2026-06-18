const db = require("../../model/index.js");
const workAssignmentService = require("../workAssignment/service");

const Order = db.order;
const OrderMapping = db.orderMapping;
const Labour = db.labour;
const Owner = db.owner;
const User = db.user;
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
      { model: Owner, as: "owner", required: false },
      { model: Labour, as: "labour", required: false },
    ],
  },
];

// Resolve owner name/phone for new-flow orders (ownerId=null, userId set).
// Strategy:
//   1. Find labours/owners by their own id (orderMappings.userId stores labour.id or owner.id)
//   2. Each labour/owner has a userId FK pointing to the users table (set by new registration)
//   3. Prefer name from users table — single source of truth — fallback to labours/owners name
const resolveUserIds = async (userIds) => {
  if (!userIds || userIds.length === 0) return {};

  const [labours, owners] = await Promise.all([
    Labour.findAll({ where: { id: userIds }, attributes: ["id", "name", "phone", "userId"] }),
    Owner.findAll({ where: { id: userIds }, attributes: ["id", "name", "phone", "userId"] }),
  ]);

  // Collect globalUserIds (users table ids) from both tables
  const globalUserIds = [
    ...labours.map((l) => l.userId),
    ...owners.map((o) => o.userId),
  ].filter(Boolean);

  // Fetch from users table in one shot
  const usersMap = {};
  if (globalUserIds.length > 0 && User) {
    const userRecords = await User.findAll({
      where: { id: [...new Set(globalUserIds)] },
      attributes: ["id", "name", "phone"],
    });
    userRecords.forEach((u) => { usersMap[u.id] = u; });
  }

  const map = {};
  labours.forEach((l) => {
    const u = l.userId ? usersMap[l.userId] : null;
    map[l.id] = { id: l.id, name: u?.name || l.name, phone: u?.phone || l.phone };
  });
  owners.forEach((o) => {
    if (!map[o.id]) {
      const u = o.userId ? usersMap[o.userId] : null;
      map[o.id] = { id: o.id, name: u?.name || o.name, phone: u?.phone || o.phone };
    }
  });
  return map;
};

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

const normalizeNeedType = (payload = {}) => {
  const raw = payload.needType ?? payload.orderType ?? payload.bookingFor ?? payload.requestedProviderRole;
  return raw === "contractor" ? "contractor" : "labour";
};

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

const mapOrder = (order, userMap = {}) => {
  const json = order.toJSON ? order.toJSON() : order;
  const mappings = Array.isArray(json.mappings) ? json.mappings : [];
  const labourMappings = mappings.filter((item) => item.userType === "labour");
  const contractorMappings = mappings.filter((item) => item.userType === "contractor");
  const skillDetail = json.skillDetail || null;
  const needType = json.needType || "labour";

  // Fallback chain for owner resolution:
  // 1. ownerId JOIN (old-flow) → 2. batch-fetched userId record → 3. denormalized ownerName field
  const ownerMappingRaw = mappings.find((item) => item.userType === "owner") || null;
  const resolvedOwner = ownerMappingRaw?.owner
    || (ownerMappingRaw?.userId ? userMap[ownerMappingRaw.userId] || null : null)
    || (json.ownerName ? { id: null, name: json.ownerName, phone: json.ownerPhone } : null);
  const ownerMapping = ownerMappingRaw
    ? { ...ownerMappingRaw, owner: resolvedOwner }
    : null;

  return {
    ...json,
    ownerName: json.ownerName || null,
    ownerPhone: json.ownerPhone || null,
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
    needType,
    orderType: needType,
    bookingFor: needType,
    requestedProviderRole: needType,
    workAssignmentId: json.workAssignment?.id || null,
    ownerMapping,
    contractorMapping: contractorMappings[0] || null,
    contractorId: contractorMappings[0]?.ownerId || null,
    labourMappings,
    contractorMappings,
  };
};

const createOrderService = async (payload) => {
  const {
    userId,
    ownerId,
    _userType,
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
  const needType = normalizeNeedType(payload);

  if (!userId) {
    return {
      statusCode: 400,
      body: { success: false, message: "userId required hai" },
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

  // Token ke userType se correct table mein dhundo (Labour ya Owner ID collision avoid karo)
  const isLabourUser = _userType === "labour";
  const userRecord = isLabourUser
    ? await Labour.findOne({ where: { id: userId }, attributes: ["id", "name", "phone"] })
    : (await Owner.findOne({ where: { id: userId }, attributes: ["id", "name", "phone"] }) ||
       await Labour.findOne({ where: { id: userId }, attributes: ["id", "name", "phone"] }));
  const ownerName = userRecord?.name || null;
  const ownerPhone = userRecord?.phone || null;

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
      ownerName,
      ownerPhone,
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
      needType,
      note,
    }, { transaction });

    await OrderMapping.create({
      orderId: createdOrder.id,
      userId,
      ownerId: null,
      labourId: null,
      userType: needType === "contractor" ? "contractor" : "owner",
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

  const createdJson = createdData.toJSON ? createdData.toJSON() : createdData;
  const createdOwnerM = (createdJson.mappings || []).find((m) => m.userType === "owner");
  const createdUserMap = createdOwnerM && createdOwnerM.userId && !createdOwnerM.owner
    ? await resolveUserIds([createdOwnerM.userId])
    : {};

  return {
    statusCode: 201,
    body: {
      success: true,
      message: "आपकी रिक्वेस्ट भेज दी गई है। Admin approval ke baad booking confirm hogi.",
      requiredCount,
      allocatedCount: 0,
      data: mapOrder(createdData, createdUserMap),
    },
  };
};

const getOrdersService = async ({
  userId,
  ownerId,
  labourId,
  contractorId,
  status,
  adminStatus,
  needType,
  orderType,
  bookingFor,
  requestedProviderRole,
  page = 1,
  limit = 20,
}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (pageNumber - 1) * pageLimit;
  const where = {};
  const include = [...orderInclude];
  const resolvedNeedType = needType ?? orderType ?? bookingFor ?? requestedProviderRole;
  const { Op } = db.Sequelize;

  if (status) {
    where.status = status;
  }

  if (adminStatus) {
    where.adminStatus = adminStatus;
  }

  if (resolvedNeedType) {
    where.needType = resolvedNeedType === "contractor" ? "contractor" : "labour";
  }

  // userId or ownerId → same user, check both userId and ownerId columns
  const ownerFilterId = userId || ownerId;

  if (ownerFilterId || labourId || contractorId) {
    const mappingsIncludeIndex = include.findIndex((item) => item.as === "mappings");
    let mappingWhere = {};

    if (ownerFilterId) {
      mappingWhere = {
        userType: "owner",
        [Op.or]: [
          { userId: Number(ownerFilterId) },
          { ownerId: Number(ownerFilterId) },
        ],
      };
    } else if (labourId) {
      mappingWhere = { labourId, userType: "labour" };
    } else if (contractorId) {
      mappingWhere = { ownerId: Number(contractorId), userType: "contractor" };
    }

    include[mappingsIncludeIndex] = {
      ...include[mappingsIncludeIndex],
      required: true,
      where: mappingWhere,
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

  const pendingUserIds = [];
  result.rows.forEach((row) => {
    const json = row.toJSON ? row.toJSON() : row;
    const ownerM = (json.mappings || []).find((m) => m.userType === "owner");
    if (ownerM && ownerM.userId && !ownerM.owner) pendingUserIds.push(ownerM.userId);
  });
  const userMap = await resolveUserIds([...new Set(pendingUserIds)]);

  return {
    statusCode: 200,
    body: {
      success: true,
      _v: "8d49d6b",
      total: result.count,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(result.count / pageLimit),
      data: result.rows.map((o) => mapOrder(o, userMap)),
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

  const json = data.toJSON ? data.toJSON() : data;
  const ownerM = (json.mappings || []).find((m) => m.userType === "owner");
  const userMap = ownerM && ownerM.userId && !ownerM.owner
    ? await resolveUserIds([ownerM.userId])
    : {};

  return {
    statusCode: 200,
    body: { success: true, data: mapOrder(data, userMap) },
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

  const isContractorOrder = order.needType === "contractor";
  const ownerMapping = await OrderMapping.findOne({
    where: { orderId: id, userType: "owner" },
  });

  const selectedLabours = isContractorOrder ? [] : normalizeSelectedLabours(payload, order.skill);
  const hasManualLabourSelection =
    !isContractorOrder && (Array.isArray(payload.labours) || Array.isArray(payload.labourIds));

  const selectedContractorIds = isContractorOrder
    ? [
        ...(Array.isArray(payload.contractorIds) ? payload.contractorIds : []),
        ...(payload.contractorId ? [payload.contractorId] : []),
      ]
        .map((value) => Number(value))
        .filter((value, index, arr) => value && arr.indexOf(value) === index)
    : [];
  const hasManualContractorSelection =
    isContractorOrder && (Array.isArray(payload.contractorIds) || payload.contractorId != null);

  const allocatedCount = hasManualLabourSelection
    ? selectedLabours.length
    : hasManualContractorSelection
      ? selectedContractorIds.length
      : order.labourAllocated;

  if (!isContractorOrder && selectedLabours.length > Number(order.labourRequired)) {
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

  if (selectedContractorIds.length > 0) {
    const foundContractors = await Owner.findAll({
      where: { id: selectedContractorIds },
    });

    if (foundContractors.length !== selectedContractorIds.length) {
      return {
        statusCode: 404,
        body: { success: false, message: "One or more selected contractors not found" },
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
          userId: ownerMapping?.userId || null,
          ownerId: ownerMapping?.ownerId || null,
          labourId: labour.labourId,
          userType: "labour",
          skill: labour.skill || order.skill,
          dailyWage: labour.dailyWage,
          status: "assigned",
          adminStatus: "approved",
      })), { transaction });
    }

    if (adminStatus === "approved" && hasManualContractorSelection) {
      await OrderMapping.destroy({
        where: { orderId: id, userType: "contractor" },
        transaction,
      });

      await OrderMapping.bulkCreate(selectedContractorIds.map((contractorId) => ({
          orderId: id,
          ownerId: contractorId,
          labourId: null,
          userType: "contractor",
          skill: order.skill,
          status: "assigned",
          adminStatus: "approved",
      })), { transaction });
    }

    if (adminStatus === "approved" && !isContractorOrder) {
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
