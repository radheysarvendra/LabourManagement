const db = require("../../model/index");
const { generateToken, saveToken } = require("../../middleware/auth");

const User = db.user;
const Labour = db.labour;
const Owner = db.owner;
const LabourSkill = db.labourSkill;

const OWNER_ROLES = ["owner", "contractor", "contractor_customer"];
const VALID_ROLES = ["labour", "owner", "contractor", "contractor_customer"];

const registerService = async (payload) => {
  const {
    name,
    phone,
    role,
    skills,
    age,
    gender,
    city,
    state,
    district,
    pincode,
    area,
    postOffice,
    address,
    workType,
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
  } = payload;

  if (!name || !phone || !role) {
    return { statusCode: 400, body: { success: false, message: "name, phone aur role required hai" } };
  }

  const normalizedPhone = String(phone).replace(/[^0-9]/g, "").trim();
  if (normalizedPhone.length !== 10) {
    return { statusCode: 400, body: { success: false, message: "10 digit mobile number required" } };
  }

  if (!VALID_ROLES.includes(role)) {
    return { statusCode: 400, body: { success: false, message: `Invalid role. Valid roles: ${VALID_ROLES.join(", ")}` } };
  }

  if (role === "labour") {
    if (!age || !gender) {
      return { statusCode: 400, body: { success: false, message: "Labour registration ke liye age aur gender required hai" } };
    }
    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return { statusCode: 400, body: { success: false, message: "Labour registration ke liye kam se kam ek skill required hai" } };
    }
  }

  // Check if phone already exists in users table
  const existingUser = await User.findOne({ where: { phone: normalizedPhone } });
  if (existingUser) {
    return { statusCode: 409, body: { success: false, message: "Phone already registered hai. Login karein." } };
  }

  // Also check labours and owners for backward compat
  const [existingLabour, existingOwner] = await Promise.all([
    Labour.findOne({ where: { phone: normalizedPhone } }),
    Owner.findOne({ where: { phone: normalizedPhone } }),
  ]);

  if (existingLabour || existingOwner) {
    return { statusCode: 409, body: { success: false, message: "Phone already registered hai. Login karein." } };
  }

  // Create user in users table
  const user = await User.create({
    name,
    phone: normalizedPhone,
    registeredAs: role,
    status: 1,
  });

  let profileRecord = null;

  if (role === "labour") {
    profileRecord = await Labour.create({
      userId: user.id,
      name,
      phone: normalizedPhone,
      age: Number(age),
      gender,
      city: city || null,
      state: state || null,
      stateId: stateId || null,
      district: district || null,
      districtId: districtId || null,
      pincode: pincode || null,
      pincodeId: pincodeId || null,
      postOffice: postOffice || null,
      postOfficeId: postOfficeId || null,
      area: area || null,
      address: address || null,
      isAvailable: true,
      isVerified: false,
      registeredFrom: "labour",
      status: 1,
    });

    if (skills && skills.length > 0) {
      await LabourSkill.bulkCreate(
        skills.map((skillId) => ({ labourId: profileRecord.id, skillId: Number(skillId) })),
        { ignoreDuplicates: true }
      );
    }
  } else {
    profileRecord = await Owner.create({
      userId: user.id,
      name,
      phone: normalizedPhone,
      workType: workType || "both",
      city: city || null,
      state: state || null,
      district: district || null,
      pincode: pincode || null,
      area: area || null,
      postOffice: postOffice || null,
      address: address || null,
      age: age ? Number(age) : null,
      gender: gender || null,
      isActive: true,
      registeredFrom: role,
      status: 1,
    });
  }

  const token = generateToken(profileRecord, role);
  await saveToken(profileRecord, token, role);

  return {
    statusCode: 201,
    body: {
      success: true,
      message: "Registration successful",
      token,
      type: role,
      userType: role,
      userId: profileRecord.id,
      labourId: role === "labour" ? profileRecord.id : null,
      ownerId: OWNER_ROLES.includes(role) ? profileRecord.id : null,
      globalUserId: user.id,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        registeredAs: user.registeredAs,
      },
      profile: profileRecord,
      roles: [role],
      isRegistered: true,
    },
  };
};

// Called when a labour user wants to use owner role for the first time
const completeOwnerProfileService = async ({ userId, userType, workType, city, state, district, pincode, area, postOffice, address }) => {
  const profileRecord = userType === "labour"
    ? await Labour.findOne({ where: { id: userId } })
    : await Owner.findOne({ where: { id: userId } });

  if (!profileRecord) {
    return { statusCode: 404, body: { success: false, message: "User not found" } };
  }

  const existing = await Owner.findOne({ where: { phone: profileRecord.phone } });
  if (existing) {
    return { statusCode: 200, body: { success: true, message: "Owner profile already exists", profile: existing } };
  }

  const newOwner = await Owner.create({
    userId: profileRecord.userId || null,
    name: profileRecord.name,
    phone: profileRecord.phone,
    workType: workType || "both",
    city: city || profileRecord.city || null,
    state: state || profileRecord.state || null,
    district: district || profileRecord.district || null,
    pincode: pincode || profileRecord.pincode || null,
    area: area || profileRecord.area || null,
    postOffice: postOffice || profileRecord.postOffice || null,
    address: address || profileRecord.address || null,
    age: profileRecord.age || null,
    gender: profileRecord.gender || null,
    isActive: true,
    registeredFrom: "owner",
    status: 1,
  });

  return {
    statusCode: 201,
    body: { success: true, message: "Owner profile complete", profile: newOwner },
  };
};

// Called when an owner user wants to use labour role for the first time
const completeLabourProfileService = async ({ userId, userType, skills, age, gender, city, state, district, pincode, area, postOffice, address, stateId, districtId, pincodeId, postOfficeId }) => {
  if (!age || !gender) {
    return { statusCode: 400, body: { success: false, message: "age aur gender required hai" } };
  }
  if (!skills || !Array.isArray(skills) || skills.length === 0) {
    return { statusCode: 400, body: { success: false, message: "Kam se kam ek skill required hai" } };
  }

  const profileRecord = userType === "owner" || userType === "contractor" || userType === "contractor_customer"
    ? await Owner.findOne({ where: { id: userId } })
    : await Labour.findOne({ where: { id: userId } });

  if (!profileRecord) {
    return { statusCode: 404, body: { success: false, message: "User not found" } };
  }

  const existing = await Labour.findOne({ where: { phone: profileRecord.phone } });
  if (existing) {
    return { statusCode: 200, body: { success: true, message: "Labour profile already exists", profile: existing } };
  }

  const newLabour = await Labour.create({
    userId: profileRecord.userId || null,
    name: profileRecord.name,
    phone: profileRecord.phone,
    age: Number(age),
    gender,
    city: city || profileRecord.city || null,
    state: state || profileRecord.state || null,
    stateId: stateId || null,
    district: district || profileRecord.district || null,
    districtId: districtId || null,
    pincode: pincode || profileRecord.pincode || null,
    pincodeId: pincodeId || null,
    postOffice: postOffice || profileRecord.postOffice || null,
    postOfficeId: postOfficeId || null,
    area: area || profileRecord.area || null,
    address: address || profileRecord.address || null,
    isAvailable: true,
    isVerified: false,
    registeredFrom: "labour",
    status: 1,
  });

  if (skills && skills.length > 0) {
    await LabourSkill.bulkCreate(
      skills.map((skillId) => ({ labourId: newLabour.id, skillId: Number(skillId) })),
      { ignoreDuplicates: true }
    );
  }

  return {
    statusCode: 201,
    body: { success: true, message: "Labour profile complete", profile: newLabour },
  };
};

module.exports = {
  registerService,
  completeOwnerProfileService,
  completeLabourProfileService,
};
