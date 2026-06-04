const express = require("express");
const router = express.Router();

const labourController = require("../controller/Labours/index");
const ownerController = require("../controller/owner/index");
const locationController = require("../controller/location/index");
const addressController = require("../controller/address/index");
const categoryController = require("../controller/category/index");
const bookingController = require("../controller/booking/index");
const orderController = require("../controller/order/index");
const authController = require("../middleware/auth/index");
const roleController = require("../controller/Permission_roles/index");
const adminController = require("../controller/admin/index");
const { verifyAdminToken, allowAdminModule } = require("../middleware/adminAuth");
const { verifyToken } = require("../middleware/auth");

router.get("/", (req, res) => {
  res.status(200).send({
    success: true,
    message: "Labour backend is live",
  });
});

router.get("/health", (req, res) => {
  res.status(200).send({
    success: true,
    service: "labour-backend",
    status: "ok",
  });
});

// Labour routes  (createLabour → /labour POST)
router.post("/auth/login", authController.login);
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
router.post("/api/bookings", bookingController.createBooking);
router.get("/api/bookings", bookingController.getBookings);
router.get("/api/bookings/:id", bookingController.getBookingById);
router.put("/api/bookings/:id/status", bookingController.updateBookingStatus);
router.put("/api/booking-allocations/:id/status", bookingController.updateAllocationStatus);
router.post("/api/orders", orderController.createOrder);
router.get("/api/orders", orderController.getOrders);
router.get("/api/orders/owner/:ownerId", (req, res) => {
  req.query.ownerId = req.params.ownerId;
  return orderController.getOrders(req, res);
});
router.get("/api/orders/labour/:labourId", (req, res) => {
  req.query.labourId = req.params.labourId;
  return orderController.getOrders(req, res);
});
router.get("/api/orders/:id", orderController.getOrderById);
router.put("/api/orders/:id/admin-status", orderController.updateOrderAdminStatus);
router.put("/api/order-mappings/:id/status", orderController.updateOrderMappingStatus);
router.post("/createLabour", labourController.createLabour);           
router.get("/searchLabour", labourController.searchLabours);
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
router.get("/api/admin/labours", verifyAdminToken, allowAdminModule("labours", "canView"), labourController.getAllLabours);
router.get("/api/admin/owners", verifyAdminToken, allowAdminModule("owners", "canView"), ownerController.getAllOwners);
router.get("/api/admin/orders", verifyAdminToken, allowAdminModule("orders", "canView"), orderController.getOrders);
router.put("/api/admin/orders/:id/status", verifyAdminToken, allowAdminModule("orders", "canApprove"), orderController.updateOrderAdminStatus);
// Role routes
router.post("/CreateRole", verifyToken, roleController.createRole);
router.get("/GetAllRoles", verifyToken, roleController.getAllRoles);
router.get("/getRoleById/:id", verifyToken, roleController.getRoleById);
router.put("/updateRoleById/:id", verifyToken, roleController.updateRoleById);
router.delete("/deleteRoleById/:id", verifyToken, roleController.deleteRoleById);

module.exports = router;


