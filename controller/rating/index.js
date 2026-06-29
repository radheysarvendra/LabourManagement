const ratingService = require("./service");

const submitRating = async (req, res) => {
  try {
    const result = await ratingService.submitRatingService({
      ...req.body,
      _userId: req.user?.userId || req.user?.id,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getRatingsByOrder = async (req, res) => {
  try {
    const result = await ratingService.getRatingsByOrderService(req.params.orderId);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const updateRating = async (req, res) => {
  try {
    const result = await ratingService.updateRatingService(req.params.id, {
      ...req.body,
      _userId: req.user?.userId || req.user?.id,
    });
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getRatingsByUser = async (req, res) => {
  try {
    const result = await ratingService.getRatingsByUserService(
      req.params.userId,
      req.query.rateeType
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getMyGivenRatings = async (req, res) => {
  try {
    const result = await ratingService.getMyGivenRatingsService(
      req.user?.userId || req.user?.id
    );
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const getAllRatings = async (req, res) => {
  try {
    const result = await ratingService.getAllRatingsService(req.query);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

const deleteRating = async (req, res) => {
  try {
    const result = await ratingService.deleteRatingService(req.params.id);
    return res.status(result.statusCode).send(result.body);
  } catch (err) {
    return res.status(500).send({ success: false, message: err.message });
  }
};

module.exports = {
  submitRating,
  updateRating,
  getRatingsByOrder,
  getRatingsByUser,
  getMyGivenRatings,
  getAllRatings,
  deleteRating,
};
