const express = require("express");
const router = express.Router();

const labourController = require("../controller/Labours/index");
const ownerController = require("../controller/owner/index");
const locationController = require("../controller/location/index");
const addressController = require("../controller/address/index");
const categoryController = require("../controller/category/index");
const bookingController = require("../controller/booking/index");
const orderController = require("../controller/order/index");
const workAssignmentController = require("../controller/workAssignment/index");
const authController = require("../middleware/auth/index");
const roleController = require("../controller/Permission_roles/index");
const adminController = require("../controller/admin/index");
const { verifyAdminToken, allowAdminModule } = require("../middleware/adminAuth");
const { verifyToken } = require("../middleware/auth");

router.get("/", (req, res) => {
  res.status(200).send({
    success: true,
    message: "Labour backend is live",
    _commit: "8d49d6b",
  });
});

router.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, commit: "8d49d6b" });
});

router.get("/health", (req, res) => {
  res.status(200).send({
    success: true,
    service: "labour-backend",
    status: "ok",
  });
});

router.get("/api/status", async (req, res) => {
  try {
    const db = require("../model/index");
    const [labourCount, ownerCount, adminCount] = await Promise.all([
      db.labour.count(),
      db.owner.count(),
      db.admin.count(),
    ]);
    res.status(200).send({
      success: true,
      status: "ok",
      db: "connected",
      counts: { labours: labourCount, owners: ownerCount, admins: adminCount },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).send({ success: false, status: "error", message: err.message });
  }
});

// Labour routes  (createLabour → /labour POST)
router.post("/auth/login", authController.login);
router.post("/auth/check-phone", authController.checkPhone);
router.post("/auth/request-otp", authController.requestOtp);
router.post("/auth/verify-otp", authController.verifyOtp);
router.get("/pincode/:pincode", locationController.getPincodeDetails);
router.get("/api/address/states", addressController.getStates);
router.get("/api/address/districts/:stateId", addressController.getDistricts);
router.get("/api/address/pincode/:pincode", addressController.getPincodeDetails);
router.post("/api/address/create", addressController.createAddress);
router.get("/api/address/:entityType/:entityId", addressController.getAddressByEntity);
router.get("/api/categories", categoryController.getCategories);
router.post("/api/categories", categoryController.createCategory);
router.put("/api/categories/:id", categoryController.updateCategory);
router.delete("/api/categories/:id", categoryController.deleteCategory);
router.get("/api/skills", categoryController.getSkills);
router.post("/api/skills", categoryController.createSkill);
router.put("/api/skills/:id", categoryController.updateSkill);
router.delete("/api/skills/:id", categoryController.deleteSkill);
router.get("/api/categories/:categoryId/skills", categoryController.getCategorySkills);
router.post("/api/categories/:categoryId/skills", categoryController.addSkillToCategory);
router.delete("/api/categories/:categoryId/skills/:skillId", categoryController.removeSkillFromCategory);
router.post("/api/bookings", verifyToken, bookingController.createBooking);
router.get("/api/bookings", verifyToken, bookingController.getBookings);
router.get("/api/bookings/:id", verifyToken, bookingController.getBookingById);
router.put("/api/bookings/:id/status", verifyToken, bookingController.updateBookingStatus);
router.put("/api/booking-allocations/:id/status", verifyToken, bookingController.updateAllocationStatus);
router.post("/api/orders", verifyToken, orderController.createOrder);
router.get("/api/orders", verifyToken, orderController.getOrders);
router.get("/api/orders/owner/:ownerId", verifyToken, (req, res) => {
  req.query.ownerId = req.params.ownerId;
  return orderController.getOrders(req, res);
});
router.get("/api/orders/user/:userId", verifyToken, (req, res) => {
  req.query.userId = req.params.userId;
  return orderController.getOrders(req, res);
});
router.get("/api/orders/labour/:labourId", verifyToken, (req, res) => {
  req.query.labourId = req.params.labourId;
  return orderController.getOrders(req, res);
});
router.get("/api/orders/contractor/:contractorId", verifyToken, (req, res) => {
  req.query.contractorId = req.params.contractorId;
  return orderController.getOrders(req, res);
});
router.get("/api/labour/:labourId/orders", verifyToken, (req, res) => {
  req.query.labourId = req.params.labourId;
  return orderController.getOrders(req, res);
});
router.get("/api/orders/:id", verifyToken, orderController.getOrderById);
router.put("/api/orders/:id/admin-status", verifyAdminToken, allowAdminModule("orders", "canApprove"), orderController.updateOrderAdminStatus);
router.put("/api/order-mappings/:id/status", verifyToken, orderController.updateOrderMappingStatus);
router.post("/api/work-assignments", verifyToken, workAssignmentController.createWorkAssignment);
router.post("/api/orders/:orderId/work-assignment", verifyToken, workAssignmentController.createAssignmentFromOrder);
router.get("/api/work-assignments", verifyToken, workAssignmentController.getWorkAssignments);
router.get("/api/work-assignments/:id", verifyToken, workAssignmentController.getWorkAssignmentById);
router.put("/api/work-assignments/:id", verifyToken, workAssignmentController.updateWorkAssignment);
router.delete("/api/work-assignments/:id", verifyToken, workAssignmentController.deleteWorkAssignment);
router.post("/api/work-assignments/:id/labours", verifyToken, workAssignmentController.addLabourToAssignment);
router.get("/api/work-assignments/:id/labours", verifyToken, workAssignmentController.getAssignmentLabours);
router.put("/api/work-assignments/:id/labours/:labourId", verifyToken, workAssignmentController.updateAssignmentLabour);
router.delete("/api/work-assignments/:id/labours/:labourId", verifyToken, workAssignmentController.removeAssignmentLabour);
router.post("/api/work-assignments/:id/attendance", verifyToken, workAssignmentController.markAttendance);
router.get("/api/work-assignments/:id/attendance", verifyToken, workAssignmentController.getAttendance);
router.put("/api/work-assignments/:id/attendance/:attendanceId", verifyToken, workAssignmentController.updateAttendance);
router.post("/api/work-assignments/:id/payments/generate", verifyToken, workAssignmentController.generatePayment);
router.get("/api/work-assignments/:id/payments", verifyToken, workAssignmentController.getPayments);
router.put("/api/work-assignments/:id/payments/:paymentId/status", verifyToken, workAssignmentController.updatePaymentStatus);
router.post("/createLabour", labourController.createLabour);
router.get("/searchLabour", verifyToken, labourController.searchLabours);
router.get("/getAllLabour", verifyToken, labourController.getAllLabours); 
router.get("/getLabourById/:id",verifyToken, labourController.getLabourById);
router.put("/updateLabourById/:id", verifyToken, labourController.updateLabourById);


// Owner routes
router.post("/createOwner", ownerController.createOwner);
router.get("/getAllOwners", verifyToken, ownerController.getAllOwners);
router.get("/getOwnerById/:id", verifyToken, ownerController.getOwnerById);
router.put("/updateOwnerById/:id", verifyToken, ownerController.updateOwner);
router.delete("/deleteOwnerById/:id", verifyToken, ownerController.deleteOwner);
router.post("/auth/logout", verifyToken, authController.logout);



// Admin dashboard routes
router.post("/api/admin/auth/login", adminController.loginAdmin);
router.get("/api/admin/profile", verifyAdminToken, adminController.getAdminProfile);
router.get("/api/admin/dashboard/stats", verifyAdminToken, allowAdminModule("dashboard", "canView"), adminController.getDashboardStats);
router.post("/api/admin/admins", verifyAdminToken, allowAdminModule("admins", "canCreate"), adminController.createAdmin);
router.get("/api/admin/admins", verifyAdminToken, allowAdminModule("admins", "canView"), adminController.getAdmins);
router.post("/api/admin/permissions", verifyAdminToken, allowAdminModule("permissions", "canCreate"), adminController.createPermission);
router.get("/api/admin/permissions/matrix", verifyAdminToken, allowAdminModule("permissions", "canView"), adminController.getPermissionMatrix);
router.post("/api/admin/roles", verifyAdminToken, allowAdminModule("roles", "canCreate"), roleController.createRole);
router.get("/api/admin/roles", verifyAdminToken, allowAdminModule("roles", "canView"), roleController.getAllRoles);
router.get("/api/admin/roles/:id", verifyAdminToken, allowAdminModule("roles", "canView"), roleController.getRoleById);
router.put("/api/admin/roles/:id", verifyAdminToken, allowAdminModule("roles", "canUpdate"), roleController.updateRoleById);
router.delete("/api/admin/roles/:id", verifyAdminToken, allowAdminModule("roles", "canDelete"), roleController.deleteRoleById);
router.get("/api/admin/labours", verifyAdminToken, allowAdminModule("labours", "canView"), labourController.searchLabours);
router.get("/api/admin/labours/:id", verifyAdminToken, allowAdminModule("labours", "canView"), labourController.getLabourById);
router.post("/api/admin/labours", verifyAdminToken, allowAdminModule("labours", "canCreate"), labourController.createLabour);
router.put("/api/admin/labours/:id", verifyAdminToken, allowAdminModule("labours", "canUpdate"), labourController.updateLabourById);
router.get("/api/admin/owners", verifyAdminToken, allowAdminModule("owners", "canView"), ownerController.getAllOwners);
router.get("/api/admin/owners/:id", verifyAdminToken, allowAdminModule("owners", "canView"), ownerController.getOwnerById);
router.post("/api/admin/owners", verifyAdminToken, allowAdminModule("owners", "canCreate"), ownerController.createOwner);
router.put("/api/admin/owners/:id", verifyAdminToken, allowAdminModule("owners", "canUpdate"), ownerController.updateOwner);
router.delete("/api/admin/owners/:id", verifyAdminToken, allowAdminModule("owners", "canDelete"), ownerController.deleteOwner);
router.get("/api/admin/bookings", verifyAdminToken, allowAdminModule("bookings", "canView"), bookingController.getBookings);
router.get("/api/admin/bookings/:id", verifyAdminToken, allowAdminModule("bookings", "canView"), bookingController.getBookingById);
router.post("/api/admin/bookings", verifyAdminToken, allowAdminModule("bookings", "canCreate"), bookingController.createBooking);
router.put("/api/admin/bookings/:id/status", verifyAdminToken, allowAdminModule("bookings", "canUpdate"), bookingController.updateBookingStatus);
router.put("/api/admin/booking-allocations/:id/status", verifyAdminToken, allowAdminModule("bookings", "canUpdate"), bookingController.updateAllocationStatus);
router.get("/api/admin/orders", verifyAdminToken, allowAdminModule("orders", "canView"), orderController.getOrders);
router.put("/api/admin/orders/:id/status", verifyAdminToken, allowAdminModule("orders", "canApprove"), orderController.updateOrderAdminStatus);
router.put("/api/admin/orders/:orderId/approve", verifyAdminToken, allowAdminModule("orders", "canApprove"), orderController.approveOrder);
router.get("/api/admin/work-assignments", verifyAdminToken, allowAdminModule("work_assignments", "canView"), workAssignmentController.getWorkAssignments);
router.get("/api/admin/work-assignments/:id", verifyAdminToken, allowAdminModule("work_assignments", "canView"), workAssignmentController.getWorkAssignmentById);
router.post("/api/admin/work-assignments", verifyAdminToken, allowAdminModule("work_assignments", "canCreate"), workAssignmentController.createWorkAssignment);
router.put("/api/admin/work-assignments/:id", verifyAdminToken, allowAdminModule("work_assignments", "canUpdate"), workAssignmentController.updateWorkAssignment);
router.delete("/api/admin/work-assignments/:id", verifyAdminToken, allowAdminModule("work_assignments", "canDelete"), workAssignmentController.deleteWorkAssignment);
router.post("/api/admin/orders/:orderId/work-assignment", verifyAdminToken, allowAdminModule("work_assignments", "canCreate"), workAssignmentController.createAssignmentFromOrder);
router.post("/api/admin/work-assignments/:id/labours", verifyAdminToken, allowAdminModule("work_assignments", "canUpdate"), workAssignmentController.addLabourToAssignment);
router.get("/api/admin/work-assignments/:id/labours", verifyAdminToken, allowAdminModule("work_assignments", "canView"), workAssignmentController.getAssignmentLabours);
router.put("/api/admin/work-assignments/:id/labours/:labourId", verifyAdminToken, allowAdminModule("work_assignments", "canUpdate"), workAssignmentController.updateAssignmentLabour);
router.delete("/api/admin/work-assignments/:id/labours/:labourId", verifyAdminToken, allowAdminModule("work_assignments", "canDelete"), workAssignmentController.removeAssignmentLabour);
router.post("/api/admin/work-assignments/:id/attendance", verifyAdminToken, allowAdminModule("attendance", "canCreate"), workAssignmentController.markAttendance);
router.get("/api/admin/work-assignments/:id/attendance", verifyAdminToken, allowAdminModule("attendance", "canView"), workAssignmentController.getAttendance);
router.put("/api/admin/work-assignments/:id/attendance/:attendanceId", verifyAdminToken, allowAdminModule("attendance", "canUpdate"), workAssignmentController.updateAttendance);
router.post("/api/admin/work-assignments/:id/payments/generate", verifyAdminToken, allowAdminModule("payments", "canCreate"), workAssignmentController.generatePayment);
router.get("/api/admin/work-assignments/:id/payments", verifyAdminToken, allowAdminModule("payments", "canView"), workAssignmentController.getPayments);
router.put("/api/admin/work-assignments/:id/payments/:paymentId/status", verifyAdminToken, allowAdminModule("payments", "canUpdate"), workAssignmentController.updatePaymentStatus);
// Role routes
router.post("/CreateRole", verifyToken, roleController.createRole);
router.get("/GetAllRoles", verifyToken, roleController.getAllRoles);
router.get("/getRoleById/:id", verifyToken, roleController.getRoleById);
router.put("/updateRoleById/:id", verifyToken, roleController.updateRoleById);
router.delete("/deleteRoleById/:id", verifyToken, roleController.deleteRoleById);

module.exports = router;



