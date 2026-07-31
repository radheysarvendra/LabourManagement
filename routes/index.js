const express = require("express");
const router = express.Router();

const labourController = require("../controller/Labours/index");
const ownerController = require("../controller/owner/index");
const locationController = require("../controller/location/index");
const addressController = require("../controller/address/index");
const categoryController = require("../controller/category/index");
const bookingController = require("../controller/booking/index");
const orderController = require("../controller/order/index");
const providerController = require("../controller/provider/index");
const workAssignmentController = require("../controller/workAssignment/index");
const authController = require("../middleware/auth/index");
const newAuthController = require("../controller/auth/index");
const roleController = require("../controller/Permission_roles/index");
const adminController = require("../controller/admin/index");
const ratingController = require("../controller/rating/index");
const orderPaymentController        = require("../controller/orderPayment/index");
const contractorLeadController      = require("../controller/contractorLead/index");
const labourVerificationController  = require("../controller/labourVerification/index");
const paymentController             = require("../controller/payment/index");
const { verifyAdminToken, allowAdminModule } = require("../middleware/adminAuth");
const { verifyToken } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.get("/", (req, res) => {
  res.status(200).send({
    success: true,
    message: "Labour backend is live",
    _commit: "8d49d6b",
  });
});

router.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "labour-backend",
    status: "ok",
  });
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
    await db.sequelize.authenticate();

    res.status(200).send({
      success: true,
      service: "labour-backend",
      status: "ok",
      db: "connected",
    });
  } catch (err) {
    res.status(500).send({
      success: false,
      status: "error",
      db: "disconnected",
      message: err.message,
    });
  }
});

router.get("/api/public-stats", async (req, res) => {
  try {
    const db = require("../model/index");
    const [
      labourCount,
      contractorCount,
      completedOrders,
      activeWorkers,
      verifiedProfiles,
    ] = await Promise.all([
      db.labour.count(),
      db.owner.count(),
      db.order.count({ where: { status: "completed" } }).catch(() => 0),
      db.labour.count({ where: { isAvailable: true } }).catch(() => db.labour.count()),
      db.labour.count({ where: { verificationStatus: "verified" } }).catch(() => 0),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalLabourers: labourCount,
        totalContractors: contractorCount,
        completedOrders,
        activeWorkers,
        verifiedProfiles,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/api/site-settings", (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      siteName: process.env.SITE_NAME || "Dihadii",
      logo: process.env.SITE_LOGO || "https://example.com/logo.png",
      phone: process.env.SITE_PHONE || "+919999999999",
      whatsapp: process.env.SITE_WHATSAPP || "+919999999999",
      email: process.env.SITE_EMAIL || "support@dihadii.com",
      footerText: process.env.SITE_FOOTER_TEXT || "Trusted labour and contractor platform",
      socialLinks: {
        facebook: process.env.SITE_FACEBOOK || "",
        instagram: process.env.SITE_INSTAGRAM || "",
        linkedin: process.env.SITE_LINKEDIN || "",
      },
    },
  });
});

router.get("/api/public/testimonials", (_req, res) => {
  return res.status(200).json({
    success: true,
    data: [
      {
        id: 1,
        name: "Amit Kumar",
        message: "Dihadii helped us find reliable labour quickly.",
        rating: 5,
        city: "Noida",
      },
    ],
  });
});

router.get("/api/public/faqs", (_req, res) => {
  return res.status(200).json({
    success: true,
    data: [
      {
        id: 1,
        question: "How does Dihadii work?",
        answer: "Users can view labour and contractor information and contact the team.",
      },
    ],
  });
});

router.post("/api/contact-messages", (req, res) => {
  const { name, phone, message } = req.body || {};
  if (!name || !phone || !message) {
    return res.status(400).json({
      success: false,
      message: "name, phone, and message are required",
    });
  }

  console.log("Contact message received:", { name, phone, message });

  return res.status(200).json({
    success: true,
    message: "Contact request submitted successfully",
  });
});

// Labour routes  (createLabour → /labour POST)
// Unified registration (new flow — all 4 roles, single registration)
router.post("/api/auth/register", newAuthController.register);
router.post("/api/profile/complete-owner", verifyToken, newAuthController.completeOwnerProfile);
router.post("/api/profile/complete-labour", verifyToken, newAuthController.completeLabourProfile);
router.put("/api/profile/labour/skills", verifyToken, newAuthController.completeLabourProfile);
router.get("/api/profile/contractor", verifyToken, providerController.getMyContractorProfile);
router.put("/api/profile/contractor/skills", verifyToken, providerController.updateMyContractorSkills);

router.post("/auth/login", authController.login);
router.post("/auth/login-password", authController.loginPassword);
router.post("/auth/check-phone", authController.checkPhone);
router.post("/auth/request-otp", authController.requestOtp);
router.post("/auth/verify-otp", authController.verifyOtp);
router.post("/auth/request-password-reset", authController.requestPasswordReset);
router.post("/auth/verify-password-reset-otp", authController.verifyPasswordResetOtp);
router.post("/auth/reset-password", authController.resetPassword);
router.post("/auth/switch-role", verifyToken, authController.switchRole);
router.get("/pincode/:pincode", locationController.getPincodeDetails);
router.get("/api/address/states", addressController.getStates);
router.get("/api/address/districts/:stateId", addressController.getDistricts);
router.get("/api/address/pincode/:pincode", addressController.getPincodeDetails);
router.post("/api/address/create", addressController.createAddress);
router.get("/api/address/:entityType/:entityId", addressController.getAddressByEntity);
// Category & skill reads are public; mutations require admin
router.get("/api/categories", categoryController.getCategories);
router.post("/api/categories", verifyAdminToken, categoryController.createCategory);
router.put("/api/categories/:id", verifyAdminToken, categoryController.updateCategory);
router.delete("/api/categories/:id", verifyAdminToken, categoryController.deleteCategory);
router.get("/api/skills", categoryController.getSkills);
router.post("/api/skills", verifyAdminToken, categoryController.createSkill);
router.put("/api/skills/:id", verifyAdminToken, categoryController.updateSkill);
router.delete("/api/skills/:id", verifyAdminToken, categoryController.deleteSkill);
router.get("/api/categories/:categoryId/skills", categoryController.getCategorySkills);
router.post("/api/categories/:categoryId/skills", verifyAdminToken, categoryController.addSkillToCategory);
router.delete("/api/categories/:categoryId/skills/:skillId", verifyAdminToken, categoryController.removeSkillFromCategory);
router.get("/api/providers/search", verifyToken, providerController.searchProviders);
router.get("/api/providers/count", verifyToken, providerController.countProviders);
router.get("/api/providers/labour-match", verifyToken, providerController.getLabourLocationSkillMatch);
router.get("/api/admin/providers/search", verifyAdminToken, providerController.searchProviders);
router.get("/api/admin/providers/count", verifyAdminToken, providerController.countProviders);
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
router.delete("/api/orders/:id/cancel", verifyToken, orderController.cancelOrder);
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
// ── File Upload (Cloudinary) ──────────────────────────────────────────────────
router.post(
  "/api/upload",
  verifyToken,
  upload.single("file"),
  upload.uploadToCloudinary(),
  (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const { secure_url, public_id } = req.cloudinaryResult || {};
    res.status(200).json({ success: true, url: secure_url, cloudinaryPublicId: public_id });
  }
);

// ── Labour Verification ───────────────────────────────────────────────────────
router.post("/api/labour/verification/submit",   verifyToken, labourVerificationController.submitVerification);
router.post("/api/labour/upload-docs",           verifyToken, labourVerificationController.submitVerification);
router.get("/api/labour/verification/status",    verifyToken, labourVerificationController.getMyVerificationStatus);
// Role-independent identity verification (legacy labour URLs above remain compatible)
router.post("/api/user/verification/submit",      verifyToken, labourVerificationController.submitVerification);
router.get("/api/user/verification/status",       verifyToken, labourVerificationController.getMyVerificationStatus);
// Admin
router.get("/api/admin/labour-verifications",                       verifyAdminToken, labourVerificationController.getVerifications);
router.put("/api/admin/labour-verifications/:userId/approve",       verifyAdminToken, labourVerificationController.approveVerification);
router.put("/api/admin/labour-verifications/:userId/reject",        verifyAdminToken, labourVerificationController.rejectVerification);
router.put("/api/admin/labour-verifications/:userId/revoke",        verifyAdminToken, labourVerificationController.revokeVerification);

// ── Contractor Lead System ────────────────────────────────────────────────────
router.post("/api/contractor-leads",                   verifyToken, contractorLeadController.createLead);
router.get("/api/contractor-leads",                    verifyToken, contractorLeadController.getMyLeads);
router.get("/api/contractor-leads/:id",                verifyToken, contractorLeadController.getLeadById);
router.put("/api/contractor-leads/:id/pay-lead-fee",   verifyToken, contractorLeadController.payLeadFee);
router.put("/api/contractor-leads/:id/pay-service-fee",verifyToken, contractorLeadController.payServiceFee);
// Admin
router.get("/api/admin/contractor-leads",                     verifyAdminToken, contractorLeadController.getAllLeads);
router.put("/api/admin/contractor-leads/:id/waive-service-fee", verifyAdminToken, contractorLeadController.waiveServiceFee);

// ── Customer Order Payment (service fee + 30/40/30 milestones) ───────────────
router.post("/api/orders/:orderId/payment/initiate",          verifyToken, orderPaymentController.initiateOrderPayment);
router.get("/api/orders/:orderId/payment",                    verifyToken, orderPaymentController.getOrderPayment);
router.put("/api/orders/:orderId/payment/:milestoneId/pay",   verifyToken, orderPaymentController.payMilestone);
router.put("/api/orders/:orderId/payment/refund-before-work", verifyToken, orderPaymentController.refundBeforeWork);
// Admin
router.get("/api/admin/order-payments", verifyAdminToken, orderPaymentController.getAllOrderPayments);

// ── UPI Payment ──────────────────────────────────────────────────────────────
router.get("/api/payment/config",   paymentController.getPaymentConfig);          // public — app fetches UPI ID
router.post("/api/payment/verify",  verifyToken, paymentController.verifyPayment); // record UPI txn after pay
router.get("/api/payment/history",  verifyToken, paymentController.getPaymentHistory); // user payment history

// ── Contractor fee tiers (public) ────────────────────────────────────────────
router.get("/api/platform-fees/contractor-tiers", (req, res) => {
  res.status(200).json({
    success: true,
    leadFees: [
      { leadSize: "small",  projectValueUpTo: 50000,   leadFee: 100 },
      { leadSize: "medium", projectValueUpTo: 200000,  leadFee: 200 },
      { leadSize: "large",  projectValueUpTo: null,    leadFee: 500 },
    ],
    serviceFees: [
      { projectValueUpTo: 50000,   serviceFeePercent: 5 },
      { projectValueUpTo: 200000,  serviceFeePercent: 3 },
      { projectValueUpTo: 1000000, serviceFeePercent: 2 },
      { projectValueUpTo: null,    serviceFeePercent: 1 },
    ],
    note: "Pay lead fee to unlock owner contact details. Pay service fee after winning the contract.",
  });
});

// ── Labour platform fee tiers (public) ───────────────────────────────────────
router.get("/api/platform-fees/labour-tiers", (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { dailyWageUpTo: 800,  dailyWageFrom: 0,    fee: 30,  feeType: "fixed" },
      { dailyWageUpTo: 1200, dailyWageFrom: 801,  fee: 50,  feeType: "fixed" },
      { dailyWageUpTo: 2000, dailyWageFrom: 1201, fee: 75,  feeType: "fixed" },
      { dailyWageUpTo: null, dailyWageFrom: 2001, fee: "5% capped at ₹100", feeType: "percentage" },
    ],
    note: "Platform fee is charged per working day and deducted from net payment",
  });
});

// ── Rating routes ─────────────────────────────────────────────────────────────
router.post("/api/ratings", verifyToken, ratingController.submitRating);
router.put("/api/ratings/:id", verifyToken, ratingController.updateRating);
router.get("/api/ratings/my", verifyToken, ratingController.getMyGivenRatings);
router.get("/api/ratings/order/:orderId", verifyToken, ratingController.getRatingsByOrder);
router.get("/api/ratings/user/:userId", verifyToken, ratingController.getRatingsByUser);
// Admin rating routes
router.get("/api/admin/ratings", verifyAdminToken, ratingController.getAllRatings);
router.delete("/api/admin/ratings/:id", verifyAdminToken, ratingController.deleteRating);

router.post("/createLabour", verifyAdminToken, labourController.createLabour);
router.get("/searchLabour", verifyToken, labourController.searchLabours);
router.post("/api/labours/filter", verifyToken, labourController.filterLabours);
router.get("/api/labours/filter", verifyToken, labourController.filterLabours);
router.get("/getAllLabour", verifyToken, labourController.getAllLabours);
router.get("/getLabourById/:id",verifyToken, labourController.getLabourById);
router.put("/updateLabourById/:id", verifyToken, labourController.updateLabourById);


// Owner routes
router.post("/createOwner", verifyAdminToken, ownerController.createOwner);
router.get("/getAllOwners", verifyToken, ownerController.getAllOwners);
router.get("/getOwnerById/:id", verifyToken, ownerController.getOwnerById);
router.put("/updateOwnerById/:id", verifyToken, ownerController.updateOwner);
router.delete("/deleteOwnerById/:id", verifyToken, ownerController.deleteOwner);
router.post("/auth/logout", verifyToken, authController.logout);



// Admin dashboard routes
router.post("/api/admin/auth/login", adminController.loginAdmin);
router.get("/api/admin/profile", verifyAdminToken, adminController.getAdminProfile);
router.get("/api/admin/me", verifyAdminToken, adminController.getMe);
router.get("/api/admin/me/permissions", verifyAdminToken, adminController.getMePermissions);
router.get("/api/admin/overview/stats", verifyAdminToken, allowAdminModule("dashboard", "canView"), adminController.getOverviewStats);
router.get("/api/admin/activity/recent", verifyAdminToken, allowAdminModule("dashboard", "canView"), adminController.getRecentActivity);
router.get("/api/admin/search", verifyAdminToken, allowAdminModule("dashboard", "canView"), adminController.getGlobalSearch);
router.get("/api/admin/notifications", verifyAdminToken, allowAdminModule("dashboard", "canView"), adminController.getNotifications);
router.get("/api/admin/dashboard/stats", verifyAdminToken, allowAdminModule("dashboard", "canView"), adminController.getDashboardStats);
router.get("/api/admin/dashboard/summary", verifyAdminToken, allowAdminModule("dashboard", "canView"), adminController.getDashboardSummary);
router.get("/api/admin/dashboard/order-strength", verifyAdminToken, allowAdminModule("dashboard", "canView"), adminController.getOrderStrength);
router.get("/api/admin/dashboard/staff-strength", verifyAdminToken, allowAdminModule("dashboard", "canView"), adminController.getStaffStrength);
router.get("/api/admin/dashboard/state-wise-staff", verifyAdminToken, allowAdminModule("dashboard", "canView"), adminController.getStateWiseStaff);
router.post("/api/admin/admins", verifyAdminToken, allowAdminModule("admins", "canCreate"), adminController.createAdmin);
router.get("/api/admin/admins", verifyAdminToken, allowAdminModule("admins", "canView"), adminController.getAdmins);
router.get("/api/admin/users", verifyAdminToken, allowAdminModule("users", "canView"), adminController.getAllUsers);
router.post("/api/admin/permissions", verifyAdminToken, allowAdminModule("permissions", "canCreate"), adminController.createPermission);
router.get("/api/admin/permissions/matrix", verifyAdminToken, allowAdminModule("permissions", "canView"), adminController.getPermissionMatrix);
router.get("/api/admin/roles/modules", verifyAdminToken, allowAdminModule("roles", "canView"), adminController.getRoleModules);
router.get("/api/admin/roles/:roleId/permissions", verifyAdminToken, allowAdminModule("roles", "canView"), adminController.getRolePermissions);
router.put("/api/admin/roles/:roleId/permissions", verifyAdminToken, allowAdminModule("roles", "canUpdate"), adminController.updateRolePermissions);
router.post("/api/admin/roles", verifyAdminToken, allowAdminModule("roles", "canCreate"), roleController.createRole);
router.get("/api/admin/roles", verifyAdminToken, allowAdminModule("roles", "canView"), roleController.getAllRoles);
router.get("/api/admin/roles/:id", verifyAdminToken, allowAdminModule("roles", "canView"), roleController.getRoleById);
router.put("/api/admin/roles/:id", verifyAdminToken, allowAdminModule("roles", "canUpdate"), roleController.updateRoleById);
router.delete("/api/admin/roles/:id", verifyAdminToken, allowAdminModule("roles", "canDelete"), roleController.deleteRoleById);
router.get("/api/admin/skills/categories-summary", verifyAdminToken, allowAdminModule("skills", "canView"), categoryController.getCategoriesSummary);
router.get("/api/admin/labours", verifyAdminToken, allowAdminModule("labours", "canView"), labourController.adminSearchLabours);
router.get("/api/admin/labours/:id", verifyAdminToken, allowAdminModule("labours", "canView"), labourController.getLabourById);
router.post("/api/admin/labours", verifyAdminToken, allowAdminModule("labours", "canCreate"), labourController.createLabour);
router.put("/api/admin/labours/:id", verifyAdminToken, allowAdminModule("labours", "canUpdate"), labourController.updateLabourById);
router.get("/api/admin/owners", verifyAdminToken, allowAdminModule("owners", "canView"), ownerController.getAllOwners);
router.get("/api/admin/owners/:id", verifyAdminToken, allowAdminModule("owners", "canView"), ownerController.getOwnerById);
router.post("/api/admin/owners", verifyAdminToken, allowAdminModule("owners", "canCreate"), ownerController.createOwner);
router.put("/api/admin/owners/:id", verifyAdminToken, allowAdminModule("owners", "canUpdate"), ownerController.updateOwner);
router.patch("/api/admin/owners/:id", verifyAdminToken, allowAdminModule("owners", "canUpdate"), ownerController.updateOwner);
router.patch("/api/admin/owners/:id/status", verifyAdminToken, allowAdminModule("owners", "canUpdate"), ownerController.updateOwner);
router.put("/api/admin/owners/:id/activate", verifyAdminToken, allowAdminModule("owners", "canUpdate"), (req, res) => {
  req.body.isActive = true;
  return ownerController.updateOwner(req, res);
});
router.put("/api/admin/owners/:id/deactivate", verifyAdminToken, allowAdminModule("owners", "canUpdate"), (req, res) => {
  req.body.isActive = false;
  return ownerController.updateOwner(req, res);
});
router.delete("/api/admin/owners/:id", verifyAdminToken, allowAdminModule("owners", "canDelete"), ownerController.deleteOwner);
router.get("/api/admin/contractors", verifyAdminToken, allowAdminModule("contractors", "canView"), providerController.listContractors);
router.get("/api/admin/contractors/:id", verifyAdminToken, allowAdminModule("contractors", "canView"), providerController.getContractorById);
router.put("/api/admin/contractors/:id", verifyAdminToken, allowAdminModule("contractors", "canUpdate"), providerController.updateContractor);
router.patch("/api/admin/contractors/:id", verifyAdminToken, allowAdminModule("contractors", "canUpdate"), providerController.updateContractor);
router.patch("/api/admin/contractors/:id/verification", verifyAdminToken, allowAdminModule("contractors", "canApprove"), (req, res) => {
  const status = req.body.verificationStatus === "approved" ? "verified" : req.body.verificationStatus;
  req.body.verificationStatus = status;
  return providerController.updateContractor(req, res);
});
router.put("/api/admin/contractors/:id/approve", verifyAdminToken, allowAdminModule("contractors", "canApprove"), providerController.approveContractor);
router.put("/api/admin/contractors/:id/reject", verifyAdminToken, allowAdminModule("contractors", "canApprove"), providerController.rejectContractor);
router.put("/api/admin/contractors/:id/availability", verifyAdminToken, allowAdminModule("contractors", "canUpdate"), providerController.updateContractorAvailability);
router.get("/api/admin/bookings", verifyAdminToken, allowAdminModule("bookings", "canView"), bookingController.getBookings);
router.get("/api/admin/bookings/:id", verifyAdminToken, allowAdminModule("bookings", "canView"), bookingController.getBookingById);
router.post("/api/admin/bookings", verifyAdminToken, allowAdminModule("bookings", "canCreate"), bookingController.createBooking);
router.put("/api/admin/bookings/:id/status", verifyAdminToken, allowAdminModule("bookings", "canUpdate"), bookingController.updateBookingStatus);
router.patch("/api/admin/bookings/:id/status", verifyAdminToken, allowAdminModule("bookings", "canUpdate"), bookingController.updateBookingStatus);
router.put("/api/admin/booking-allocations/:id/status", verifyAdminToken, allowAdminModule("bookings", "canUpdate"), bookingController.updateAllocationStatus);
router.get("/api/admin/orders", verifyAdminToken, allowAdminModule("orders", "canView"), orderController.getOrders);
router.get("/api/admin/orders/:id", verifyAdminToken, allowAdminModule("orders", "canView"), orderController.getOrderById);
router.post("/api/admin/orders", verifyAdminToken, allowAdminModule("orders", "canCreate"), orderController.createOrder);
router.put("/api/admin/orders/:id/status", verifyAdminToken, allowAdminModule("orders", "canApprove"), orderController.updateOrderAdminStatus);
router.put("/api/admin/orders/:orderId/approve", verifyAdminToken, allowAdminModule("orders", "canApprove"), orderController.approveOrder);
router.put("/api/admin/order-mappings/:id/status", verifyAdminToken, allowAdminModule("orders", "canUpdate"), orderController.updateOrderMappingStatus);
router.get("/api/admin/work-assignments", verifyAdminToken, allowAdminModule("work_assignments", "canView"), workAssignmentController.getWorkAssignments);
router.get("/api/admin/work-assignments/:id", verifyAdminToken, allowAdminModule("work_assignments", "canView"), workAssignmentController.getWorkAssignmentById);
router.post("/api/admin/work-assignments", verifyAdminToken, allowAdminModule("work_assignments", "canCreate"), workAssignmentController.createWorkAssignment);
router.put("/api/admin/work-assignments/:id", verifyAdminToken, allowAdminModule("work_assignments", "canUpdate"), workAssignmentController.updateWorkAssignment);
router.patch("/api/admin/work-assignments/:id", verifyAdminToken, allowAdminModule("work_assignments", "canUpdate"), workAssignmentController.updateWorkAssignment);
router.delete("/api/admin/work-assignments/:id", verifyAdminToken, allowAdminModule("work_assignments", "canDelete"), workAssignmentController.deleteWorkAssignment);
router.post("/api/admin/orders/:orderId/work-assignment", verifyAdminToken, allowAdminModule("work_assignments", "canCreate"), workAssignmentController.createAssignmentFromOrder);
router.post("/api/admin/work-assignments/:id/labours", verifyAdminToken, allowAdminModule("work_assignments", "canUpdate"), workAssignmentController.addLabourToAssignment);
router.get("/api/admin/work-assignments/:id/labours", verifyAdminToken, allowAdminModule("work_assignments", "canView"), workAssignmentController.getAssignmentLabours);
router.put("/api/admin/work-assignments/:id/labours/:labourId", verifyAdminToken, allowAdminModule("work_assignments", "canUpdate"), workAssignmentController.updateAssignmentLabour);
router.delete("/api/admin/work-assignments/:id/labours/:labourId", verifyAdminToken, allowAdminModule("work_assignments", "canDelete"), workAssignmentController.removeAssignmentLabour);
router.post("/api/admin/work-assignments/:id/attendance", verifyAdminToken, allowAdminModule("attendance", "canCreate"), workAssignmentController.markAttendance);
router.get("/api/admin/work-assignments/:id/attendance", verifyAdminToken, allowAdminModule("attendance", "canView"), workAssignmentController.getAttendance);
router.put("/api/admin/work-assignments/:id/attendance/:attendanceId", verifyAdminToken, allowAdminModule("attendance", "canUpdate"), workAssignmentController.updateAttendance);
router.patch("/api/admin/work-assignments/:id/attendance", verifyAdminToken, allowAdminModule("attendance", "canUpdate"), workAssignmentController.updateAssignmentAttendanceStatus);
router.post("/api/admin/work-assignments/:id/payments/generate", verifyAdminToken, allowAdminModule("payments", "canCreate"), workAssignmentController.generatePayment);
router.get("/api/admin/work-assignments/:id/payments", verifyAdminToken, allowAdminModule("payments", "canView"), workAssignmentController.getPayments);
router.put("/api/admin/work-assignments/:id/payments/:paymentId/status", verifyAdminToken, allowAdminModule("payments", "canUpdate"), workAssignmentController.updatePaymentStatus);
router.patch("/api/admin/work-assignments/:id/payment-status", verifyAdminToken, allowAdminModule("payments", "canUpdate"), workAssignmentController.updateAssignmentPaymentStatus);
// Role routes
router.post("/CreateRole", verifyAdminToken, allowAdminModule("roles", "canCreate"), roleController.createRole);
router.get("/GetAllRoles", verifyAdminToken, allowAdminModule("roles", "canView"), roleController.getAllRoles);
router.get("/getRoleById/:id", verifyAdminToken, allowAdminModule("roles", "canView"), roleController.getRoleById);
router.put("/updateRoleById/:id", verifyAdminToken, allowAdminModule("roles", "canUpdate"), roleController.updateRoleById);
router.delete("/deleteRoleById/:id", verifyAdminToken, allowAdminModule("roles", "canDelete"), roleController.deleteRoleById);

module.exports = router;



