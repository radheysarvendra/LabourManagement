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
      totalPages: Math.ceil(newFlowResult.count / pageLimit),
      data: newFlowResult.rows.map(mapNewContractor),
    };
  }

  // Old flow fallback — owners table with registeredFrom=contractor
  const ownerWhere = { registeredFrom: "contractor" };
  if (categoryId) ownerWhere.categoryId = Number(categoryId);
  if (skillId) ownerWhere.skillId = Number(skillId);

  const userWhere = { isActive: true };
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
    totalPages: Math.ceil(result.count / pageLimit),
    data: result.rows.map(mapContractor),
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

  return {
    ...result.body,
    providerType: "labour",
    availableCount: result.body.total,
    data: (result.body.data || []).map((item) => ({ ...item, providerType: "labour" })),
  };
};

const countProviders = async (payload) => {
  const result = await searchProviders({ ...payload, page: 1, limit: 1 });
  const data = result.data || [];

  return {
    success: true,
    providerType: result.providerType,
    matchedCount: result.total || result.availableCount || 0,
    verifiedCount: data.filter((item) => item.isVerified).length,
    unverifiedCount: data.filter((item) => !item.isVerified).length,
  };
};

const ensureProviderAvailable = async (payload) => {
  const providerType = normalizeProviderType(payload.providerType || payload.needType || payload.orderType || payload.bookingFor);
  const result = await searchProviders({ ...payload, providerType, page: 1, limit: 1 });
  const matchedCount = result.total || result.availableCount || 0;

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
  ensureProviderAvailable,
  normalizeProviderType,
};
