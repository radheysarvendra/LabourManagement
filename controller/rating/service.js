const { Op } = require("sequelize");
const db = require("../../model/index.js");

const Rating = db.rating;
const Order  = db.order;
const User   = db.user;

// ── helpers ───────────────────────────────────────────────────────────────────

const ok   = (data, message = "Success") => ({ statusCode: 200, body: { success: true, message, data } });
const created = (data, message = "Created") => ({ statusCode: 201, body: { success: true, message, data } });
const bad  = (message) => ({ statusCode: 400, body: { success: false, message } });
const notFound = (message = "Not found") => ({ statusCode: 404, body: { success: false, message } });
const conflict = (message) => ({ statusCode: 409, body: { success: false, message } });

// ── submit rating ─────────────────────────────────────────────────────────────

const submitRatingService = async ({ orderId, ratedUserId, raterType, rateeType, stars, feedback, _userId }) => {
  if (!orderId || !ratedUserId || !raterType || !rateeType || !stars) {
    return bad("orderId, ratedUserId, raterType, rateeType, stars are required");
  }

  if (stars < 1 || stars > 5) return bad("stars must be between 1 and 5");

  const validTypes = ["owner", "labour", "contractor"];
  if (!validTypes.includes(raterType) || !validTypes.includes(rateeType)) {
    return bad("raterType and rateeType must be owner, labour, or contractor");
  }

  if (_userId === ratedUserId) return bad("You cannot rate yourself");

  const order = await Order.findByPk(orderId);
  if (!order) return notFound("Order not found");

  const existing = await Rating.findOne({
    where: { orderId, ratedByUserId: _userId, rateeType },
  });
  if (existing) return conflict("You have already rated this person for this order");

  const rating = await Rating.create({
    orderId,
    ratedByUserId: _userId,
    ratedUserId,
    raterType,
    rateeType,
    stars,
    feedback: feedback || null,
  });

  return created(rating, "Rating submitted successfully");
};

// ── get ratings for an order ──────────────────────────────────────────────────

const getRatingsByOrderService = async (orderId) => {
  const order = await Order.findByPk(orderId);
  if (!order) return notFound("Order not found");

  const ratings = await Rating.findAll({
    where: { orderId },
    include: [
      { model: User, as: "ratedBy", attributes: ["id", "name", "phone"] },
      { model: User, as: "rated",   attributes: ["id", "name", "phone"] },
    ],
    order: [["createdAt", "DESC"]],
  });

  return ok(ratings);
};

// ── get ratings received by a user ───────────────────────────────────────────

const getRatingsByUserService = async (userId, rateeType) => {
  const where = { ratedUserId: userId };
  if (rateeType) where.rateeType = rateeType;

  const ratings = await Rating.findAll({
    where,
    include: [
      { model: User, as: "ratedBy", attributes: ["id", "name", "phone"] },
    ],
    order: [["createdAt", "DESC"]],
  });

  const avgStars = ratings.length
    ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(2)
    : null;

  return ok({ totalRatings: ratings.length, averageStars: avgStars, ratings });
};

// ── get ratings given by the logged-in user ───────────────────────────────────

const getMyGivenRatingsService = async (userId) => {
  const ratings = await Rating.findAll({
    where: { ratedByUserId: userId },
    include: [
      { model: User, as: "rated", attributes: ["id", "name", "phone"] },
    ],
    order: [["createdAt", "DESC"]],
  });

  return ok(ratings);
};

// ── admin: get all ratings ────────────────────────────────────────────────────

const getAllRatingsService = async ({ orderId, ratedUserId, rateeType, page = 1, limit = 20 }) => {
  const where = {};
  if (orderId)     where.orderId     = orderId;
  if (ratedUserId) where.ratedUserId = ratedUserId;
  if (rateeType)   where.rateeType   = rateeType;

  const offset = (page - 1) * limit;

  const { count, rows } = await Rating.findAndCountAll({
    where,
    include: [
      { model: User, as: "ratedBy", attributes: ["id", "name", "phone"] },
      { model: User, as: "rated",   attributes: ["id", "name", "phone"] },
    ],
    order: [["createdAt", "DESC"]],
    limit: Number(limit),
    offset: Number(offset),
  });

  return ok({ total: count, page: Number(page), limit: Number(limit), ratings: rows });
};

// ── delete rating (admin only) ────────────────────────────────────────────────

const deleteRatingService = async (id) => {
  const rating = await Rating.findByPk(id);
  if (!rating) return notFound("Rating not found");
  await rating.destroy();
  return ok(null, "Rating deleted");
};

module.exports = {
  submitRatingService,
  getRatingsByOrderService,
  getRatingsByUserService,
  getMyGivenRatingsService,
  getAllRatingsService,
  deleteRatingService,
};
