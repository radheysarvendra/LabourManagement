const { Op } = require("sequelize");
const db = require("../../model/index.js");
const labourService = require("../Labours/service");

const Owner = db.owner;
const User = db.user;
const Skill = db.skill;
const Category = db.category;
const State = db.state;
const District = db.district;
const Pincode = db.pincode;
const PostOffice = db.postOffice;
const Labour = db.labour;
const LabourSkill = db.labourSkill;

const normalizeProviderType = (value) => (
  String(value || "").toLowerCase() === "contractor" ? "contractor" : "labour"
);

const getSkillName = async (skillId, skill) => {
  if (skill) return String(skill).trim();
  if (!skillId) return "";
  const skillData = await Skill.findOne({ where: { id: skillId } });
  return skillData?.skillName || "";
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const buildUserLocationWhere = ({ stateId, districtId, pincodeId, postOfficeId, state, district, pincode, postOffice }) => {
  const filters = [];

  if (stateId || state) {
    filters.push({
      [Op.or]: [
        ...(stateId ? [{ stateId: Number(stateId) }] : []),
        ...(state ? [{ state: { [Op.iLike]: state } }] : []),
      ],
    });
  }

  if (districtId || district) {
    filters.push({
      [Op.or]: [
        ...(districtId ? [{ districtId: Number(districtId) }] : []),
        ...(district ? [{ district: { [Op.iLike]: district } }] : []),
      ],
    });
  }

  if (pincodeId || pincode) {
    filters.push({
      [Op.or]: [
        ...(pincodeId ? [{ pincodeId: Number(pincodeId) }] : []),
        ...(pincode ? [{ pincode: String(pincode) }] : []),
      ],
    });
  }

  if (postOfficeId || postOffice) {
    filters.push({
      [Op.or]: [
        ...(postOfficeId ? [{ postOfficeId: Number(postOfficeId) }] : []),
        ...(postOffice ? [{ postOffice: { [Op.iLike]: postOffice } }] : []),
      ],
    });
  }

  return filters.length ? { [Op.and]: filters } : {};
};

const mapContractor = (owner) => {
  const json = owner.toJSON ? owner.toJSON() : owner;
  const user = json.user || {};
  const skill = json.skillDetail || {};
  const category = json.categoryDetail || {};

  return {
    id: json.id,
    userId: json.userId,
    name: user.name || null,
    phone: user.phone || null,
    providerType: "contractor",
    workType: json.workType,
    categoryId: json.categoryId,
    categoryName: category.name || null,
    skillId: json.skillId,
    skillName: skill.skillName || null,
    hindi: skill.hindi || null,
    stateId: user.stateId || null,
    districtId: user.districtId || null,
    pincodeId: user.pincodeId || null,
    postOfficeId: user.postOfficeId || null,
    state: user.state || null,
    district: user.district || null,
    pincode: user.pincode || null,
    postOffice: user.postOffice || null,
    city: user.city || null,
    age: user.age || null,
    gender: user.gender || null,
    profileImage: user.profileImage || null,
    isAvailable: user.isActive ?? true,
    isVerified: false,
    registeredFrom: json.registeredFrom,
    createdAt: json.createdAt,
  };
};

const mapNewContractor = (profile) => {
  const json = profile.toJSON ? profile.toJSON() : profile;
  const user = json.user || {};
  const skills = (json.contractorSkills || []).map((cs) => ({
    skillId: cs.skillId,
    skillName: cs.skill?.skillName || null,
    hindi: cs.skill?.hindi || null,
    rate: cs.rate || null,
    experienceYears: cs.experienceYears || 0,
  }));
  const categories = (json.contractorCategories || []).map((cc) => ({
    categoryId: cc.categoryId,
    categoryName: cc.category?.name || null,
  }));

  return {
    id: json.userId,
    userId: json.userId,
    name: user.name || null,
    phone: user.phone || null,
    providerType: "contractor",
    contractorCode: json.contractorCode || null,
    companyName: json.companyName || null,
    experienceYears: json.experienceYears || 0,
    skills,
    categories,
    primarySkillId: skills[0]?.skillId || null,
    primarySkillName: skills[0]?.skillName || null,
    primaryCategoryId: categories[0]?.categoryId || null,
    primaryCategoryName: categories[0]?.categoryName || null,
    stateId: user.stateId || null,
    districtId: user.districtId || null,
    pincodeId: user.pincodeId || null,
    postOfficeId: user.postOfficeId || null,
    state: user.state || null,
    district: user.district || null,
    pincode: user.pincode || null,
    postOffice: user.postOffice || null,
    city: user.city || null,
    area: user.area || null,
    age: user.age || null,
    gender: user.gender || null,
    profileImage: user.profileImage || null,
    isAvailable: json.isAvailable,
    isVerified: json.verificationStatus === "verified",
    verificationStatus: json.verificationStatus,
    flow: "new",
    createdAt: json.createdAt,
  };
};

const searchNewContractors = async ({
  categoryId, skillId, search,
  status, verificationStatus,
  stateId, districtId, pincodeId, postOfficeId,
  state, district, pincode, postOffice,
  page = 1, limit = 20,
}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (pageNumber - 1) * pageLimit;

  const profileWhere = {};
  const locationWhere = buildUserLocationWhere({
    stateId, districtId, pincodeId, postOfficeId,
    state, district, pincode, postOffice,
  });
  const hasLocationFilter = Object.keys(locationWhere).length > 0;

  // Cross-table search: name/phone on user, companyName on profile
  if (search) {
    const q = `%${String(search).trim()}%`;
    profileWhere[Op.or] = [
      { '$user.name$':  { [Op.iLike]: q } },
      { '$user.phone$': { [Op.iLike]: q } },
      { companyName:    { [Op.iLike]: q } },
    ];
  }
  if (verificationStatus) {
    const normalizedVerification = String(verificationStatus).toLowerCase() === "approved"
      ? "verified"
      : String(verificationStatus).toLowerCase();
    profileWhere.verificationStatus = normalizedVerification;
  }
  if (status) {
    profileWhere.isAvailable = String(status).toLowerCase() === "active" || String(status).toLowerCase() === "available";
  }

  const userWhere = hasLocationFilter ? locationWhere : undefined;

  const skillInclude = {
    model: db.contractorSkill,
    as: "contractorSkills",
    required: !!skillId,
    where: skillId ? { skillId: Number(skillId) } : undefined,
    include: [{ model: Skill, as: "skill", required: false }],
  };

  const categoryInclude = {
    model: db.contractorCategory,
    as: "contractorCategories",
    required: !!categoryId,
    where: categoryId ? { categoryId: Number(categoryId) } : undefined,
    include: [{ model: Category, as: "category", required: false }],
  };

  const result = await db.contractorProfile.findAndCountAll({
    where: profileWhere,
    subQuery: false,
    include: [
      {
        model: User,
        as: "user",
        required: !!(hasLocationFilter || search),
        where: userWhere,
        attributes: ["id", "name", "phone", "age", "gender", "profileImage", "city", "district", "state", "stateId", "districtId", "pincode", "pincodeId", "postOffice", "postOfficeId", "area"],
      },
      skillInclude,
      categoryInclude,
    ],
    distinct: true,
    order: [["createdAt", "DESC"]],
    offset,
    limit: pageLimit,
  });

  return result;
};

const searchContractors = async ({
  categoryId, skillId, search,
  status, verificationStatus,
  stateId, districtId, pincodeId, postOfficeId,
  state, district, pincode, postOffice,
  page = 1, limit = 20,
}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (pageNumber - 1) * pageLimit;

  // Try new-flow first (contractorProfiles table)
  let newFlowResult = null;
  try {
    newFlowResult = await searchNewContractors({
      categoryId, skillId, search,
      status, verificationStatus,
      stateId, districtId, pincodeId, postOfficeId,
      state, district, pincode, postOffice,
      page, limit,
    });
  } catch (e) {
    console.warn("New contractor search failed, falling back to old flow:", e.message);
  }

  // If new flow returned results, return them
  if (newFlowResult && newFlowResult.count > 0) {
    const items = newFlowResult.rows.map(mapNewContractor).map((item) => ({
      ...item,
      email: null,
      category: item.primaryCategoryName,
      availabilityStatus: item.isAvailable ? "available" : "unavailable",
    }));
    return {
      success: true,
      providerType: "contractor",
      total: newFlowResult.count,
      count: newFlowResult.count,
      availableCount: newFlowResult.count,
      matchedCount: newFlowResult.count,
      page: pageNumber,
      limit: pageLimit,
      data: {
        items,
        labours: items,
        labour: items,
        workers: items,
        pagination: {
          page: pageNumber,
          limit: pageLimit,
          total: newFlowResult.count,
          totalPages: Math.ceil(newFlowResult.count / pageLimit) || 1,
        },
      },
    };
  }

  // Old flow fallback — owners table with registeredFrom=contractor
  const ownerWhere = { registeredFrom: "contractor" };
  if (categoryId) ownerWhere.categoryId = Number(categoryId);
  if (skillId) ownerWhere.skillId = Number(skillId);

  const userWhere = {};
  if (status) userWhere.isActive = String(status).toLowerCase() === "active" || String(status).toLowerCase() === "available";
  else userWhere.isActive = true;
  if (search) {
    const q = `%${String(search).trim()}%`;
    userWhere[Op.or] = [
      { name:  { [Op.iLike]: q } },
      { phone: { [Op.iLike]: q } },
    ];
  }

  const result = await Owner.findAndCountAll({
    where: ownerWhere,
    include: [
      {
        model: User,
        as: "user",
        required: true,
        where: userWhere,
        attributes: ["id", "name", "phone", "age", "gender", "profileImage", "city", "district", "state", "stateId", "districtId", "pincode", "pincodeId", "postOffice", "postOfficeId", "area", "isActive", "status"],
      },
      { model: Skill, as: "skillDetail", required: false },
      { model: Category, as: "categoryDetail", required: false },
    ],
    distinct: true,
    order: [["createdAt", "DESC"]],
    offset,
    limit: pageLimit,
  });

  return {
    success: true,
    providerType: "contractor",
    total: result.count,
    count: result.count,
    availableCount: result.count,
    matchedCount: result.count,
    page: pageNumber,
    limit: pageLimit,
    data: {
      items: result.rows.map(mapContractor).map((item) => ({
        ...item,
        email: null,
        category: item.categoryName,
        verificationStatus: "verified",
        availabilityStatus: item.isAvailable ? "available" : "unavailable",
      })),
      labours: result.rows.map(mapContractor),
      labour: result.rows.map(mapContractor),
      workers: result.rows.map(mapContractor),
      pagination: {
        page: pageNumber,
        limit: pageLimit,
        total: result.count,
        totalPages: Math.ceil(result.count / pageLimit) || 1,
      },
    },
  };
};

const searchProviders = async (payload) => {
  const providerType = normalizeProviderType(payload.providerType || payload.needType || payload.orderType || payload.bookingFor);

  if (providerType === "contractor") {
    return searchContractors(payload);
  }

  const skillName = await getSkillName(payload.skillId, payload.skill);
  const result = await labourService.searchLaboursService({
    ...payload,
    skill: skillName,
    showAll: payload.showAll,
  });
  const labourRows = Array.isArray(result.body.data)
    ? result.body.data
    : result.body.data?.items || result.body.data?.rows || [];
  const labourPagination = result.body.data?.pagination || {
    page: Number(payload.page) || 1,
    limit: Number(payload.limit) || 20,
    total: result.body.data?.total || result.body.total || 0,
    totalPages: result.body.data?.totalPages || result.body.totalPages || 1,
  };
  const total = Number(result.body.data?.total ?? result.body.total ?? labourRows.length ?? 0);

  return {
    ...result.body,
    providerType: "labour",
    total,
    count: total,
    availableCount: total,
    matchedCount: total,
    labours: labourRows.map((item) => ({ ...item, providerType: "labour" })),
    labour: labourRows.map((item) => ({ ...item, providerType: "labour" })),
    workers: labourRows.map((item) => ({ ...item, providerType: "labour" })),
    data: {
      items: labourRows.map((item) => ({ ...item, providerType: "labour" })),
      labours: labourRows.map((item) => ({ ...item, providerType: "labour" })),
      labour: labourRows.map((item) => ({ ...item, providerType: "labour" })),
      workers: labourRows.map((item) => ({ ...item, providerType: "labour" })),
      pagination: labourPagination,
    },
  };
};

const countProviders = async (payload) => {
  const result = await searchProviders({ ...payload, page: 1, limit: 1 });
  const data = Array.isArray(result.data) ? result.data : result.data?.items || result.data?.rows || [];
  const total = result.data?.pagination?.total || result.data?.total || result.total || result.availableCount || 0;

  return {
    success: true,
    providerType: result.providerType,
    matchedCount: total,
    verifiedCount: data.filter((item) => item.isVerified).length,
    unverifiedCount: data.filter((item) => !item.isVerified).length,
  };
};

const getContractorById = async (id) => {
  const contractorUserId = Number(id);
  let profile = await db.contractorProfile.findOne({
    where: { userId: contractorUserId },
    include: [
      { model: User, as: "user", required: false, attributes: ["id", "name", "phone", "age", "gender", "profileImage", "city", "district", "state", "stateId", "districtId", "pincode", "pincodeId", "postOffice", "postOfficeId", "area", "isActive"] },
      { model: db.contractorSkill, as: "contractorSkills", required: false, include: [{ model: Skill, as: "skill", required: false }] },
      { model: db.contractorCategory, as: "contractorCategories", required: false, include: [{ model: Category, as: "category", required: false }] },
    ],
  });

  if (profile) {
    return { success: true, data: mapNewContractor(profile) };
  }

  const owner = await Owner.findOne({
    where: { id: contractorUserId, registeredFrom: "contractor" },
    include: [
      { model: User, as: "user", required: false, attributes: ["id", "name", "phone", "age", "gender", "profileImage", "city", "district", "state", "stateId", "districtId", "pincode", "pincodeId", "postOffice", "postOfficeId", "area", "isActive"] },
      { model: Skill, as: "skillDetail", required: false },
      { model: Category, as: "categoryDetail", required: false },
    ],
  });

  if (!owner) {
    const error = new Error("Contractor not found");
    error.statusCode = 404;
    throw error;
  }

  return { success: true, data: mapContractor(owner) };
};

const updateContractor = async (id, payload) => {
  const contractorUserId = Number(id);
  const profile = await db.contractorProfile.findOne({ where: { userId: contractorUserId } });

  if (profile) {
    const allowedVerification = ["pending", "verified", "rejected"];
    const requestedVerification = payload.verificationStatus === "approved" ? "verified" : payload.verificationStatus;
    if (requestedVerification && !allowedVerification.includes(requestedVerification)) {
      const error = new Error("Invalid verification status");
      error.statusCode = 400;
      throw error;
    }

    await profile.update({
      companyName: payload.companyName ?? profile.companyName,
      gstNumber: payload.gstNumber ?? profile.gstNumber,
      experienceYears: payload.experienceYears ?? profile.experienceYears,
      isAvailable: payload.isAvailable ?? profile.isAvailable,
      verificationStatus: requestedVerification || profile.verificationStatus,
      verifiedByAdminId: payload.verifiedByAdminId ?? profile.verifiedByAdminId,
      verifiedAt: requestedVerification === "verified" ? new Date() : profile.verifiedAt,
    });

    const userUpdate = {};
    ["name", "phone", "age", "gender", "profileImage", "city", "district", "state", "stateId", "districtId", "pincode", "pincodeId", "postOffice", "postOfficeId", "area"].forEach((key) => {
      if (payload[key] !== undefined) userUpdate[key] = payload[key];
    });
    if (payload.isActive !== undefined) userUpdate.isActive = payload.isActive;
    if (Object.keys(userUpdate).length > 0) {
      await User.update(userUpdate, { where: { id: contractorUserId } });
    }

    return getContractorById(contractorUserId);
  }

  const owner = await Owner.findOne({ where: { id: contractorUserId, registeredFrom: "contractor" } });
  if (!owner) {
    const error = new Error("Contractor not found");
    error.statusCode = 404;
    throw error;
  }

  await owner.update({
    workType: payload.workType ?? owner.workType,
    categoryId: payload.categoryId ?? owner.categoryId,
    skillId: payload.skillId ?? owner.skillId,
  });

  const userUpdate = {};
  ["name", "phone", "age", "gender", "profileImage", "city", "district", "state", "stateId", "districtId", "pincode", "pincodeId", "postOffice", "postOfficeId", "area"].forEach((key) => {
    if (payload[key] !== undefined) userUpdate[key] = payload[key];
  });
  if (payload.isActive !== undefined) userUpdate.isActive = payload.isActive;
  if (Object.keys(userUpdate).length > 0 && owner.userId) {
    await User.update(userUpdate, { where: { id: owner.userId } });
  }

  return getContractorById(contractorUserId);
};

const updateContractorVerification = async (id, verificationStatus, adminId) => (
  updateContractor(id, { verificationStatus, verifiedByAdminId: adminId })
);

const updateContractorAvailability = async (id, isAvailable) => (
  updateContractor(id, { isAvailable })
);

const ensureProviderAvailable = async (payload) => {
  const providerType = normalizeProviderType(payload.providerType || payload.needType || payload.orderType || payload.bookingFor);
  const result = await searchProviders({ ...payload, providerType, page: 1, limit: 1 });
  const matchedCount = result.data?.pagination?.total || result.data?.total || result.total || result.availableCount || 0;

  if (matchedCount < 1) {
    const message = providerType === "contractor"
      ? "इस जगह इस काम का ठेकेदार उपलब्ध नहीं है।"
      : "इस जगह इस काम का मजदूर उपलब्ध नहीं है।";

    return { ok: false, providerType, matchedCount, message };
  }

  return { ok: true, providerType, matchedCount };
};

const normalizeSearchText = (value) => String(value || "").trim().toLowerCase();

const getSkillWhere = (payload) => {
  if (payload.skillId) {
    return { id: Number(payload.skillId) };
  }
  if (payload.skill) {
    return { skillName: { [Op.iLike]: `%${String(payload.skill).trim()}%` } };
  }
  return null;
};

const resolveLocationChain = async (payload) => {
  const result = {
    state: null,
    district: null,
    pincode: null,
    postOffice: null,
    stateId: payload.stateId ? Number(payload.stateId) : null,
    districtId: payload.districtId ? Number(payload.districtId) : null,
    pincodeId: payload.pincodeId ? Number(payload.pincodeId) : null,
    postOfficeId: payload.postOfficeId ? Number(payload.postOfficeId) : null,
  };

  const mismatches = [];

  if (result.stateId) {
    const stateRow = await State.findByPk(result.stateId);
    result.state = stateRow?.stateName || null;
    if (payload.state && normalizeText(payload.state) !== normalizeText(result.state)) {
      mismatches.push("state does not match stateId");
    }
  } else if (payload.state) {
    const stateRow = await State.findOne({ where: { stateName: { [Op.iLike]: String(payload.state).trim() } } });
    result.state = stateRow?.stateName || String(payload.state).trim() || null;
    result.stateId = stateRow?.id || result.stateId;
  }

  if (result.districtId) {
    const districtRow = await District.findByPk(result.districtId);
    result.district = districtRow?.districtName || null;
    result.stateId = districtRow?.stateId || result.stateId;
    if (payload.district && normalizeText(payload.district) !== normalizeText(result.district)) {
      mismatches.push("district does not match districtId");
    }
  } else if (payload.district) {
    const districtRow = await District.findOne({
      where: { districtName: { [Op.iLike]: String(payload.district).trim() } },
      include: [{ model: State, as: "state" }],
    });
    result.district = districtRow?.districtName || String(payload.district).trim() || null;
    result.districtId = districtRow?.id || result.districtId;
    result.stateId = districtRow?.stateId || districtRow?.state?.id || result.stateId;
    result.state = districtRow?.state?.stateName || result.state;
  }

  if (result.pincodeId) {
    const pincodeRow = await Pincode.findByPk(result.pincodeId, {
      include: [
        { model: District, as: "district", include: [{ model: State, as: "state" }] },
        { model: PostOffice, as: "postOffices" },
      ],
    });
    result.pincode = pincodeRow?.pincode || null;
    result.districtId = pincodeRow?.districtId || result.districtId;
    result.district = pincodeRow?.district?.districtName || result.district;
    result.stateId = pincodeRow?.district?.stateId || result.stateId;
    result.state = pincodeRow?.district?.state?.stateName || result.state;
    result.postOffice = (pincodeRow?.postOffices || []).map((office) => office.postOfficeName);
    if (payload.pincode && normalizeText(payload.pincode) !== normalizeText(result.pincode)) {
      mismatches.push("pincode does not match pincodeId");
    }
    if (result.districtId && pincodeRow?.districtId && Number(result.districtId) !== Number(pincodeRow.districtId)) {
      mismatches.push("pincode does not belong to district");
    }
  } else if (payload.pincode) {
    const pincodeRow = await Pincode.findOne({
      where: { pincode: String(payload.pincode).trim() },
      include: [
        { model: District, as: "district", include: [{ model: State, as: "state" }] },
        { model: PostOffice, as: "postOffices" },
      ],
    });
    result.pincode = pincodeRow?.pincode || String(payload.pincode).trim() || null;
    result.pincodeId = pincodeRow?.id || result.pincodeId;
    result.districtId = pincodeRow?.districtId || result.districtId;
    result.district = pincodeRow?.district?.districtName || result.district;
    result.stateId = pincodeRow?.district?.stateId || result.stateId;
    result.state = pincodeRow?.district?.state?.stateName || result.state;
    result.postOffice = (pincodeRow?.postOffices || []).map((office) => office.postOfficeName);
  }

  if (result.postOfficeId) {
    const officeRow = await PostOffice.findByPk(result.postOfficeId);
    result.postOffice = officeRow?.postOfficeName || null;
    result.pincodeId = officeRow?.pincodeId || result.pincodeId;
    if (payload.postOffice && normalizeText(payload.postOffice) !== normalizeText(result.postOffice)) {
      mismatches.push("postOffice does not match postOfficeId");
    }
  } else if (payload.postOffice && result.pincodeId) {
    const officeRow = await PostOffice.findOne({
      where: {
        pincodeId: result.pincodeId,
        postOfficeName: { [Op.iLike]: String(payload.postOffice).trim() },
      },
    });
    result.postOffice = officeRow?.postOfficeName || String(payload.postOffice).trim() || null;
    result.postOfficeId = officeRow?.id || result.postOfficeId;
  }

  if (result.postOfficeId && result.pincodeId) {
    const officeRow = await PostOffice.findByPk(result.postOfficeId);
    if (officeRow && Number(officeRow.pincodeId) !== Number(result.pincodeId)) {
      mismatches.push("postOffice does not belong to pincode");
    }
  }

  return { ...result, mismatches };
};

const getLabourLocationSkillMatch = async (payload) => {
  const location = await resolveLocationChain(payload);
  const skillWhere = getSkillWhere(payload);

  if (!skillWhere) {
    const error = new Error("skill or skillId is required");
    error.statusCode = 400;
    throw error;
  }

  if (location.mismatches?.length) {
    const error = new Error("location data does not match");
    error.statusCode = 400;
    error.details = location.mismatches;
    throw error;
  }

  const skill = await Skill.findOne({ where: skillWhere });
  if (!skill) {
    const error = new Error("Skill not found");
    error.statusCode = 404;
    throw error;
  }

  const userWhere = {};
  if (location.stateId) userWhere.stateId = location.stateId;
  if (location.districtId) userWhere.districtId = location.districtId;
  if (location.pincodeId) userWhere.pincodeId = location.pincodeId;
  if (location.postOfficeId) userWhere.postOfficeId = location.postOfficeId;

  const where = {};
  if (String(payload.isAvailable).toLowerCase() === "true") where.isAvailable = true;
  if (String(payload.isVerified).toLowerCase() === "true") where.isVerified = true;

  const count = await Labour.count({
    where,
    include: [
      {
        model: db.user,
        as: "user",
        required: Object.keys(userWhere).length > 0,
        where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
        attributes: [],
      },
      {
        model: LabourSkill,
        as: "labourSkills",
        required: true,
        where: { skillId: skill.id },
        attributes: [],
      },
    ],
    distinct: true,
    col: "id",
  });

  const totalLabourCount = await Labour.count({
    include: [
      {
        model: db.user,
        as: "user",
        required: Object.keys(userWhere).length > 0,
        where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
        attributes: [],
      },
    ],
    distinct: true,
    col: "id",
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      providerType: "labour",
      data: {
        totalLabourCount,
        labourCount: count,
        matchedCount: count,
      },
    },
  };
};

module.exports = {
  searchProviders,
  countProviders,
  getContractorById,
  updateContractor,
  updateContractorVerification,
  updateContractorAvailability,
  ensureProviderAvailable,
  normalizeProviderType,
  getLabourLocationSkillMatch,
};
