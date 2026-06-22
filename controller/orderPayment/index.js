const svc = require("./service");

const initiateOrderPayment = async (req, res) => {
  try {
    const result = await svc.initiateOrderPaymentService({
      orderId: req.params.orderId,
      jobValue: req.body.jobValue,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getOrderPayment = async (req, res) => {
  try {
    const result = await svc.getOrderPaymentService(req.params.orderId);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const payMilestone = async (req, res) => {
  try {
    const result = await svc.payMilestoneService(
      req.params.orderId,
      req.params.milestoneId,
      req.body
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const refundBeforeWork = async (req, res) => {
  try {
    const result = await svc.refundBeforeWorkService(req.params.orderId, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getAllOrderPayments = async (req, res) => {
  try {
    const result = await svc.getAllOrderPaymentsService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

module.exports = {
  initiateOrderPayment,
  getOrderPayment,
  payMilestone,
  refundBeforeWork,
  getAllOrderPayments,
};
