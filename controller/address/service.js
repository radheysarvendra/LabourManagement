const db = require("../../model");
const { getPincodeDetails } = require("../../utils/indiaPost");

const addressInclude = [
  { model: db.state, as: "state" },
  { model: db.district, as: "district" },
  { model: db.pincode, as: "pincode" },
  { model: db.postOffice, as: "postOffice" },
];

const getStatesService = async () => {
  const data = await db.state.findAll({ order: [["stateName", "ASC"]] });
  return { statusCode: 200, body: { success: true, total: data.length, data } };
};

const getDistrictsService = async (stateId) => {
  const data = await db.district.findAll({ where: { stateId }, order: [["districtName", "ASC"]] });
  return { statusCode: 200, body: { success: true, total: data.length, data } };
};

const getCachedPincode = async (pincode) => {
  return db.pincode.findOne({
    where: { pincode },
    include: [
      { model: db.district, as: "district", include: [{ model: db.state, as: "state" }] },
      { model: db.postOffice, as: "postOffices" },
    ],
  });
};

const mapPincodeResponse = (pincodeData) => ({
  pincodeId: pincodeData.id,
  pincode: pincodeData.pincode,
  districtId: pincodeData.districtId,
  district: pincodeData.district?.districtName || "",
  stateId: pincodeData.district?.stateId || null,
  state: pincodeData.district?.state?.stateName || "",
  postOffice: (pincodeData.postOffices || []).map((office) => ({
    id: office.id,
    name: office.postOfficeName,
    postOfficeName: office.postOfficeName,
    branchType: office.branchType,
    deliveryStatus: office.deliveryStatus,
    block: office.block,
    pincode: pincodeData.pincode,
  })),
});

const getPincodeDetailsService = async (rawPincode) => {
  const pincode = String(rawPincode || "").trim();
  const cached = await getCachedPincode(pincode);

  if (cached) {
    return { statusCode: 200, body: { success: true, cached: true, meta: mapPincodeResponse(cached) } };
  }

  const indiaPost = await getPincodeDetails(pincode);
  const firstOffice = indiaPost.postOffice[0];

  const [state] = await db.state.findOrCreate({
    where: { stateName: indiaPost.state },
    defaults: { stateName: indiaPost.state, stateCode: indiaPost.state.slice(0, 2).toUpperCase(), totalDistricts: 0 },
  });

  const [district] = await db.district.findOrCreate({
    where: { stateId: state.id, districtName: indiaPost.district },
    defaults: { stateId: state.id, districtName: indiaPost.district, districtCode: indiaPost.district.slice(0, 3).toUpperCase() },
  });

  const [pincodeData] = await db.pincode.findOrCreate({
    where: { pincode },
    defaults: {
      districtId: district.id,
      pincode,
      region: firstOffice.region,
      division: firstOffice.division,
      circle: firstOffice.circle,
    },
  });

  for (const office of indiaPost.postOffice) {
    await db.postOffice.findOrCreate({
      where: { pincodeId: pincodeData.id, postOfficeName: office.name },
      defaults: {
        pincodeId: pincodeData.id,
        postOfficeName: office.name,
        branchType: office.branchType,
        deliveryStatus: office.deliveryStatus,
        block: office.block,
      },
    });
  }

  const saved = await getCachedPincode(pincode);
  return { statusCode: 200, body: { success: true, cached: false, meta: mapPincodeResponse(saved) } };
};

const createAddressService = async (payload) => {
  const required = ["stateId", "districtId", "pincodeId", "postOfficeId", "fullAddress", "entityType", "entityId"];
  const missing = required.find((field) => !payload[field]);

  if (missing) {
    return { statusCode: 400, body: { success: false, message: `${missing} is required` } };
  }

  const data = await db.address.create(payload);
  const saved = await db.address.findOne({ where: { id: data.id }, include: addressInclude });
  return { statusCode: 201, body: { success: true, message: "Address saved successfully", data: saved } };
};

const getAddressByEntityService = async ({ entityType, entityId }) => {
  const data = await db.address.findAll({
    where: { entityType, entityId },
    include: addressInclude,
    order: [["id", "DESC"]],
  });

  return { statusCode: 200, body: { success: true, total: data.length, data } };
};

module.exports = {
  getStatesService,
  getDistrictsService,
  getPincodeDetailsService,
  createAddressService,
  getAddressByEntityService,
};
