const db = require("../../model/index");
const { generateSession } = require("../../middleware/auth");
const crypto = require("crypto");

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

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const isPasswordLengthValid = (password) => {
  const length = String(password || "").length;
  return length >= 4 && length <= 14;
};

const registerService = async (payload) => {
  const {
    name,
    phone,
    password,
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

  if (!name || !phone || !role || !password) {
    return { statusCode: 400, body: { success: false, message: "Name, phone number, role, and password are required" } };
  }
  if (!isPasswordLengthValid(password)) {
    return { statusCode: 400, body: { success: false, message: "Password must be between 4 and 14 characters" } };
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
      passwordHash: hashPassword(password),
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
    let userCode = null;

    if (role === "labour") {
      // Generate unique LAB-XXXXXX code before creating the record
      for (let i = 0; i < 8; i++) {
        const code = `LAB-${Math.floor(100000 + Math.random() * 900000)}`;
        const exists = await Labour.findOne({ where: { labourCode: code }, transaction: t });
        if (!exists) { userCode = code; break; }
      }
      if (!userCode) userCode = `LAB-${Date.now().toString().slice(-6)}`;

      newProfile = await Labour.create({
        userId: newUser.id,
        labourCode: userCode,
        isAvailable: true,
        isVerified: false,
        registeredFrom: "labour",
      }, { transaction: t });

      // labourProfile must exist before LabourSkill (FK: labourSkills.labourUserId → labourProfiles.userId)
      await db.labourProfile.create({
        userId: newUser.id,
        userCode,
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

      return { user: newUser, profileRecord: newProfile, appRoleCode, userCode };
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
      userCode: profileRecord.labourCode || null,
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
const completeLabourProfileService = async ({ userId, userType, isSessionAuth, skills, skillWages, experienceYears, age, gender, city, state, district, pincode, area, postOffice, address, stateId, districtId, pincodeId, postOfficeId }) => {
  if (!skills || !Array.isArray(skills) || skills.length === 0) {
    return { statusCode: 400, body: { success: false, message: "Select at least one worker skill" } };
  }

  if (isSessionAuth) {
    const globalUser = await User.findByPk(userId);
    if (!globalUser) return { statusCode: 404, body: { success: false, message: "User not found" } };
    const existingLabour = await Labour.findOne({ where: { userId: globalUser.id } });
    const resolvedAge = age ?? globalUser.age;
    const resolvedGender = gender ?? globalUser.gender;
    if (!existingLabour && (!resolvedAge || !resolvedGender)) {
      return { statusCode: 400, body: { success: false, message: "Age and gender are required when creating a labour profile" } };
    }
    const labour = await db.sequelize.transaction(async (transaction) => {
      const requestedSkillIds = skills
        .map((item) => typeof item === "object" ? item.skillId ?? item.id : item)
        .filter((value) => /^\d+$/.test(String(value || "")))
        .map(Number);
      const requestedSkillNames = skills
        .map((item) => typeof item === "object" ? item.skillName ?? item.name : item)
        .filter((value) => value && !/^\d+$/.test(String(value)))
        .map((value) => String(value).trim());
      const skillRows = await db.skill.findAll({
        where: {
          isActive: true,
          [db.Sequelize.Op.or]: [
            ...(requestedSkillIds.length ? [{ id: { [db.Sequelize.Op.in]: requestedSkillIds } }] : []),
            ...requestedSkillNames.map((name) => ({ skillName: { [db.Sequelize.Op.iLike]: name } })),
          ],
        },
        transaction,
      });
      const existingSkillRows = existingLabour
        ? await LabourSkill.findAll({
            where: {
              [db.Sequelize.Op.or]: [
                { labourUserId: globalUser.id },
                { labourId: existingLabour.id },
              ],
            },
            transaction,
          })
        : [];
      const existingSkillById = new Map(
        existingSkillRows.map((row) => [Number(row.skillId), row]),
      );
      const byId = new Map(skillRows.map((row) => [Number(row.id), row]));
      const byName = new Map(skillRows.map((row) => [String(row.skillName).trim().toLowerCase(), row]));
      const resolvedSkills = [];
      const seenSkillIds = new Set();
      const wageByName = Object.entries(skillWages || {}).reduce((map, [name, wage]) => {
        map.set(String(name).trim().toLowerCase(), wage);
        return map;
      }, new Map());

      for (const item of skills) {
        const rawId = typeof item === "object" ? item.skillId ?? item.id : item;
        const rawName = typeof item === "object" ? item.skillName ?? item.name : item;
        const skillRow = /^\d+$/.test(String(rawId || ""))
          ? byId.get(Number(rawId))
          : byName.get(String(rawName || "").trim().toLowerCase());
        if (!skillRow) {
          const error = new Error(`Skill not found or inactive: ${rawName || rawId}`);
          error.statusCode = 400;
          throw error;
        }
        if (seenSkillIds.has(Number(skillRow.id))) continue;
        seenSkillIds.add(Number(skillRow.id));
        const existingSkill = existingSkillById.get(Number(skillRow.id));
        const itemWage = typeof item === "object" ? item.dailyWage ?? item.wage : undefined;
        const resolvedWage = Number(
          itemWage ??
          wageByName.get(String(skillRow.skillName).trim().toLowerCase()) ??
          existingSkill?.dailyWage ??
          skillRow.defaultWage ??
          0,
        );
        const resolvedExperience = Number(
          (typeof item === "object" ? item.experienceYears : undefined) ??
          experienceYears ??
          existingSkill?.experienceYears ??
          0,
        );
        if (!Number.isFinite(resolvedWage) || resolvedWage < 0 || !Number.isFinite(resolvedExperience) || resolvedExperience < 0) {
          const error = new Error(`Invalid wage or experience for skill: ${skillRow.skillName}`);
          error.statusCode = 400;
          throw error;
        }
        resolvedSkills.push({
          skillId: Number(skillRow.id),
          skillName: skillRow.skillName,
          dailyWage: resolvedWage,
          experienceYears: resolvedExperience,
        });
      }

      const userUpdate = {};
      if (resolvedAge) userUpdate.age = Number(resolvedAge);
      if (resolvedGender) userUpdate.gender = resolvedGender;
      if (city !== undefined) userUpdate.city = city;
      if (state !== undefined) userUpdate.state = state;
      if (stateId !== undefined) userUpdate.stateId = stateId;
      if (district !== undefined) userUpdate.district = district;
      if (districtId !== undefined) userUpdate.districtId = districtId;
      if (pincode !== undefined) userUpdate.pincode = pincode;
      if (pincodeId !== undefined) userUpdate.pincodeId = pincodeId;
      if (postOffice !== undefined) userUpdate.postOffice = postOffice;
      if (postOfficeId !== undefined) userUpdate.postOfficeId = postOfficeId;
      if (area !== undefined) userUpdate.area = area;
      if (address !== undefined) userUpdate.address = address;
      if (Object.keys(userUpdate).length > 0) {
        await globalUser.update(userUpdate, { transaction });
      }
      let legacyLabour = existingLabour;
      if (!legacyLabour) {
        let labourCode = null;
        for (let i = 0; i < 8; i++) {
          const candidate = `LAB-${Math.floor(100000 + Math.random() * 900000)}`;
          const exists = await Labour.findOne({ where: { labourCode: candidate }, transaction });
          if (!exists) { labourCode = candidate; break; }
        }
        if (!labourCode) labourCode = `LAB-${Date.now().toString().slice(-6)}`;
        legacyLabour = await Labour.create({
          userId: globalUser.id,
          labourCode,
          isAvailable: true,
          isVerified: false,
          registeredFrom: "labour",
        }, { transaction });
      }
      if (experienceYears !== undefined && Number(experienceYears) !== Number(legacyLabour.experienceYears)) {
        await legacyLabour.update({ experienceYears: Number(experienceYears) }, { transaction });
      }
      const role = await db.appRole.findOne({ where: { code: "LABOUR", isActive: true }, transaction });
      if (!role) throw new Error("Application role LABOUR is not configured");
      await db.userRole.upsert({ userId: globalUser.id, roleId: role.id, profileStatus: "complete" }, { transaction });
      await db.labourProfile.upsert({
        userId: globalUser.id,
        userCode: legacyLabour.labourCode || null,
        experienceYears: legacyLabour.experienceYears || 0,
        isAvailable: legacyLabour.isAvailable !== false,
        verificationStatus: legacyLabour.isVerified ? "verified" : "pending",
      }, { transaction });
      await LabourSkill.destroy({
        where: { [db.Sequelize.Op.or]: [{ labourUserId: globalUser.id }, { labourId: legacyLabour.id }] },
        transaction,
      });
      await LabourSkill.bulkCreate(resolvedSkills.map((item, index) => ({
        labourUserId: globalUser.id,
        labourId: legacyLabour.id,
        skillId: item.skillId,
        dailyWage: item.dailyWage,
        experienceYears: item.experienceYears,
        isPrimary: index === 0,
      })), { transaction });
      return { labour: legacyLabour, resolvedSkills };
    });
    return {
      statusCode: 200,
      body: {
        success: true,
        message: "Labour profile and skills updated successfully",
        profile: labour.labour,
        labourId: labour.labour.id,
        userCode: labour.labour.labourCode,
        skills: labour.resolvedSkills.map((item) => item.skillId),
        skillIds: labour.resolvedSkills.map((item) => item.skillId),
        skillDetails: labour.resolvedSkills,
        skillWages: Object.fromEntries(labour.resolvedSkills.map((item) => [item.skillName, item.dailyWage])),
        experienceYears: Number(labour.labour.experienceYears || 0),
      },
    };
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

  let userCode2 = null;
  for (let i = 0; i < 8; i++) {
    const code = `LAB-${Math.floor(100000 + Math.random() * 900000)}`;
    const exists = await Labour.findOne({ where: { labourCode: code } });
    if (!exists) { userCode2 = code; break; }
  }
  if (!userCode2) userCode2 = `LAB-${Date.now().toString().slice(-6)}`;

  const newLabour = await Labour.create({
    userId: profileRecord.userId || null,
    labourCode: userCode2,
    isAvailable: true,
    isVerified: false,
    registeredFrom: "labour",
  });

  const normalizedSkillIds = [...new Set(skills.map(Number))];
  if (normalizedSkillIds.some((skillId) => !Number.isInteger(skillId) || skillId <= 0)) {
    return { statusCode: 400, body: { success: false, message: "Legacy flow requires valid positive skill IDs" } };
  }
  if (normalizedSkillIds.length > 0) {
    await LabourSkill.bulkCreate(
      normalizedSkillIds.map((skillId) => ({ labourId: newLabour.id, skillId })),
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
