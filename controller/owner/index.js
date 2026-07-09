const ownerService = require("./service");

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

const createOwner = async (req,res) => {
  try {
    const result = await ownerService.createOwnerService(req.body);
    if (req.originalUrl?.startsWith("/api/admin/owners")) {
      return res.status(result.statusCode).send({
        success: result.body.success,
        message: "Owner created successfully",
        data: { id: result.body.data?.id },
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

const getAllOwners = async (req,res) => {
  try {
    const result = await ownerService.getAllOwnersService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

const getOwnerById = async (req,res) => {
  try {
    const result = await ownerService.getOwnerByIdService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

const updateOwner = async (req,res) => {
  try {
    const result = await ownerService.updateOwnerService(req.params.id, req.body);
    if (result.statusCode < 400 && isAddressOnlyPayload(req.body)) {
      return res.status(result.statusCode).send({
        success: true,
        message: "Address updated successfully",
        data: pickAddressData(result.body.data),
      });
    }
    if (req.originalUrl?.startsWith("/api/admin/owners")) {
      const isStatusRoute = req.originalUrl.endsWith("/status") || req.originalUrl.endsWith("/activate") || req.originalUrl.endsWith("/deactivate");
      return res.status(result.statusCode).send({
        success: result.body.success,
        message: isStatusRoute ? "Owner status updated successfully" : "Owner updated successfully",
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

const deleteOwner = async (req,res) => {
  try {
    const result = await ownerService.deleteOwnerService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  createOwner,
  getAllOwners,
  getOwnerById,
  updateOwner,
  deleteOwner,
};
