const orderService = require("./service");

const createOrder = async (req,res) => {
  try {
    const result = await orderService.createOrderService({
      ...req.body,
      _userType: req.user?.type || req.user?.userType,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const getOrders = async (req,res) => {
  try {
    const result = await orderService.getOrdersService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

const getOrderById = async (req,res) => {
  try {
    const result = await orderService.getOrderByIdService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

const updateOrderAdminStatus = async (req,res) => {
  try {
    const result = await orderService.updateOrderAdminStatusService(req.params.id, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const approveOrder = async (req,res) => {
  try {
    const result = await orderService.approveOrderService(req.params.orderId || req.params.id, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const updateOrderMappingStatus = async (req,res) => {
  try {
    const result = await orderService.updateOrderMappingStatusService(req.params.id, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderAdminStatus,
  approveOrder,
  updateOrderMappingStatus,
};
