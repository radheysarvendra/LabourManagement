const { getPincodeDetails } = require("../../utils/indiaPost");

const getPincodeDetailsService = async (pincode) => {
  const data = await getPincodeDetails(pincode);

  return {
    statusCode: 200,
    body: {
      success: true,
      meta: data,
    },
  };
};

module.exports = {
  getPincodeDetailsService,
};
