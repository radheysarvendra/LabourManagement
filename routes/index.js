const express = require("express");
const router = express.Router();

const labourController = require("../controller/Labours/index");
const ownerController = require("../controller/owner/index");
const locationController = require("../controller/location/index");
const addressController = require("../controller/address/index");
const categoryController = require("../controller/category/index");
const authController = require("../middleware/auth/index");
const roleController = require("../controller/Permission_roles/index");
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


// Role routes
router.post("/CreateRole", verifyToken, roleController.createRole);
router.get("/GetAllRoles", verifyToken, roleController.getAllRoles);
router.get("/getRoleById/:id", verifyToken, roleController.getRoleById);
router.put("/updateRoleById/:id", verifyToken, roleController.updateRoleById);
router.delete("/deleteRoleById/:id", verifyToken, roleController.deleteRoleById);

module.exports = router;
