const svc = require("./service");

const createLead = async (req, res) => {
  try {
    const result = await svc.createLeadService({
      ...req.body,
      contractorUserId: req.user?.userId || req.user?.id,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const payLeadFee = async (req, res) => {
  try {
    const result = await svc.payLeadFeeService(
      req.params.id,
      req.user?.userId || req.user?.id
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const payServiceFee = async (req, res) => {
  try {
    const result = await svc.payServiceFeeService(
      req.params.id,
      req.user?.userId || req.user?.id
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getMyLeads = async (req, res) => {
  try {
    const result = await svc.getMyLeadsService(
      req.user?.userId || req.user?.id,
      req.query
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getLeadById = async (req, res) => {
  try {
    const result = await svc.getLeadByIdService(
      req.params.id,
      req.user?.userId || req.user?.id
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getAllLeads = async (req, res) => {
  try {
    const result = await svc.getAllLeadsService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const waiveServiceFee = async (req, res) => {
  try {
    const result = await svc.waiveServiceFeeService(req.params.id, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

module.exports = {
  createLead,
  payLeadFee,
  payServiceFee,
  getMyLeads,
  getLeadById,
  getAllLeads,
  waiveServiceFee,
};
