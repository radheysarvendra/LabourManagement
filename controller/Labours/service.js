const { Op } = require("sequelize");
const db = require("../../model/index.js");
const { generateToken, saveToken } = require("../../middleware/auth/index");
const msg = require("../../constants/Messages");
const { getPincodeDetails } = require("../../utils/indiaPost");

const Labour = db.labour;
const Skill = db.skill;
const LabourSkill = db.labourSkill;

const normalizeText = (value) => String(value || "").trim().toLowerCase();

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
    district,
    state,
    pincode,
    area,
    postOffice,
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
  const skillList = buildSkillList({ skill, skills });

  const data = await Labour.create({
    name,
    phone,
    city,
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
  const skillList = buildSkillList(payload);

  await Labour.update(
    {
      ...payload,
      village: undefined,
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

const searchLaboursService = async ({ pincode, district, skill }) => {
  const location = pincode ? await getLocationData({ pincode, district }) : { district };
  const where = { isAvailable: true };
  const locationFilters = [];

  if (location.pincode) {
    locationFilters.push({ pincode: location.pincode });
  }

  if (location.district) {
    locationFilters.push({ district: { [Op.iLike]: location.district } });
  }

  if (locationFilters.length > 0) {
    where[Op.or] = locationFilters;
  }

  const labours = await Labour.findAll({ where, include: labourInclude });
  const requestedSkill = normalizeText(skill);

  const data = labours
    .map((labour) => {
      const json = mapLabourWithSkills(labour);
      const labourSkills = Array.isArray(json.skills) ? json.skills : [];
      const hasSkillMatch = requestedSkill
        ? labourSkills.some((item) => normalizeText(item) === requestedSkill)
        : false;
      const samePincode = location.pincode && json.pincode === location.pincode;
      const sameDistrict =
        location.district && normalizeText(json.district) === normalizeText(location.district);

      return {
        ...json,
        matchScore: Number(hasSkillMatch) * 100 + Number(samePincode) * 10 + Number(sameDistrict),
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name));

  return {
    statusCode: 200,
    body: {
      success: true,
      total: data.length,
      meta: {
        pincode: location.pincode || null,
        district: location.district || null,
        state: location.state || null,
        areaNames: location.areaNames || [],
        postOffice: location.postOfficeList || [],
        skill: skill || null,
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
