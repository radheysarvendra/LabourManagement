const labourService = require("./service");

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

module.exports = {
  createLabour,
  getAllLabours,
  getLabourById,
  updateLabourById,
  searchLabours,
};
