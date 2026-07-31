const providerService = require("./service");

const searchProviders = async (req, res) => {
  try {
    const result = await providerService.searchProviders(req.query);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const countProviders = async (req, res) => {
  try {
    const result = await providerService.countProviders(req.query);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const listContractors = async (req, res) => {
  try {
    const result = await providerService.searchProviders({ ...req.query, providerType: "contractor" });
    return res.status(200).send(result);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const getContractorById = async (req, res) => {
  try {
    const result = await providerService.getContractorById(req.params.id);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const updateContractor = async (req, res) => {
  try {
    const result = await providerService.updateContractor(req.params.id, req.body);
    if (req.originalUrl?.endsWith("/verification")) {
      return res.status(200).send({ success: true, message: "Contractor verification updated successfully" });
    }
    return res.status(200).send(result);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const getMyContractorProfile = async (req, res) => {
  try {
    const result = await providerService.getContractorById(req.user?.userId || req.user?.id);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const updateMyContractorSkills = async (req, res) => {
  try {
    const result = await providerService.updateMyContractorSkills(
      req.user?.userId || req.user?.id,
      req.body
    );
    return res.status(200).send({
      ...result,
      message: "Contractor categories and skills updated successfully",
    });
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const approveContractor = async (req, res) => {
  try {
    const result = await providerService.updateContractorVerification(req.params.id, "verified", req.admin?.id || null);
    return res.status(200).send({ ...result, message: "Contractor approved successfully" });
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const rejectContractor = async (req, res) => {
  try {
    const result = await providerService.updateContractorVerification(req.params.id, "rejected", req.admin?.id || null);
    return res.status(200).send({ ...result, message: "Contractor rejected successfully" });
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const updateContractorAvailability = async (req, res) => {
  try {
    const result = await providerService.updateContractorAvailability(req.params.id, Boolean(req.body.isAvailable));
    return res.status(200).send({ ...result, message: "Contractor availability updated successfully" });
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const getLabourLocationSkillMatch = async (req, res) => {
  try {
    const result = await providerService.getLabourLocationSkillMatch(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

module.exports = {
  searchProviders,
  countProviders,
  listContractors,
  getContractorById,
  updateContractor,
  getMyContractorProfile,
  updateMyContractorSkills,
  approveContractor,
  rejectContractor,
  updateContractorAvailability,
  getLabourLocationSkillMatch,
};
