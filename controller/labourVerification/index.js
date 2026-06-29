const svc = require("./service");

const submitVerification = async (req, res) => {
  try {
    const result = await svc.submitVerificationService({
      userId:                  req.user?.userId || req.user?.id,
      aadharNumber:            req.body.aadharNumber,
      documentUrl:             req.body.documentUrl,
      cloudinaryPublicId:      req.body.cloudinaryPublicId,
      photoUrl:                req.body.photoUrl,
      photoCloudinaryPublicId: req.body.photoCloudinaryPublicId,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getMyVerificationStatus = async (req, res) => {
  try {
    const result = await svc.getMyVerificationStatusService(
      req.user?.userId || req.user?.id
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getVerifications = async (req, res) => {
  try {
    const result = await svc.getVerificationsService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const approveVerification = async (req, res) => {
  try {
    const result = await svc.approveVerificationService(
      req.params.userId,
      req.admin?.id
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const rejectVerification = async (req, res) => {
  try {
    const result = await svc.rejectVerificationService(req.params.userId, {
      rejectionReason: req.body.rejectionReason,
      adminId:         req.admin?.id,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const revokeVerification = async (req, res) => {
  try {
    const result = await svc.revokeVerificationService(req.params.userId);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

module.exports = {
  submitVerification,
  getMyVerificationStatus,
  getVerifications,
  approveVerification,
  rejectVerification,
  revokeVerification,
};
