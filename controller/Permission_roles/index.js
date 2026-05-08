const db = require("../../model/index.js");
const msg = require("../../constants/Messages");

const Role = db.role;
// CREATE ROLE
const createRole = async (req, res) => {
  try {
    const { name, description, accessLevel } = req.body;

    if (!name || accessLevel === undefined) {
      return res.status(400).send({
        success: false,
        message: msg.REQUIRED_FIELDS_MISSING,
      });
    }

    const data = await Role.create({
      name: name,
      description: description,
      accessLevel: accessLevel,
    });

    return res.status(201).send({
      success: true,
      message: "Role created successfully",
      data,
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

// GET ALL ROLES
const getAllRoles = async (req, res) => {
  try {
    const data = await Role.findAll();

    return res.send({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

// GET ROLE BY ID
const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).send({
        success: false,
        message: "Role ID is required",
      });
    }

    const data = await Role.findOne({ where: { id } });

    if (!data) {
      return res.status(404).send({
        success: false,
        message: "Role not found",
      });
    }

    return res.status(200).send({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

// UPDATE ROLE BY ID
const updateRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, accessLevel } = req.body;

    const role = await Role.findOne({ where: { id } });

    if (!role) {
      return res.status(404).send({
        success: false,
        message: "Role not found",
      });
    }

    // Check for required fields (if updated)
    if (!name || accessLevel === undefined) {
      return res.status(400).send({
        success: false,
        message: msg.REQUIRED_FIELDS_MISSING,
      });
    }

    await Role.update(
      { name, description, accessLevel },
      { where: { id } }
    );

    const updatedRole = await Role.findOne({ where: { id } });

    return res.status(200).send({
      success: true,
      message: "Role updated successfully",
      data: updatedRole,
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};


// DELETE ROLE BY ID
const deleteRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findOne({ where: { id } });

    if (!role) {
      return res.status(404).send({
        success: false,
        message: "Role not found",
      });
    }

    await Role.destroy({ where: { id } });

    return res.status(200).send({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  createRole,
  getAllRoles,
  getRoleById,
  updateRoleById,
  deleteRoleById,
};