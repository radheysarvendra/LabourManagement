const { Op } = require("sequelize");
const db = require("../../model/index.js");
const { generateToken, saveToken } = require("../../middleware/auth/index");
const msg = require("../../constants/Messages");
const { getPincodeDetails } = require("../../utils/indiaPost");

const Labour = db.labour;
const Skill = db.skill;
const LabourSkill = db.labourSkill;
const State = db.state;
const District = db.district;
const Pincode = db.pincode;
const PostOffice = db.postOffice;

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const generateLabourCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `LAB-${Math.floor(100000 + Math.random() * 900000)}`;
    const existing = await Labour.findOne({ where: { labourCode: code } });

    if (!existing) {
      return code;
    }
  }

  return `LAB-${Date.now().toString().slice(-6)}`;
};

const findSelectedPostOffice = (postOfficeList, selectedName) => {
  if (!selectedName) {
    return postOfficeList[0] || null;
  }

  return (
    postOfficeList.find((office) => normalizeText(office.name) === normalizeText(selectedName)) ||
    postOfficeList[0] ||
    null
  );
};

const getPostOfficeName = (postOffice) => {
  if (!postOffice) {
    return null;
  }

  if (typeof postOffice === "string") {
    return postOffice;
  }

  return postOffice.name || postOffice.Name || null;
};

const getLocationData = async ({ pincode, district, state, area, postOffice }) => {
  if (!pincode) {
    return { district, state, area, postOffice };
  }

  const pincodeDetails = await getPincodeDetails(pincode);

  return {
    pincode: pincodeDetails.pincode,
    district: pincodeDetails.district || district,
    state: pincodeDetails.state || state,
    area: area || pincodeDetails.area,
    areaNames: pincodeDetails.areaNames,
    postOffice: getPostOfficeName(postOffice || findSelectedPostOffice(pincodeDetails.postOffice, area)),
    postOfficeList: pincodeDetails.postOffice,
  };
};

const resolveLocationIds = async ({ state, district, pincode, postOffice, stateId, districtId, pincodeId, postOfficeId }) => {
  const result = {
    stateId: stateId || null,
    districtId: districtId || null,
    pincodeId: pincodeId || null,
    postOfficeId: postOfficeId || null,
  };

  if (result.postOfficeId) {
    const postOfficeData = await PostOffice.findOne({
      where: { id: result.postOfficeId },
      include: [{ model: Pincode, as: "pincode", include: [{ model: District, as: "district" }] }],
    });

    if (postOfficeData) {
      result.pincodeId = postOfficeData.pincodeId;
      result.districtId = postOfficeData.pincode?.districtId || result.districtId;
      result.stateId = postOfficeData.pincode?.district?.stateId || result.stateId;
      return result;
    }
  }

  if (result.pincodeId) {
    const pincodeData = await Pincode.findOne({ where: { id: result.pincodeId } });
    if (pincodeData) {
      result.districtId = pincodeData.districtId || result.districtId;
    }
  } else if (pincode) {
    const pincodeData = await Pincode.findOne({ where: { pincode } });
    if (pincodeData) {
      result.pincodeId = pincodeData.id;
      result.districtId = pincodeData.districtId || result.districtId;
    }
  }

  if (!result.districtId && district) {
    const districtData = await District.findOne({
      where: { districtName: { [Op.iLike]: district } },
    });
    result.districtId = districtData?.id || null;
    result.stateId = districtData?.stateId || result.stateId;
  }

  if (!result.stateId && state) {
    const stateData = await State.findOne({
      where: { stateName: { [Op.iLike]: state } },
    });
    result.stateId = stateData?.id || null;
  }

  if (!result.postOfficeId && result.pincodeId && postOffice) {
    const postOfficeData = await PostOffice.findOne({
      where: {
        pincodeId: result.pincodeId,
        postOfficeName: { [Op.iLike]: postOffice },
      },
    });
    result.postOfficeId = postOfficeData?.id || null;
  }

  return result;
};

const buildSkillList = ({ skill, skills }) => {
  if (Array.isArray(skills) && skills.length > 0) {
    return skills;
  }

  return skill ? [skill] : [];
};

const getSkillName = (skillItem) => {
  if (typeof skillItem === "string") {
    return skillItem;
  }

  return skillItem?.skillName || skillItem?.name || skillItem?.skill || "";
};

const getSkillWage = (skillWages, skillName, fallbackWage) => {
  if (!skillWages) {
    return fallbackWage || 0;
  }

  if (Array.isArray(skillWages)) {
    const match = skillWages.find((item) => normalizeText(item.skill) === normalizeText(skillName));
    return Number(match?.wage ?? match?.dailyWage ?? fallbackWage ?? 0);
  }

  return Number(skillWages[skillName] ?? fallbackWage ?? 0);
};

const getSkillItemWage = (skillItem) => {
  if (!skillItem || typeof skillItem === "string") {
    return null;
  }

  return skillItem.wage ?? skillItem.dailyWage ?? skillItem.defaultWage ?? null;
};

const labourInclude = [
  {
    model: LabourSkill,
    as: "labourSkills",
    include: [
      {
        model: Skill,
        as: "skill",
      },
    ],
  },
];

const getLabourSearchInclude = (requestedSkill) => [
  {
    model: LabourSkill,
    as: "labourSkills",
    required: Boolean(requestedSkill),
    include: [
      {
        model: Skill,
        as: "skill",
        required: Boolean(requestedSkill),
        ...(requestedSkill
          ? {
              where: {
                skillName: {
                  [Op.iLike]: requestedSkill,
                },
              },
            }
          : {}),
      },
    ],
  },
];

const mapLabourWithSkills = (labour) => {
  const json = labour.toJSON();
  const labourSkills = Array.isArray(json.labourSkills) ? json.labourSkills : [];

  return {
    ...json,
    skills: labourSkills.map((item) => item.skill?.skillName).filter(Boolean),
    skillWages: labourSkills.map((item) => ({
      skill: item.skill?.skillName,
      dailyWage: item.dailyWage,
      wage: item.dailyWage,
      isPrimary: item.isPrimary,
      experienceYears: item.experienceYears,
      defaultWage: item.skill?.defaultWage,
      category: item.skill?.category,
    })),
  };
};

const createLabourSkillRows = async ({ labourId, skills, skillWages, experienceYears }) => {
  await LabourSkill.destroy({ where: { labourId } });

  const skillMap = new Map();

  for (const item of skills) {
    const skillName = getSkillName(item).trim();

    if (skillName) {
      skillMap.set(normalizeText(skillName), { name: skillName, raw: item });
    }
  }

  const skillList = [...skillMap.values()];

  for (const [index, skillItem] of skillList.entries()) {
    const skillId = typeof skillItem.raw === "object" ? skillItem.raw.skillId || skillItem.raw.id : null;
    const skillData = skillId
      ? await Skill.findOne({ where: { id: skillId } })
      : await Skill.findOne({
        where: {
          skillName: {
            [Op.iLike]: skillItem.name,
          },
        },
      });

    if (!skillData) {
      const error = new Error(`${skillItem.name} skill master table me nahi mila`);
      error.statusCode = 400;
      throw error;
    }

    const itemWage = getSkillItemWage(skillItem.raw);

    await LabourSkill.create({
      labourId,
      skillId: skillData.id,
      dailyWage: Number(itemWage ?? getSkillWage(skillWages, skillData.skillName, skillData.defaultWage)),
      isPrimary: index === 0,
      experienceYears: Number(skillItem.raw?.experienceYears ?? experienceYears ?? 0),
    });
  }
};

const createLabourService = async (payload) => {
  const {
    name,
    phone,
    city,
    village,
    district,
    state,
    pincode,
    area,
    postOffice,
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
    address,
    gender,
    age,
    experienceYears,
    isAvailable,
    skill,
    skills,
    skillWages,
  } = payload;

  if (!name || !phone || !gender || !age) {
    return {
      statusCode: 400,
      body: { success: false, message: msg.REQUIRED_FIELDS_MISSING },
    };
  }

  if (String(phone).length !== 10) {
    return {
      statusCode: 400,
      body: { success: false, message: msg.PHONE_LENGTH_INVALID },
    };
  }

  const existingPhone = await Labour.findOne({ where: { phone } });

  if (existingPhone) {
    return {
      statusCode: 400,
      body: { success: false, message: msg.PHONE_EXIST },
    };
  }

  const location = await getLocationData({ pincode, district, state, area, postOffice });
  const locationIds = await resolveLocationIds({
    state: location.state,
    district: location.district,
    pincode: location.pincode,
    postOffice: location.postOffice,
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
  });
  const skillList = buildSkillList({ skill, skills });

  const data = await Labour.create({
    labourCode: await generateLabourCode(),
    name,
    phone,
    status: 1,
    city,
    village,
    stateId: locationIds.stateId,
    districtId: locationIds.districtId,
    pincodeId: locationIds.pincodeId,
    postOfficeId: locationIds.postOfficeId,
    district: location.district,
    state: location.state,
    pincode: location.pincode,
    area: location.area,
    postOffice: location.postOffice,
    address,
    gender,
    age,
    experienceYears,
    isAvailable,
  });

  if (skillList.length > 0) {
    await createLabourSkillRows({
      labourId: data.id,
      skills: skillList,
      skillWages,
      experienceYears,
    });
  }

  const token = generateToken(data, "labour");
  await saveToken(data, token, "labour");
  const createdLabour = await Labour.findOne({ where: { id: data.id }, include: labourInclude });

  return {
    statusCode: 201,
    body: {
      success: true,
      message: msg.LABOUR_CREATED_SUCCESS,
      token,
      data: mapLabourWithSkills(createdLabour),
    },
  };
};

const getAllLaboursService = async () => {
  const data = await Labour.findAll({
    include: labourInclude,
    order: [["id", "DESC"]],
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      total: data.length,
      data: data.map(mapLabourWithSkills),
    },
  };
};

const getLabourByIdService = async (id) => {
  if (!id) {
    return {
      statusCode: 400,
      body: { success: false, message: "Labour id is required" },
    };
  }

  const data = await Labour.findOne({ where: { id }, include: labourInclude });

  if (!data) {
    return {
      statusCode: 404,
      body: { success: false, message: msg.LABOUR_NOT_FOUND },
    };
  }

  return {
    statusCode: 200,
    body: { success: true, data: mapLabourWithSkills(data) },
  };
};

const updateLabourByIdService = async (id, payload) => {
  const labour = await Labour.findOne({ where: { id } });

  if (!labour) {
    return {
      statusCode: 404,
      body: { success: false, message: msg.LABOUR_NOT_FOUND },
    };
  }

  if (payload.phone) {
    const existingPhone = await Labour.findOne({ where: { phone: payload.phone } });

    if (existingPhone && existingPhone.id != id) {
      return {
        statusCode: 400,
        body: { success: false, message: msg.PHONE_EXIST },
      };
    }
  }

  const location = await getLocationData(payload);
  const locationIds = await resolveLocationIds({
    state: location.state,
    district: location.district,
    pincode: location.pincode,
    postOffice: location.postOffice,
    stateId: payload.stateId,
    districtId: payload.districtId,
    pincodeId: payload.pincodeId,
    postOfficeId: payload.postOfficeId,
  });
  const skillList = buildSkillList(payload);

  await Labour.update(
    {
      ...payload,
      stateId: locationIds.stateId,
      districtId: locationIds.districtId,
      pincodeId: locationIds.pincodeId,
      postOfficeId: locationIds.postOfficeId,
      district: location.district,
      state: location.state,
      pincode: location.pincode,
      area: location.area,
      postOffice: location.postOffice,
    },
    { where: { id } }
  );

  if (payload.skill || payload.skills || payload.skillWages) {
    await createLabourSkillRows({
      labourId: id,
      skills: skillList,
      skillWages: payload.skillWages,
      experienceYears: payload.experienceYears,
    });
  }

  const updatedLabour = await Labour.findOne({ where: { id }, include: labourInclude });

  return {
    statusCode: 200,
    body: {
      success: true,
      message: msg.LABOUR_UPDATED_SUCCESS,
      data: mapLabourWithSkills(updatedLabour),
    },
  };
};

const resolveSearchLocation = async ({ stateId, districtId, pincodeId, postOfficeId, pincode, district }) => {
  const location = {
    state: null,
    district: district || null,
    pincode: pincode || null,
    postOffice: null,
  };

  if (stateId) {
    const stateData = await State.findOne({ where: { id: stateId } });
    location.state = stateData?.stateName || null;
  }

  if (districtId) {
    const districtData = await District.findOne({ where: { id: districtId } });
    location.district = districtData?.districtName || location.district;
  }

  if (pincodeId) {
    const pincodeData = await Pincode.findOne({ where: { id: pincodeId } });
    location.pincode = pincodeData?.pincode || location.pincode;
  } else if (pincode) {
    const pincodeDetails = await getLocationData({ pincode, district: location.district });
    location.pincode = pincodeDetails.pincode;
    location.district = pincodeDetails.district || location.district;
    location.state = pincodeDetails.state || location.state;
    location.areaNames = pincodeDetails.areaNames;
    location.postOfficeList = pincodeDetails.postOfficeList;
  }

  if (postOfficeId) {
    const postOfficeData = await PostOffice.findOne({ where: { id: postOfficeId } });
    location.postOffice = postOfficeData?.postOfficeName || null;
  }

  return location;
};

const searchLaboursService = async ({
  stateId,
  districtId,
  pincodeId,
  postOfficeId,
  pincode,
  district,
  skill,
  isVerified,
  verificationStatus,
  page = 1,
  limit = 4,
}) => {
  const pageNumber = Math.max(Number(page) || 1, 1);
  const pageLimit = Math.min(Math.max(Number(limit) || 4, 1), 20);
  const offset = (pageNumber - 1) * pageLimit;
  const location = await resolveSearchLocation({
    stateId,
    districtId,
    pincodeId,
    postOfficeId,
    pincode,
    district,
  });
  const where = { isAvailable: true };
  const baseWhere = { isAvailable: true };
  const verificationValue =
    String(verificationStatus || isVerified || "").toLowerCase().trim();

  if (["true", "verified", "1"].includes(verificationValue)) {
    where.isVerified = true;
    baseWhere.isVerified = true;
  }

  if (["false", "unverified", "0"].includes(verificationValue)) {
    where.isVerified = false;
    baseWhere.isVerified = false;
  }

  if (location.state) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        ...(stateId ? [{ stateId: Number(stateId) }] : []),
        { state: { [Op.iLike]: location.state } },
      ],
    });
  }

  if (location.district) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        ...(districtId ? [{ districtId: Number(districtId) }] : []),
        { district: { [Op.iLike]: location.district } },
      ],
    });
  }

  if (location.pincode) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        ...(pincodeId ? [{ pincodeId: Number(pincodeId) }] : []),
        { pincode: location.pincode },
      ],
    });
  }

  if (location.postOffice) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        ...(postOfficeId ? [{ postOfficeId: Number(postOfficeId) }] : []),
        { postOffice: { [Op.iLike]: location.postOffice } },
      ],
    });
  }

  const requestedSkill = String(skill || "").trim();
  const searchResult = await Labour.findAndCountAll({
    where,
    include: getLabourSearchInclude(requestedSkill),
    distinct: true,
    order: [["createdAt", "DESC"]],
  });

  const sortedData = searchResult.rows
    .map((labour) => {
      const json = mapLabourWithSkills(labour);
      const hasSkillMatch = Boolean(requestedSkill);
      const samePincode = location.pincode && json.pincode === location.pincode;
      const samePostOffice =
        location.postOffice && normalizeText(json.postOffice) === normalizeText(location.postOffice);
      const sameDistrict =
        location.district && normalizeText(json.district) === normalizeText(location.district);

      return {
        ...json,
        hasSkillMatch,
        matchScore:
          Number(hasSkillMatch) * 100 +
          Number(samePostOffice) * 30 +
          Number(samePincode) * 20 +
          Number(sameDistrict) * 10,
      };
    })
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id;
    });
  const data = sortedData.slice(offset, offset + pageLimit);
  const countAndFilters = [];

  if (location.state) {
    countAndFilters.push({
      [Op.or]: [
        ...(stateId ? [{ stateId: Number(stateId) }] : []),
        { state: { [Op.iLike]: location.state } },
      ],
    });
  }

  const stateWhere = countAndFilters.length
    ? { ...baseWhere, [Op.and]: [...countAndFilters] }
    : baseWhere;

  if (location.district) {
    countAndFilters.push({
      [Op.or]: [
        ...(districtId ? [{ districtId: Number(districtId) }] : []),
        { district: { [Op.iLike]: location.district } },
      ],
    });
  }

  const districtWhere = countAndFilters.length
    ? { ...baseWhere, [Op.and]: [...countAndFilters] }
    : stateWhere;

  if (location.pincode) {
    countAndFilters.push({
      [Op.or]: [
        ...(pincodeId ? [{ pincodeId: Number(pincodeId) }] : []),
        { pincode: location.pincode },
      ],
    });
  }

  const pincodeWhere = countAndFilters.length
    ? { ...baseWhere, [Op.and]: [...countAndFilters] }
    : districtWhere;

  if (location.postOffice) {
    countAndFilters.push({
      [Op.or]: [
        ...(postOfficeId ? [{ postOfficeId: Number(postOfficeId) }] : []),
        { postOffice: { [Op.iLike]: location.postOffice } },
      ],
    });
  }

  const postOfficeWhere = countAndFilters.length
    ? { ...baseWhere, [Op.and]: [...countAndFilters] }
    : pincodeWhere;
  const [totalAvailable, stateCount, districtCount, pincodeCount, postOfficeCount] =
    await Promise.all([
      Labour.count({ where: baseWhere }),
      Labour.count({ where: stateWhere }),
      Labour.count({ where: districtWhere }),
      Labour.count({ where: pincodeWhere }),
      Labour.count({ where: postOfficeWhere }),
    ]);

  return {
    statusCode: 200,
    body: {
      success: true,
      total: sortedData.length,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(sortedData.length / pageLimit),
      hasMore: offset + pageLimit < sortedData.length,
      counts: {
        totalAvailable,
        stateCount,
        districtCount,
        pincodeCount,
        postOfficeCount,
        skillCount: searchResult.count,
      },
      meta: {
        pincode: location.pincode || null,
        district: location.district || null,
        state: location.state || null,
        postOfficeName: location.postOffice || null,
        areaNames: location.areaNames || [],
        postOffice: location.postOfficeList || [],
        skill: requestedSkill || null,
        verificationStatus: verificationValue || "all",
      },
      data,
    },
  };
};

module.exports = {
  createLabourService,
  getAllLaboursService,
  getLabourByIdService,
  updateLabourByIdService,
  searchLaboursService,
};
