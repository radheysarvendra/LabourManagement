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
    name: user.name || json.name,
    phone: json.phone,
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
    isAvailable: json.isActive,
    isVerified: false,
    registeredFrom: json.registeredFrom,
    createdAt: json.createdAt,
  };
};

const searchContractors = async ({
  categoryId, skillId,
  stateId, districtId, pincodeId, postOfficeId,
  state, district, pincode, postOffice,
  page = 1, limit = 20,
}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (pageNumber - 1) * pageLimit;

  const ownerWhere = { registeredFrom: "contractor", isActive: true };
  if (categoryId) ownerWhere.categoryId = Number(categoryId);
  if (skillId) ownerWhere.skillId = Number(skillId);

  const userWhere = buildUserLocationWhere({ stateId, districtId, pincodeId, postOfficeId, state, district, pincode, postOffice });
  const hasLocationFilter = Object.keys(userWhere).length > 0;

  const result = await Owner.findAndCountAll({
    where: ownerWhere,
    include: [
      {
        model: User,
        as: "user",
        required: hasLocationFilter,
        attributes: ["id", "name", "age", "gender", "profileImage", "city", "district", "state", "stateId", "districtId", "pincode", "pincodeId", "postOffice", "postOfficeId", "area"],
        ...(hasLocationFilter ? { where: userWhere } : {}),
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
