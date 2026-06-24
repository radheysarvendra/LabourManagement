const db = require("../../model/index.js");
const workAssignmentService = require("../workAssignment/service");
const providerService = require("../provider/service");

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
      {
        model: Owner, as: "owner", required: false,
        include: [{ model: User, as: "user", attributes: ["id", "name", "phone"], required: false }],
      },
      {
        model: Labour, as: "labour", required: false,
        include: [{ model: User, as: "user", attributes: ["id", "name", "phone"], required: false }],
      },
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
    Labour.findAll({ where: { id: userIds }, attributes: ["id", "userId"] }),
    Owner.findAll({ where: { id: userIds }, attributes: ["id", "userId"] }),
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
    map[l.id] = { id: l.id, name: u?.name || null, phone: u?.phone || null };
  });
  owners.forEach((o) => {
    if (!map[o.id]) {
      const u = o.userId ? usersMap[o.userId] : null;
      map[o.id] = { id: o.id, name: u?.name || null, phone: u?.phone || null };
    }
  });
  return map;
};

const formatOrderCode = (id) => `ORD-${String(id).padStart(5, "0")}`;


const getRequiredLabourCount = (payload) => (
  Number(payload.requiredProviderCount ?? payload.requiredLabourCount ?? payload.labourRequired) || 1
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
  // 1. owner JOIN user.name (new-flow, owner.user populated) → 2. owner.name (old-flow, direct column)
  // 3. batch-fetched userId record → 4. ownerId lookup → 5. denormalized ownerName field
  const ownerMappingRaw = mappings.find((item) => item.userType === "owner") || null;
  const ownerFromJoin = ownerMappingRaw?.owner || null;
  // owner.name is null in new-flow (name lives in users table) — prefer owner.user.name
  const ownerJoinName  = ownerFromJoin?.user?.name  || ownerFromJoin?.name  || null;
  const ownerJoinPhone = ownerFromJoin?.user?.phone || ownerFromJoin?.phone || null;
  const resolvedOwner = (ownerJoinName ? { id: ownerFromJoin.id, name: ownerJoinName, phone: ownerJoinPhone } : null)
    || (ownerMappingRaw?.userId  ? userMap[ownerMappingRaw.userId]  || null : null)
    || (ownerMappingRaw?.ownerId ? userMap[ownerMappingRaw.ownerId] || null : null)
    || (json.ownerName ? { id: null, name: json.ownerName, phone: json.ownerPhone } : null);
  const ownerMapping = ownerMappingRaw
    ? { ...ownerMappingRaw, owner: resolvedOwner }
    : null;

  return {
    ...json,
    ownerId: ownerMappingRaw?.ownerId || ownerMappingRaw?.userId || null,
    ownerName: resolvedOwner?.name || json.ownerName || null,
    ownerPhone: resolvedOwner?.phone || json.ownerPhone || null,
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
    assignedType: json.assignedType || null,
    orderType: needType,
    bookingFor: needType,
    requestedProviderRole: needType,
    workAssignmentId: json.workAssignment?.id || null,
    ownerMapping,
    contractorMapping: contractorMappings[0] || null,
    contractorId: contractorMappings[0]?.ownerId || null,
    // Resolve labour name from user table (new-flow) or direct field (old-flow)
    labourMappings: labourMappings.map((lm) => ({
      ...lm,
      labourName: lm.labour?.user?.name || lm.labour?.name || null,
      labourPhone: lm.labour?.user?.phone || lm.labour?.phone || null,
    })),
    contractorMappings,
  };
};

const createOrderService = async (payload) => {
  const {
    userId,
    ownerId,
    _userType,
    _authenticatedUserId,
    _activeRole,
    _isSessionAuth,
    _isAdminRequest,
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
  const requesterUserId = _isSessionAuth ? Number(_authenticatedUserId) : null;
  let legacyProfileId = _isSessionAuth ? null : Number(_authenticatedUserId || userId) || null;

  if (_isSessionAuth) {
    const profile = _activeRole === "LABOUR"
      ? await Labour.findOne({ where: { userId: requesterUserId }, attributes: ["id"] })
      : await Owner.findOne({ where: { userId: requesterUserId }, attributes: ["id"] });
    legacyProfileId = profile?.id || null;
  }

  // Admin-created orders: userId/ownerId from request body identifies the owner
  const adminOwnerId = _isAdminRequest ? (Number(ownerId) || null) : null;

  if (!requesterUserId && !legacyProfileId && !_isAdminRequest) {
    return {
      statusCode: 400,
      body: { success: false, message: "Authenticated user ID is required" },
    };
  }

  if (!skill && !skillId) {
    return {
      statusCode: 400,
      body: { success: false, message: "Skill is required" },
    };
  }
  // Pincode required for user/mobile orders; optional for admin-created orders
  if (!pincode && !_isAdminRequest) {
    return {
      statusCode: 400,
      body: { success: false, message: "PIN code is required" },
    };
  }

  if (requiredCount < 1 || requiredCount > 50) {
    return {
      statusCode: 400,
      body: { success: false, message: "Worker count must be between 1 and 50" },
    };
  }

  // Prevent duplicate order — same owner + same skill + pending/assigned status
  // Skip for admin-created orders (admin can create on behalf of any user)
  if (!_isAdminRequest) {
    let existingOrder = null;

    if (legacyProfileId) {
      // Old-flow: check via OrderMapping.userId (owner profile id)
      existingOrder = await Order.findOne({
        where: {
          ...(pincode ? { pincode } : {}),
          ...(skillId ? { skillId } : skill ? { skill } : {}),
          status: ["pending", "assigned"],
        },
        include: [{
          model: OrderMapping,
          as: "mappings",
          required: true,
          where: { userId: legacyProfileId, userType: "owner" },
        }],
      });
    }

    // New-flow fallback: check via createdByUserId on the order itself
    if (!existingOrder && requesterUserId) {
      existingOrder = await Order.findOne({
        where: {
          createdByUserId: requesterUserId,
          ...(skillId ? { skillId } : skill ? { skill } : {}),
          status: ["pending", "assigned"],
        },
      });
    }

    if (existingOrder) {
      return {
        statusCode: 409,
        body: {
          success: false,
          message: "Aapka ek order already pending hai isi skill ke liye.",
          existingOrderId: existingOrder.id,
          existingOrderCode: existingOrder.orderCode,
        },
      };
    }
  }

  const skillData = skillId ? await Skill.findOne({ where: { id: skillId } }) : null;
  const categoryData = categoryId ? await Category.findOne({ where: { id: categoryId } }) : null;
  const skillName = skill || skillData?.skillName;

  // Token ke userType se correct table mein dhundo (Labour ya Owner ID collision avoid karo)
  const isLabourUser = _activeRole === "LABOUR" || _userType === "labour";
  const ownerRecord = !isLabourUser
    ? await Owner.findOne({
        where: _isSessionAuth ? { userId: requesterUserId } : { id: legacyProfileId },
        attributes: ["id", "userId"],
      })
    : null;
  const userRecord = isLabourUser
    ? await Labour.findOne({
        where: _isSessionAuth ? { userId: requesterUserId } : { id: legacyProfileId },
        attributes: ["id", "userId"],
      })
    : ownerRecord;
  const globalUser = requesterUserId
    ? await db.user.findByPk(requesterUserId, { attributes: ["id", "name", "phone"] })
    : null;
  let ownerName = globalUser?.name || null;
  let ownerPhone = globalUser?.phone || null;

  // For admin-created orders, look up the target owner's user record
  if (_isAdminRequest && adminOwnerId && (!ownerName || !ownerPhone)) {
    const targetOwner = await Owner.findOne({
      where: { id: adminOwnerId },
      include: [{ model: db.user, as: "user", attributes: ["name", "phone"] }],
    });
    ownerName  = targetOwner?.user?.name  || ownerName  || null;
    ownerPhone = targetOwner?.user?.phone || ownerPhone || null;
  }

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

  const availability = await providerService.ensureProviderAvailable({
    providerType: needType,
    categoryId,
    skillId,
    skill: skillName,
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
    state,
    district,
    pincode,
    postOffice,
  });

  const order = await db.sequelize.transaction(async (transaction) => {
    const createdOrder = await Order.create({
      orderCode: `TEMP-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdByUserId: requesterUserId || userRecord?.userId || null,
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
      pincode: pincode || "",
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

    await createdOrder.update({ orderCode: formatOrderCode(createdOrder.id) }, { transaction });

    await OrderMapping.create({
      orderId: createdOrder.id,
      userId: legacyProfileId || null,
      ownerId: adminOwnerId || ownerId || ownerRecord?.id || null,
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

  const createdJson = createdData.toJSON ? createdData.toJSON() : createdData;
  const createdOwnerM = (createdJson.mappings || []).find((m) => m.userType === "owner");
  const createdJoinedName = createdOwnerM?.owner?.user?.name || createdOwnerM?.owner?.name;
  const createdResolveId = !createdJoinedName
    ? (createdOwnerM?.userId || createdOwnerM?.ownerId || null)
    : null;
  const createdUserMap = createdResolveId
    ? await resolveUserIds([createdResolveId])
    : {};

  const mappedOrder = mapOrder(createdData, createdUserMap);
  return {
    statusCode: 201,
    body: {
      success: true,
      message: "Order submitted and awaiting admin approval",
      // Top-level fields the app reads directly
      id: mappedOrder.id,
      orderCode: mappedOrder.orderCode,
      status: mappedOrder.status,
      createdAt: mappedOrder.createdAt,
      requiredCount,
      allocatedCount: 0,
      matchedCount: availability.matchedCount,
      data: {
        ...mappedOrder,
        matchedCount: availability.matchedCount,
        assignedProviderCount: 0,
      },
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
  actorUserId,
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

  if (actorUserId) {
    const assignments = await db.orderAssignment.findAll({
      where: { providerUserId: Number(actorUserId) },
      attributes: ["orderId"],
    });
    where[Op.or] = [
      { createdByUserId: Number(actorUserId) },
      { id: assignments.map((item) => item.orderId) },
    ];
  }

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
    // Strategy: resolve matching orderIds via a separate query so the main
    // mappings include can load ALL mapping types (owner + labour + contractor).
    // Previously, adding WHERE on the mappings include filtered out labour/contractor
    // mappings from the result, making labourMappings always empty for owner queries.
    let matchingOrderIds;
    if (ownerFilterId) {
      const rows = await OrderMapping.findAll({
        where: {
          userType: "owner",
          [Op.or]: [{ userId: Number(ownerFilterId) }, { ownerId: Number(ownerFilterId) }],
        },
        attributes: ["orderId"],
      });
      matchingOrderIds = rows.map((r) => r.orderId);
    } else if (labourId) {
      const rows = await OrderMapping.findAll({
        where: { labourId, userType: "labour" },
        attributes: ["orderId"],
      });
      matchingOrderIds = rows.map((r) => r.orderId);
    } else {
      const rows = await OrderMapping.findAll({
        where: { ownerId: Number(contractorId), userType: "contractor" },
        attributes: ["orderId"],
      });
      matchingOrderIds = rows.map((r) => r.orderId);
    }
    where.id = matchingOrderIds.length > 0 ? matchingOrderIds : [-1];
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
    if (ownerM) {
      // Skip resolution if name already resolved via JOIN
      const joinedName = ownerM.owner?.user?.name || ownerM.owner?.name;
      if (!joinedName) {
        if (ownerM.userId)       pendingUserIds.push(ownerM.userId);
        else if (ownerM.ownerId) pendingUserIds.push(ownerM.ownerId);
      }
    }
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

const getOrderByIdService = async (id, actorUserId = null) => {
  const data = await Order.findOne({ where: { id }, include: orderInclude });

  if (!data) {
    return {
      statusCode: 404,
      body: { success: false, message: "Order not found" },
    };
  }

  if (actorUserId && Number(data.createdByUserId) !== Number(actorUserId)) {
    const assignment = await db.orderAssignment.findOne({
      where: { orderId: id, providerUserId: Number(actorUserId) },
    });
    if (!assignment) {
      return { statusCode: 403, body: { success: false, message: "You cannot access this order" } };
    }
  }

  const json = data.toJSON ? data.toJSON() : data;
  const ownerM = (json.mappings || []).find((m) => m.userType === "owner");
  const joinedName = ownerM?.owner?.user?.name || ownerM?.owner?.name;
  const resolveId = !joinedName ? (ownerM?.userId || ownerM?.ownerId || null) : null;
  const userMap = resolveId ? await resolveUserIds([resolveId]) : {};

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

  const ownerMapping = await OrderMapping.findOne({
    where: { orderId: id, userType: "owner" },
  });

  // Admin can assign labours OR contractors regardless of what was originally requested (needType).
  // assignedType in payload tells us what admin is actually fulfilling the order with.
  const assigningLabours = Array.isArray(payload.labours) || Array.isArray(payload.labourIds);
  const assigningContractors = Array.isArray(payload.contractorIds) || payload.contractorId != null;

  const selectedLabours = assigningLabours ? normalizeSelectedLabours(payload, order.skill) : [];
  const hasManualLabourSelection = assigningLabours;

  const selectedContractorIds = assigningContractors
    ? [
        ...(Array.isArray(payload.contractorIds) ? payload.contractorIds : []),
        ...(payload.contractorId ? [payload.contractorId] : []),
      ]
        .map((value) => Number(value))
        .filter((value, index, arr) => value && arr.indexOf(value) === index)
    : [];
  const hasManualContractorSelection = assigningContractors;

  // Determine what type is actually being assigned at approval time
  const effectiveAssignedType = payload.assignedType
    || (assigningContractors ? "contractor" : assigningLabours ? "labour" : order.needType);

  const allocatedCount = hasManualLabourSelection
    ? selectedLabours.length
    : hasManualContractorSelection
      ? selectedContractorIds.length
      : order.labourAllocated;

  if (selectedLabours.length > Number(order.labourRequired)) {
    return {
      statusCode: 400,
      body: {
        success: false,
        message: "Assigned workers cannot exceed the requested count",
      },
    };
  }

  let foundLabours = [];
  let foundContractors = [];

  if (selectedLabours.length > 0) {
    foundLabours = await Labour.findAll({
      where: { id: selectedLabours.map((labour) => labour.labourId) },
    });

    if (foundLabours.length !== selectedLabours.length) {
      return {
        statusCode: 404,
        body: { success: false, message: "Some selected workers were not found" },
      };
    }
  }

  if (selectedContractorIds.length > 0) {
    foundContractors = await Owner.findAll({
      where: { id: selectedContractorIds },
    });

    if (foundContractors.length !== selectedContractorIds.length) {
      return {
        statusCode: 404,
        body: { success: false, message: "Some selected contractors were not found" },
      };
    }
  }

  let createdWorkAssignmentId = null;

  await db.sequelize.transaction(async (transaction) => {
    await order.update({
      adminStatus,
      assignedType: adminStatus === "approved" ? effectiveAssignedType : order.assignedType,
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

    if (adminStatus === "approved") {
      const roleCode = effectiveAssignedType === "contractor" ? "CONTRACTOR" : "LABOUR";
      const appRole = await db.appRole.findOne({ where: { code: roleCode }, transaction });
      if (!appRole) throw new Error(`Application role ${roleCode} is not configured`);

      const providers = effectiveAssignedType === "contractor"
        ? foundContractors.map((provider) => ({ provider, selection: null }))
        : foundLabours.map((provider) => ({
            provider,
            selection: selectedLabours.find((item) => Number(item.labourId) === Number(provider.id)),
          }));

      for (const { provider, selection } of providers) {
        if (!provider.userId) throw new Error(`Provider ${provider.id} is not linked to a user account`);
        const userRole = await db.userRole.findOne({
          where: { userId: provider.userId, roleId: appRole.id, profileStatus: "complete" },
          transaction,
        });
        if (!userRole) throw new Error(`Provider ${provider.id} does not have an active ${roleCode} role`);

        const [assignment] = await db.orderAssignment.findOrCreate({
          where: { orderId: id, providerUserId: provider.userId, providerRoleId: appRole.id },
          defaults: {
            assignmentStatus: "assigned",
            adminStatus: "approved",
            assignedByAdminId: middlemanId || staffId || null,
            assignedAt: new Date(),
          },
          transaction,
        });

        if (roleCode === "LABOUR") {
          await db.labourAssignmentDetail.upsert({
            assignmentId: assignment.id,
            skillId: order.skillId || null,
            dailyWage: selection?.dailyWage ?? null,
            startDate: fromDate || null,
            endDate: toDate || null,
          }, { transaction });
        } else {
          await db.contractorAssignmentDetail.upsert({
            assignmentId: assignment.id,
            categoryId: order.categoryId || null,
            contractFee: payload.contractFee || null,
            startDate: fromDate || null,
            endDate: toDate || null,
            paymentTermType: payload.paymentTermType || null,
            paymentTerms: payload.paymentTerms || null,
          }, { transaction });
        }
      }
    }

    if (adminStatus === "approved") {
      const assignmentResult = await workAssignmentService.createAssignmentFromOrderService(id, {
        middlemanId: middlemanId || staffId || null,
        fromDate,
        toDate,
        workLocation,
        notes,
        labours: effectiveAssignedType === "labour" && hasManualLabourSelection
          ? selectedLabours
          : undefined,
        replaceLabours: effectiveAssignedType === "labour" && hasManualLabourSelection,
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
      message: "Order approved and provider assigned.",
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
