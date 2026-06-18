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

  // Wrap in transaction — if profile creation fails, user row is rolled back
  const { user, profileRecord } = await db.sequelize.transaction(async (t) => {
    const newUser = await User.create({
      name,
      phone: normalizedPhone,
      registeredAs: role,
      status: 1,
      age: age ? Number(age) : null,
      gender: gender || null,
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
    }, { transaction: t });

    let newProfile = null;

    if (role === "labour") {
      newProfile = await Labour.create({
        userId: newUser.id,
        name,
        phone: normalizedPhone,
        isAvailable: true,
        isVerified: false,
        registeredFrom: "labour",
        status: 1,
      }, { transaction: t });

      if (skills && skills.length > 0) {
        await LabourSkill.bulkCreate(
          skills.map((skillId) => ({ labourId: newProfile.id, skillId: Number(skillId) })),
          { transaction: t, ignoreDuplicates: true }
        );
      }
    } else {
      newProfile = await Owner.create({
        userId: newUser.id,
        name,
        phone: normalizedPhone,
        workType: workType || "both",
        isActive: true,
        registeredFrom: role,
        status: 1,
      }, { transaction: t });
    }

    return { user: newUser, profileRecord: newProfile };
  });

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

  // Update users table with labour-specific personal data (age, gender, location)
  if (profileRecord.userId) {
    const userUpdateData = {};
    if (age) userUpdateData.age = Number(age);
    if (gender) userUpdateData.gender = gender;
    if (city) userUpdateData.city = city;
    if (state) userUpdateData.state = state;
    if (stateId) userUpdateData.stateId = stateId;
    if (district) userUpdateData.district = district;
    if (districtId) userUpdateData.districtId = districtId;
    if (pincode) userUpdateData.pincode = pincode;
    if (pincodeId) userUpdateData.pincodeId = pincodeId;
    if (postOffice) userUpdateData.postOffice = postOffice;
    if (postOfficeId) userUpdateData.postOfficeId = postOfficeId;
    if (area) userUpdateData.area = area;
    if (address) userUpdateData.address = address;
    if (Object.keys(userUpdateData).length > 0) {
      await db.user.update(userUpdateData, { where: { id: profileRecord.userId } });
    }
  }

  const newLabour = await Labour.create({
    userId: profileRecord.userId || null,
    name: profileRecord.name,
    phone: profileRecord.phone,
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
