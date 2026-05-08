const db = require("../../model/index.js");
const { generateToken, saveToken } = require("../../middleware/auth/index");
const msg = require("../../constants/Messages");

const Labour = db.labour;

// CREATE LABOUR 
const createLabour = async (req, res) => {
  try {
    const { name, phone, city, address, gender, age, experienceYears, isAvailable } = req.body;

    if (!name || !phone || !gender || !age) {
      return res.status(400).send({ 
        success: false, message: msg.REQUIRED_FIELDS_MISSING
       });
    }

    // const existingPhone = await Labour.findOne({ 
    //   where: { phone } });
    // if (existingPhone) {
    //   return res.status(400).send({ 
    //     success: false, message: msg.PHONE_EXIST });
    // }

    const data = await Labour.create({
       name: name,
        phone: phone,
         city: city, 
         address: address,
          gender: gender,
           age: age,
            experienceYears: experienceYears,
             isAvailable: isAvailable
             });

    const token = generateToken(data, "labour");      
    await saveToken(data, token, "labour");         

    return res.status(201).send({ 
      success: true, message: msg.LABOUR_CREATED_SUCCESS, token, data
     });

  } catch (err) {
    return res.status(500).send({
       success: false, message: err.message });
  }
};

const getAllLabours = async (req, res) => {
  try {
    const data = await Labour.findAll();

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

// GET LABOUR BY ID
const getLabourById = async (req, res) => {
  try {
    const { id } = req.params;

    // check id
    if (!id) {
      return res.status(400).send({
        success: false,
        message: "Labour id is required",
      });
    }

    // find labour
    const data = await Labour.findOne({ where: { id:id } });

    // not found
    if (!data) {
      return res.status(404).send({
        success: false,
        message: "Labour not found",
      });
    }

    // success response
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

const updateLabourById = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      phone,
      city,
      address,
      gender,
      age,
      experienceYears,
      isAvailable,
    } = req.body;

    // check labour exists
    const labour = await Labour.findOne({ where: { id } }   );

    if (!labour) {
      return res.status(404).send({
        success: false,
        message: "Labour not found"
      });
    }

    // check duplicate phone number
    if (phone) {
      const existingPhone = await Labour.findOne({
        where: {
          phone,
        },
      });

      // phone belongs to another user
      if (existingPhone && existingPhone.id != id) {
        return res.status(400).send({
          success: false,
          message: msg.PHONE_EXIST,
        });
      }
    }

    // update labour
    await Labour.update(
      {
        name,
        phone,
        city,
        address,
        gender,
        age,
        experienceYears,
        isAvailable,
      },
      {
        where: { id },
      }
    );

    // updated data
    const updatedLabour = await Labour.findOne({ where: { id } }  );

    return res.status(200).send({
      success: true,
      message: "Labour updated successfully",
      data: updatedLabour,
    });
  } catch (err) {

    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};


module.exports = {
  createLabour,
  getAllLabours,
  getLabourById,
  updateLabourById,
};