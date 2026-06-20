const authService = require("./service");

const register = async (req, res) => {
  try {
    const result = await authService.registerService(req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const completeOwnerProfile = async (req, res) => {
  try {
    const result = await authService.completeOwnerProfileService({
      userId: req.user?.userId || req.user?.id,
      userType: req.user?.type || req.user?.userType,
      isSessionAuth: Boolean(req.user?.sessionId),
      ...req.body,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

const completeLabourProfile = async (req, res) => {
  try {
    const result = await authService.completeLabourProfileService({
      userId: req.user?.userId || req.user?.id,
      userType: req.user?.type || req.user?.userType,
      isSessionAuth: Boolean(req.user?.sessionId),
      ...req.body,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({ success: false, message: err.message });
  }
};

module.exports = { register, completeOwnerProfile, completeLabourProfile };
