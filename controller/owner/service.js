const db = require("../../model/index.js");
const { generateToken, saveToken } = require("../../middleware/auth/index");
const msg = require("../../constants/Messages");
const { getPincodeDetails } = require("../../utils/indiaPost");

const Owner = db.owner;
const User = db.user;

const ROLE_TYPES = {
  OWNER: "owner",
  CONTRACTOR: "contractor",
  CONTRACTOR_CUSTOMER: "contractor_customer",
};
const OWNER_ROLE_TYPES = [ROLE_TYPES.OWNER, ROLE_TYPES.CONTRACTOR, ROLE_TYPES.CONTRACTOR_CUSTOMER];

const WORK_TYPE_API_VALUES = {
  "home repair": "home_repair",
  home_repair: "home_repair",
  construction: "construction",
  both: "both",
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const normalizeWorkType = (workType) => {
  const key = normalizeText(workType).replace(/\s+/g, "_");
  return WORK_TYPE_API_VALUES[key] || "construction";
};

const normalizeOwnerRole = (value) => {
  const role = normalizeText(value);
  return OWNER_ROLE_TYPES.includes(role) ? role : ROLE_TYPES.OWNER;
};

const USER_ATTRIBUTES = [
  "id", "name", "age", "gender", "profileImage",
  "city", "village", "district", "state", "stateId", "districtId",
  "pincode", "pincodeId", "postOffice", "postOfficeId", "area", "address",
];

const ownerInclude = [{ model: User, as: "user", required: false, attributes: USER_ATTRIBUTES }];

// Flatten user personal/location fields onto the owner JSON
const mapOwnerWithUser = (owner) => {
  const json = owner.toJSON ? owner.toJSON() : owner;
  const user = json.user || {};
  return {
    id: json.id,
    userId: json.userId,
    name: json.name,
    phone: json.phone,
    workType: json.workType,
    categoryId: json.categoryId,
    skillId: json.skillId,
    isActive: json.isActive,
    registeredFrom: json.registeredFrom,
    status: json.status,
    createdById: json.createdById,
    updatedById: json.updatedById,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
    // Personal/location from users table
    age: user.age ?? null,
    gender: user.gender ?? null,
    profileImage: user.profileImage ?? null,
    city: user.city ?? null,
    village: user.village ?? null,
    district: user.district ?? null,
    state: user.state ?? null,
    stateId: user.stateId ?? null,
    districtId: user.districtId ?? null,
    pincode: user.pincode ?? null,
    pincodeId: user.pincodeId ?? null,
    postOffice: user.postOffice ?? null,
    postOfficeId: user.postOfficeId ?? null,
    area: user.area ?? null,
    address: user.address ?? null,
  };
};

const getLocationData = async ({ pincode, district, state, area, postOffice }) => {
  if (!pincode) return { district, state, area, postOffice };
  const pincodeDetails = await getPincodeDetails(pincode);
  return {
    pincode: pincodeDetails.pincode,
    district: pincodeDetails.district || district,
    state: pincodeDetails.state || state,
    area: area || pincodeDetails.area,
    postOffice: typeof postOffice === "string" ? postOffice : postOffice?.name || pincodeDetails.postOffice?.[0]?.name || null,
  };
};

const buildOwnerSession = async (owner, userType, message, statusCode = 200) => {
  const token = generateToken(owner, userType);
  await saveToken(owner, token, userType);
  const ownerWithUser = await Owner.findOne({ where: { id: owner.id }, include: ownerInclude });
  const mapped = mapOwnerWithUser(ownerWithUser);
  return {
    statusCode,
    body: {
      success: true,
      message,
      token,
      data: mapped,
      user: mapped,
      profile: mapped,
      type: userType,
      userType,
      roleId: `${userType}:${owner.id}`,
      profileId: owner.id,
      ownerId: userType === ROLE_TYPES.CONTRACTOR ? null : owner.id,
      contractorId: userType === ROLE_TYPES.CONTRACTOR ? owner.id : null,
      roles: [userType],
      isRegistered: true,
    },
  };
};

const createOwnerService = async (payload) => {
  const {
    name, phone, workType, categoryId, skillId, village, city, district, state, pincode, area,
    postOffice, address, age, gender, profileImage, role, userType, registeredFrom,
  } = payload;
  const sessionUserType = normalizeOwnerRole(userType || role);
  const resolvedRegisteredFrom = registeredFrom || sessionUserType || "owner";

  if (!name || !phone || !workType) {
    return { statusCode: 400, body: { success: false, message: msg.REQUIRED_FIELDS_MISSING } };
  }
  if (String(phone).length !== 10) {
    return { statusCode: 400, body: { success: false, message: msg.PHONE_LENGTH_INVALID } };
  }

  const existingOwner = await Owner.findOne({ where: { phone } });
  if (existingOwner) {
    return { statusCode: 409, body: { success: false, message: "Phone already registered. Log in using OTP.", isRegistered: true } };
  }

  const location = await getLocationData({ pincode, district, state, area, postOffice });

  // Find or create the users row
  let userRow = await User.findOne({ where: { phone } });
  if (!userRow) {
    userRow = await User.create({
      name, phone, registeredAs: resolvedRegisteredFrom, status: 1,
      age: age ? Number(age) : null, gender: gender || null, profileImage: profileImage || null,
      city: city || null, village: village || null,
      district: location.district || null, state: location.state || null,
      pincode: location.pincode || null, area: location.area || null,
      postOffice: location.postOffice || null, address: address || null,
    });
  }

  const data = await Owner.create({
    userId: userRow.id,
    name, phone,
    workType: normalizeWorkType(workType),
    categoryId: categoryId || null,
    skillId: skillId || null,
    isActive: true,
    registeredFrom: resolvedRegisteredFrom,
    status: 1,
  });

  return buildOwnerSession(data, sessionUserType, msg.OWNER_CREATED_SUCCESSFULLY, 201);
};

const getAllOwnersService = async ({ page = 1, limit = 20, search = "" } = {}) => {
  const { Op } = db.Sequelize;
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (pageNumber - 1) * pageLimit;
  const term = String(search || "").trim();
  const where = {
    registeredFrom: { [Op.in]: [ROLE_TYPES.OWNER, ROLE_TYPES.CONTRACTOR_CUSTOMER] },
  };

  if (term) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${term}%` } },
      { phone: { [Op.iLike]: `%${term}%` } },
      db.Sequelize.where(
        db.Sequelize.cast(db.Sequelize.col("workType"), "text"),
        { [Op.iLike]: `%${term}%` }
      ),
      { "$user.district$": { [Op.iLike]: `%${term}%` } },
      { "$user.state$": { [Op.iLike]: `%${term}%` } },
      { "$user.area$": { [Op.iLike]: `%${term}%` } },
    ];
  }

  const result = await Owner.findAndCountAll({
    where,
    include: ownerInclude,
    distinct: true,
    subQuery: false,
    order: [["id", "DESC"]],
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
      data: result.rows.map(mapOwnerWithUser),
    },
  };
};

const getOwnerByIdService = async (id) => {
  if (!id) {
    return { statusCode: 400, body: { success: false, message: "Owner id is required" } };
  }
  const data = await Owner.findOne({ where: { id }, include: ownerInclude });
  if (!data) {
    return { statusCode: 404, body: { success: false, message: msg.OWNER_NOT_FOUND } };
  }
  return { statusCode: 200, body: { success: true, data: mapOwnerWithUser(data) } };
};

const updateOwnerService = async (id, payload) => {
  const owner = await Owner.findOne({ where: { id } });
  if (!owner) {
    return { statusCode: 404, body: { success: false, message: msg.OWNER_NOT_FOUND } };
  }

  if (payload.phone) {
    const existingOwner = await Owner.findOne({ where: { phone: payload.phone } });
    if (existingOwner && existingOwner.id != id) {
      return { statusCode: 400, body: { success: false, message: msg.PHONE_ALREADY_REGISTERED } };
    }
  }

  // Update owner-specific fields
  const ownerUpdate = {};
  if (payload.name !== undefined) ownerUpdate.name = payload.name;
  if (payload.phone !== undefined) ownerUpdate.phone = payload.phone;
  if (payload.workType !== undefined) ownerUpdate.workType = normalizeWorkType(payload.workType);
  if (payload.categoryId !== undefined) ownerUpdate.categoryId = payload.categoryId || null;
  if (payload.skillId !== undefined) ownerUpdate.skillId = payload.skillId || null;
  if (payload.isActive !== undefined) ownerUpdate.isActive = payload.isActive;
  if (payload.status !== undefined) ownerUpdate.status = payload.status;
  if (Object.keys(ownerUpdate).length > 0) {
    await Owner.update(ownerUpdate, { where: { id } });
  }

  // Update personal/location data in users table
  if (owner.userId) {
    const location = await getLocationData(payload);
    const userUpdate = {};
    if (payload.name !== undefined) userUpdate.name = payload.name;
    if (payload.age !== undefined) userUpdate.age = Number(payload.age);
    if (payload.gender !== undefined) userUpdate.gender = payload.gender;
    if (payload.profileImage !== undefined) userUpdate.profileImage = payload.profileImage;
    if (payload.city !== undefined) userUpdate.city = payload.city;
    if (payload.village !== undefined) userUpdate.village = payload.village;
    if (location.district) userUpdate.district = location.district;
    if (location.state) userUpdate.state = location.state;
    if (location.pincode) userUpdate.pincode = location.pincode;
    if (location.postOffice) userUpdate.postOffice = location.postOffice;
    if (location.area) userUpdate.area = location.area;
    if (payload.address !== undefined) userUpdate.address = payload.address;
    if (Object.keys(userUpdate).length > 0) {
      await User.update(userUpdate, { where: { id: owner.userId } });
    }
  }

  const updatedOwner = await Owner.findOne({ where: { id }, include: ownerInclude });
  return {
    statusCode: 200,
    body: { success: true, message: msg.OWNER_UPDATED_SUCCESSFULLY, data: mapOwnerWithUser(updatedOwner) },
  };
};

const deleteOwnerService = async (id) => {
  const owner = await Owner.findOne({ where: { id } });
  if (!owner) {
    return { statusCode: 404, body: { success: false, message: msg.OWNER_NOT_FOUND } };
  }
  await Owner.destroy({ where: { id } });
  return { statusCode: 200, body: { success: true, message: msg.OWNER_DELETED_SUCCESSFULLY } };
};

module.exports = {
  createOwnerService,
  getAllOwnersService,
  getOwnerByIdService,
  updateOwnerService,
  deleteOwnerService,
};
