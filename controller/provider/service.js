const { Op } = require("sequelize");
const db = require("../../model/index.js");
const labourService = require("../Labours/service");

const Owner = db.owner;
const User = db.user;
const Skill = db.skill;
const Category = db.category;

const normalizeProviderType = (value) => (
  String(value || "").toLowerCase() === "contractor" ? "contractor" : "labour"
);

const getSkillName = async (skillId, skill) => {
  if (skill) return String(skill).trim();
  if (!skillId) return "";
  const skillData = await Skill.findOne({ where: { id: skillId } });
  return skillData?.skillName || "";
};

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
    return {
      success: true,
      providerType: "contractor",
      total: newFlowResult.count,
      availableCount: newFlowResult.count,
      page: pageNumber,
      limit: pageLimit,
      data: {
        items: newFlowResult.rows.map(mapNewContractor).map((item) => ({
          ...item,
          email: null,
          category: item.primaryCategoryName,
          availabilityStatus: item.isAvailable ? "available" : "unavailable",
        })),
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
    availableCount: result.count,
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

  return {
    ...result.body,
    providerType: "labour",
    availableCount: result.body.data?.total || result.body.total || 0,
    data: {
      items: labourRows.map((item) => ({ ...item, providerType: "labour" })),
      pagination: result.body.data?.pagination || {
        page: Number(payload.page) || 1,
        limit: Number(payload.limit) || 20,
        total: result.body.data?.total || result.body.total || 0,
        totalPages: result.body.data?.totalPages || result.body.totalPages || 1,
      },
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

module.exports = {
  searchProviders,
  countProviders,
  getContractorById,
  updateContractor,
  updateContractorVerification,
  updateContractorAvailability,
  ensureProviderAvailable,
  normalizeProviderType,
};
