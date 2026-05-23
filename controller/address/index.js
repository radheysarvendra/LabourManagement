const addressService = require("./service");

const getStates = async (req,res) => {
  try {
    const result = await addressService.getStatesService();
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const getDistricts = async (req,res) => {
  try {
    const result = await addressService.getDistrictsService(req.params.stateId);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const getPincodeDetails = async (req,res) => {
  try {
    const result = await addressService.getPincodeDetailsService(req.params.pincode);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const createAddress = async (req,res) => {
  try {
    const result = await addressService.createAddressService(req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const getAddressByEntity = async (req,res) => {
  try {
    const result = await addressService.getAddressByEntityService(req.params);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

module.exports = {
  getStates,
  getDistricts,
  getPincodeDetails,
  createAddress,
  getAddressByEntity,
};
