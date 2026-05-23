const db = require("../../model/index.js");
const { generateToken, saveToken } = require("../../middleware/auth/index");
const msg = require("../../constants/Messages");
const { getPincodeDetails } = require("../../utils/indiaPost");

const Owner = db.owner;

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

const createOwnerService = async (payload) => {
  const {
    name,
    phone,
    workType,
    village,
    city,
    district,
    state,
    pincode,
    area,
    postOffice,
    address,
    age,
    gender,
    profileImage,
  } = payload;

  if (!name || !phone || !workType) {
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

  const existingOwner = await Owner.findOne({ where: { phone } });

  if (existingOwner) {
    return {
      statusCode: 400,
      body: { success: false, message: msg.PHONE_ALREADY_REGISTERED },
    };
  }

  const location = await getLocationData({ pincode, district, state, area, postOffice });

  const data = await Owner.create({
    name,
    phone,
    workType: normalizeWorkType(workType),
    village,
    city: city || location.district,
    district: location.district,
    state: location.state,
    pincode: location.pincode,
    area: location.area,
    postOffice: location.postOffice,
    address,
    age,
    gender,
    profileImage,
  });

  const token = generateToken(data, "owner");
  await saveToken(data, token, "owner");

  return {
    statusCode: 201,
    body: {
      success: true,
      message: msg.OWNER_CREATED_SUCCESSFULLY,
      token,
      data,
    },
  };
};

const getAllOwnersService = async () => {
  const data = await Owner.findAll({
    order: [["id", "DESC"]],
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      total: data.length,
      data,
    },
  };
};

const getOwnerByIdService = async (id) => {
  if (!id) {
    return {
      statusCode: 400,
      body: { success: false, message: "Owner id is required" },
    };
  }

  const data = await Owner.findOne({ where: { id } });

  if (!data) {
    return {
      statusCode: 404,
      body: { success: false, message: msg.OWNER_NOT_FOUND },
    };
  }

  return {
    statusCode: 200,
    body: { success: true, data },
  };
};

const updateOwnerService = async (id, payload) => {
  const owner = await Owner.findOne({ where: { id } });

  if (!owner) {
    return {
      statusCode: 404,
      body: { success: false, message: msg.OWNER_NOT_FOUND },
    };
  }

  if (payload.phone) {
    const existingOwner = await Owner.findOne({ where: { phone: payload.phone } });

    if (existingOwner && existingOwner.id != id) {
      return {
        statusCode: 400,
        body: { success: false, message: msg.PHONE_ALREADY_REGISTERED },
      };
    }
  }

  const location = await getLocationData(payload);

  await Owner.update(
    {
      ...payload,
      workType: payload.workType ? normalizeWorkType(payload.workType) : undefined,
      city: payload.city || location.district,
      district: location.district,
      state: location.state,
      pincode: location.pincode,
      area: location.area,
      postOffice: location.postOffice,
    },
    { where: { id } }
  );

  const updatedOwner = await Owner.findOne({ where: { id } });

  return {
    statusCode: 200,
    body: {
      success: true,
      message: msg.OWNER_UPDATED_SUCCESSFULLY,
      data: updatedOwner,
    },
  };
};

const deleteOwnerService = async (id) => {
  const owner = await Owner.findOne({ where: { id } });

  if (!owner) {
    return {
      statusCode: 404,
      body: { success: false, message: msg.OWNER_NOT_FOUND },
    };
  }

  await Owner.destroy({ where: { id } });

  return {
    statusCode: 200,
    body: {
      success: true,
      message: msg.OWNER_DELETED_SUCCESSFULLY,
    },
  };
};

module.exports = {
  createOwnerService,
  getAllOwnersService,
  getOwnerByIdService,
  updateOwnerService,
  deleteOwnerService,
};
