const workAssignmentService = require("./service");

const createWorkAssignment = async (req, res) => {
  try {
    const result = await workAssignmentService.createWorkAssignmentService(req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const createAssignmentFromOrder = async (req, res) => {
  try {
    const result = await workAssignmentService.createAssignmentFromOrderService(
      req.params.orderId,
      req.body
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getWorkAssignments = async (req, res) => {
  try {
    const result = await workAssignmentService.getWorkAssignmentsService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getWorkAssignmentById = async (req, res) => {
  try {
    const result = await workAssignmentService.getAssignmentByIdService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const updateWorkAssignment = async (req, res) => {
  try {
    const result = await workAssignmentService.updateWorkAssignmentService(req.params.id, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const deleteWorkAssignment = async (req, res) => {
  try {
    const result = await workAssignmentService.deleteWorkAssignmentService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const addLabourToAssignment = async (req, res) => {
  try {
    const result = await workAssignmentService.addLabourToAssignmentService(
      req.params.id,
      req.body
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getAssignmentLabours = async (req, res) => {
  try {
    const result = await workAssignmentService.getAssignmentLaboursService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const updateAssignmentLabour = async (req, res) => {
  try {
    const result = await workAssignmentService.updateAssignmentLabourService(
      req.params.id,
      req.params.labourId,
      req.body
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const removeAssignmentLabour = async (req, res) => {
  try {
    const result = await workAssignmentService.removeAssignmentLabourService(
      req.params.id,
      req.params.labourId
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const markAttendance = async (req, res) => {
  try {
    const result = await workAssignmentService.markAttendanceService(req.params.id, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getAttendance = async (req, res) => {
  try {
    const result = await workAssignmentService.getAttendanceService({
      ...req.query,
      workAssignmentId: req.params.id,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const result = await workAssignmentService.updateAttendanceService(
      req.params.id,
      req.params.attendanceId,
      req.body
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const generatePayment = async (req, res) => {
  try {
    const result = await workAssignmentService.generatePaymentService(req.params.id, req.body);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getPayments = async (req, res) => {
  try {
    const result = await workAssignmentService.getPaymentsService({
      ...req.query,
      workAssignmentId: req.params.id,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const result = await workAssignmentService.updatePaymentStatusService(
      req.params.id,
      req.params.paymentId,
      req.body
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

module.exports = {
  createWorkAssignment,
  createAssignmentFromOrder,
  getWorkAssignments,
  getWorkAssignmentById,
  updateWorkAssignment,
  deleteWorkAssignment,
  addLabourToAssignment,
  getAssignmentLabours,
  updateAssignmentLabour,
  removeAssignmentLabour,
  markAttendance,
  getAttendance,
  updateAttendance,
  generatePayment,
  getPayments,
  updatePaymentStatus,
};
