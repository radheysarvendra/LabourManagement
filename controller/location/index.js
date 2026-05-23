const locationService = require("./service");

const getPincodeDetails = async (req,res) => {
  try {
    const result = await locationService.getPincodeDetailsService(req.params.pincode);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  getPincodeDetails,
};
