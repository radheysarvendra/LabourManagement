const {
  getPaymentConfigService,
  verifyPaymentService,
  getPaymentHistoryService,
} = require("./service");

const getPaymentConfig = async (req, res) => {
  try {
    const { statusCode, body } = getPaymentConfigService();
    return res.status(statusCode).json(body);
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || null;
    const { statusCode, body } = await verifyPaymentService(req.body, userId);
    return res.status(statusCode).json(body);
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const { statusCode, body } = await getPaymentHistoryService(userId, req.query);
    return res.status(statusCode).json(body);
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getPaymentConfig, verifyPayment, getPaymentHistory };
