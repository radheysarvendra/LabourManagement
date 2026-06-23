const db = require("../../model/index");
const { generateSession } = require("../../middleware/auth");

const User = db.user;
const Labour = db.labour;
const Owner = db.owner;
const LabourSkill = db.labourSkill;

const OWNER_ROLES = ["owner", "contractor", "contractor_customer"];
const VALID_ROLES = ["labour", "owner", "contractor", "contractor_customer"];

// Map old role codes to new app role codes
const ROLE_CODE_MAP = {
  labour: "LABOUR",
  owner: "OWNER",
  contractor: "CONTRACTOR",
  contractor_customer: "OWNER",
};

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
    categoryId,
    skillId,
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
  } = payload;

  if (!name || !phone || !role) {
    return { statusCode: 400, body: { success: false, message: "Name, phone number, and role are required" } };
  }

  const normalizedPhone = String(phone).replace(/[^0-9]/g, "").trim();
  if (normalizedPhone.length !== 10) {
    return { statusCode: 400, body: { success: false, message: "Enter a 10-digit mobile number" } };
  }

  if (!VALID_ROLES.includes(role)) {
    return { statusCode: 400, body: { success: false, message: `Invalid role. Valid roles: ${VALID_ROLES.join(", ")}` } };
  }

  if (role === "labour") {
    if (!age || !gender) {
      return { statusCode: 400, body: { success: false, message: "Age and gender are required for worker registration" } };
    }
    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return { statusCode: 400, body: { success: false, message: "Select at least one worker skill" } };
    }
  }

  if (role === "contractor") {
    if (!categoryId || !skillId) {
      return { statusCode: 400, body: { success: false, message: "categoryId and skillId are required for contractor registration" } };
    }
  }

  // Check if phone already exists in users table
  const existingUser = await User.findOne({ where: { phone: normalizedPhone } });
  if (existingUser) {
    return { statusCode: 409, body: { success: false, message: "Phone already registered. Please log in." } };
  }

  // Wrap in transaction — if profile creation fails, user row is rolled back
  const { user, profileRecord, appRoleCode } = await db.sequelize.transaction(async (t) => {
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
      // Generate unique LAB-XXXXXX code before creating the record
      let labourCode = null;
      for (let i = 0; i < 8; i++) {
        const code = `LAB-${Math.floor(100000 + Math.random() * 900000)}`;
        const exists = await Labour.findOne({ where: { labourCode: code } });
        if (!exists) { labourCode = code; break; }
      }
      if (!labourCode) labourCode = `LAB-${Date.now().toString().slice(-6)}`;

      newProfile = await Labour.create({
        userId: newUser.id,
        labourCode,
        isAvailable: true,
        isVerified: false,
        registeredFrom: "labour",
      }, { transaction: t });

      // labourProfile must exist before LabourSkill (FK: labourSkills.labourUserId → labourProfiles.userId)
      await db.labourProfile.create({
        userId: newUser.id,
        labourCode,
        experienceYears: 0,
        isAvailable: true,
        verificationStatus: "pending",
      }, { transaction: t });

      if (skills && skills.length > 0) {
        await LabourSkill.bulkCreate(
          skills.map((skillId) => ({ labourUserId: newUser.id, labourId: newProfile.id, skillId: Number(skillId) })),
          { transaction: t, ignoreDuplicates: true }
        );
      }
    } else {
      newProfile = await Owner.create({
        userId: newUser.id,
        workType: workType || "both",
        categoryId: categoryId || null,
        skillId: skillId || null,
        registeredFrom: role,
      }, { transaction: t });
    }

    const appRoleCode = ROLE_CODE_MAP[role];
    const appRole = await db.appRole.findOne({
      where: { code: appRoleCode, isActive: true },
      transaction: t,
    });
    if (!appRole) throw new Error(`Application role ${appRoleCode} is not configured`);

    await db.userRole.create({
      userId: newUser.id,
      roleId: appRole.id,
      profileStatus: "complete",
    }, { transaction: t });

    if (role === "contractor") {
      await db.contractorProfile.create({
        userId: newUser.id,
        experienceYears: 0,
        isAvailable: true,
        verificationStatus: "pending",
      }, { transaction: t });
      await db.contractorSkill.create({
        contractorUserId: newUser.id,
        skillId: Number(skillId),
        experienceYears: 0,
      }, { transaction: t });
      await db.contractorCategory.create({
        contractorUserId: newUser.id,
        categoryId: Number(categoryId),
      }, { transaction: t });
    }

    return { user: newUser, profileRecord: newProfile, appRoleCode };
  });

  const { token } = await generateSession(user.id, appRoleCode);

  return {
    statusCode: 201,
    body: {
      success: true,
      message: "Registration successful",
      token,
      type: role,
      userType: role,
      userId: user.id,
      labourId: role === "labour" ? profileRecord.id : null,
      ownerId: OWNER_ROLES.includes(role) ? profileRecord.id : null,
      globalUserId: user.id,
      activeRole: appRoleCode,
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
const completeOwnerProfileService = async ({ userId, userType, isSessionAuth, workType, categoryId, skillId, city, state, district, pincode, area, postOffice, address }) => {
  if (isSessionAuth) {
    const globalUser = await User.findByPk(userId);
    if (!globalUser) return { statusCode: 404, body: { success: false, message: "User not found" } };
    const owner = await db.sequelize.transaction(async (transaction) => {
      const [legacyOwner] = await Owner.findOrCreate({
        where: { userId: globalUser.id },
        defaults: {
          workType: workType || "both",
          categoryId: categoryId || null, skillId: skillId || null,
          registeredFrom: "owner",
        },
        transaction,
      });
      const role = await db.appRole.findOne({ where: { code: "OWNER", isActive: true }, transaction });
      if (!role) throw new Error("Application role OWNER is not configured");
      await db.userRole.upsert({ userId: globalUser.id, roleId: role.id, profileStatus: "complete" }, { transaction });
      return legacyOwner;
    });
    return { statusCode: 200, body: { success: true, message: "Owner profile complete", profile: owner } };
  }
  const profileRecord = userType === "labour"
    ? await Labour.findOne({ where: { id: userId } })
    : await Owner.findOne({ where: { id: userId } });

  if (!profileRecord) {
    return { statusCode: 404, body: { success: false, message: "User not found" } };
  }

  const existing = await Owner.findOne({ where: { userId: profileRecord.userId } });
  if (existing) {
    return { statusCode: 200, body: { success: true, message: "Owner profile already exists", profile: existing } };
  }

  const newOwner = await Owner.create({
    userId: profileRecord.userId || null,
    workType: workType || "both",
    categoryId: categoryId || null,
    skillId: skillId || null,
    registeredFrom: "owner",
  });

  return {
    statusCode: 201,
    body: { success: true, message: "Owner profile complete", profile: newOwner },
  };
};

// Called when an owner user wants to use labour role for the first time
const completeLabourProfileService = async ({ userId, userType, isSessionAuth, skills, age, gender, city, state, district, pincode, area, postOffice, address, stateId, districtId, pincodeId, postOfficeId }) => {
  if (!age || !gender) {
    return { statusCode: 400, body: { success: false, message: "Age and gender are required" } };
  }
  if (!skills || !Array.isArray(skills) || skills.length === 0) {
    return { statusCode: 400, body: { success: false, message: "Select at least one worker skill" } };
  }

  if (isSessionAuth) {
    const globalUser = await User.findByPk(userId);
    if (!globalUser) return { statusCode: 404, body: { success: false, message: "User not found" } };
    const labour = await db.sequelize.transaction(async (transaction) => {
      await globalUser.update({
        age: Number(age), gender, city: city || globalUser.city, state: state || globalUser.state,
        stateId: stateId || globalUser.stateId, district: district || globalUser.district,
        districtId: districtId || globalUser.districtId, pincode: pincode || globalUser.pincode,
        pincodeId: pincodeId || globalUser.pincodeId, postOffice: postOffice || globalUser.postOffice,
        postOfficeId: postOfficeId || globalUser.postOfficeId, area: area || globalUser.area,
        address: address || globalUser.address,
      }, { transaction });
      const [legacyLabour] = await Labour.findOrCreate({
        where: { userId: globalUser.id },
        defaults: {
          isAvailable: true,
          isVerified: false, registeredFrom: "labour",
        },
        transaction,
      });
      const role = await db.appRole.findOne({ where: { code: "LABOUR", isActive: true }, transaction });
      if (!role) throw new Error("Application role LABOUR is not configured");
      await db.userRole.upsert({ userId: globalUser.id, roleId: role.id, profileStatus: "complete" }, { transaction });
      await db.labourProfile.upsert({
        userId: globalUser.id, labourCode: legacyLabour.labourCode || null,
        experienceYears: legacyLabour.experienceYears || 0,
        isAvailable: true, verificationStatus: legacyLabour.isVerified ? "verified" : "pending",
      }, { transaction });
      await LabourSkill.bulkCreate(skills.map((sid) => ({
        labourUserId: globalUser.id, labourId: legacyLabour.id, skillId: Number(sid),
      })), { transaction, ignoreDuplicates: true });
      return legacyLabour;
    });
    return { statusCode: 200, body: { success: true, message: "Labour profile complete", profile: labour } };
  }

  const profileRecord = userType === "owner" || userType === "contractor" || userType === "contractor_customer"
    ? await Owner.findOne({ where: { id: userId } })
    : await Labour.findOne({ where: { id: userId } });

  if (!profileRecord) {
    return { statusCode: 404, body: { success: false, message: "User not found" } };
  }

  const existing = await Labour.findOne({ where: { userId: profileRecord.userId } });
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

  let labourCode2 = null;
  for (let i = 0; i < 8; i++) {
    const code = `LAB-${Math.floor(100000 + Math.random() * 900000)}`;
    const exists = await Labour.findOne({ where: { labourCode: code } });
    if (!exists) { labourCode2 = code; break; }
  }
  if (!labourCode2) labourCode2 = `LAB-${Date.now().toString().slice(-6)}`;

  const newLabour = await Labour.create({
    userId: profileRecord.userId || null,
    labourCode: labourCode2,
    isAvailable: true,
    isVerified: false,
    registeredFrom: "labour",
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
