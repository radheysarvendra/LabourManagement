const db = require("../../model/index.js");
const msg = require("../../constants/Messages");
const Owner = db.owner;

// ================= CREATE OWNER =================
const createOwner = async (req, res) => {
  try {
    const {
      name,
      phone,
      workType,
      address,
      pincode,
      city,
      state,
    } = req.body;

    // Required field validation
    if (!name || !phone || !workType) {
      return res.status(400).json({
        success: false,
        message: msg.REQUIRED_FIELDS_MISSING,
      });
    }

    // Phone length validation
    if (phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: msg.PHONE_LENGTH_INVALID,
      });
    }

    // Check existing owner
    const existingOwner = await Owner.findOne({
      where: { phone },
    });

    if (existingOwner) {
      return res.status(400).json({
        success: false,
        message: msg.PHONE_ALREADY_REGISTERED,
      });
    }

    // Create owner
    const data = await Owner.create({
      name,
      phone,
      workType,
      address,
      pincode,
      city,
      state,
    });

    return res.status(201).json({
      success: true,
      message: msg.OWNER_CREATED_SUCCESSFULLY,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET ALL OWNERS =================
const getAllOwners = async (req, res) => {
  try {
    const data = await Owner.findAll({
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= GET OWNER BY ID =================
const getOwnerById = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await Owner.findOne({
      where: { id },
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Owner nahi mila",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= UPDATE OWNER =================
const updateOwner = async (req, res) => {
  try {
    const { id } = req.params;

    const owner = await Owner.findOne({
      where: { id },
    });

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner nahi mila",
      });
    }

    await Owner.update(req.body, {
      where: { id },
    });

    const updatedData = await Owner.findOne({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: msg.OWNER_UPDATED_SUCCESSFULLY,
      data: updatedData,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= DELETE OWNER =================
const deleteOwner = async (req, res) => {
  try {
    const { id } = req.params;

    const owner = await Owner.findOne({
      where: { id },
    });

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner nahi mila",
      });
    }

    await Owner.destroy({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: msg.OWNER_DELETED_SUCCESSFULLY,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  createOwner,
  getAllOwners,
  getOwnerById,
  updateOwner,
  deleteOwner,
};