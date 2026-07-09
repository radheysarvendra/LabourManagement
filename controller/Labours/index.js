const labourService = require("./service");

const ADDRESS_FIELDS = new Set([
  "stateId",
  "districtId",
  "pincodeId",
  "postOfficeId",
  "state",
  "district",
  "village",
  "area",
  "postOffice",
  "address",
  "pincode",
]);

const isAddressOnlyPayload = (payload = {}) => {
  const keys = Object.keys(payload);
  return keys.length > 0 && keys.every((key) => ADDRESS_FIELDS.has(key));
};

const pickAddressData = (data = {}) => ({
  id: data.id,
  stateId: data.stateId,
  districtId: data.districtId,
  pincodeId: data.pincodeId,
  postOfficeId: data.postOfficeId,
  state: data.state,
  district: data.district,
  village: data.village,
  postOffice: data.postOffice,
});

const createLabour = async (req,res) => {
  try {
    const result = await labourService.createLabourService(req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const getAllLabours = async (req,res) => {
  try {
    const result = await labourService.getAllLaboursService();
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

const getLabourById = async (req,res) => {
  try {
    const result = await labourService.getLabourByIdService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

const updateLabourById = async (req,res) => {
  try {
    const result = await labourService.updateLabourByIdService(req.params.id, req.body);
    if (result.statusCode < 400 && isAddressOnlyPayload(req.body)) {
      return res.status(result.statusCode).send({
        success: true,
        message: "Address updated successfully",
        data: pickAddressData(result.body.data),
      });
    }
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const searchLabours = async (req,res) => {
  try {
    const result = await labourService.searchLaboursService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const adminSearchLabours = async (req, res) => {
  try {
    const result = await labourService.searchLaboursService({ ...req.query, showAll: true });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  createLabour,
  getAllLabours,
  getLabourById,
  updateLabourById,
  searchLabours,
  adminSearchLabours,
};
