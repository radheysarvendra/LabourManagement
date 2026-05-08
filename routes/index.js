const express = require("express");
const router = express.Router();

const labourController = require("../controller/labours/index");
const ownerController = require("../controller/owner/index");
const authController = require("../middleware/auth/index");
const roleController = require("../controller/Permission_roles/index");
const { verifyToken } = require("../middleware/auth");

// Labour routes  (createLabour → /labour POST)
router.post("/auth/login", authController.login);
router.post("/createLabour", labourController.createLabour);           
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