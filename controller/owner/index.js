const ownerService = require("./service");

const createOwner = async (req,res) => {
  try {
    const result = await ownerService.createOwnerService(req.body);
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
