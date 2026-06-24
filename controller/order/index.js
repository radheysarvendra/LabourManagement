const orderService = require("./service");

const createOrder = async (req, res) => {
  try {
    const isAdminRequest = Boolean(req.admin);
    const result = await orderService.createOrderService({
      ...req.body,
      _userType: req.user?.type || req.user?.userType || null,
      _authenticatedUserId: isAdminRequest
        ? (req.body.userId || req.body.ownerId || null)
        : (req.user?.userId || req.user?.id),
      _activeRole: req.user?.activeRole || null,
      _isSessionAuth: Boolean(req.user?.sessionId),
      _isAdminRequest: isAdminRequest,
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
    const query = { ...req.query };
    if (req.user?.sessionId) {
      delete query.userId;
      delete query.ownerId;
      delete query.labourId;
      delete query.contractorId;
      query.actorUserId = req.user.userId;
    }
    const result = await orderService.getOrdersService(query);
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
    const result = await orderService.getOrderByIdService(
      req.params.id,
      req.user?.sessionId ? req.user.userId : null
    );
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
