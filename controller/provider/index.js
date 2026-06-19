const providerService = require("./service");

const searchProviders = async (req, res) => {
  try {
    const result = await providerService.searchProviders(req.query);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

const countProviders = async (req, res) => {
  try {
    const result = await providerService.countProviders(req.query);
    return res.status(200).send(result);
  } catch (err) {
    return res.status(err.statusCode || 500).send({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  searchProviders,
  countProviders,
};
