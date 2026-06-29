const { Op, fn, col, literal } = require("sequelize");
const db = require("../../model/index.js");

const Rating = db.rating;
const Order  = db.order;
const User   = db.user;
const ProviderRatingSummary = db.providerRatingSummary;

// ── helpers ───────────────────────────────────────────────────────────────────

const ok   = (data, message = "Success") => ({ statusCode: 200, body: { success: true, message, data } });
const created = (data, message = "Created") => ({ statusCode: 201, body: { success: true, message, data } });
const bad  = (message) => ({ statusCode: 400, body: { success: false, message } });
const notFound = (message = "Not found") => ({ statusCode: 404, body: { success: false, message } });
const conflict = (message) => ({ statusCode: 409, body: { success: false, message } });

const COMPLETED_ORDER_STATUSES = ["completed"];
const COMPLETED_ASSIGNMENT_STATUSES = ["completed"];
const COMPLETED_WORK_STATUSES = ["completed"];
const PROVIDER_ROLE_CODES = ["LABOUR", "CONTRACTOR"];

const normalizeStars = (stars) => Number(stars);

const normalizeRoleCode = (value) => {
  const role = String(value || "").trim().toUpperCase();
  return role === "LABOUR" || role === "CONTRACTOR" || role === "OWNER" ? role : null;
};

const getLegacyLabourUserId = async (value) => {
  const labour = await db.labour.findOne({
    where: { [Op.or]: [{ id: Number(value) || 0 }, { userId: Number(value) || 0 }] },
    attributes: ["id", "userId"],
  });
  return labour?.userId || null;
};

const recalculateProviderSummary = async (userId, roleCode, transaction = null) => {
  if (!userId || !PROVIDER_ROLE_CODES.includes(roleCode)) return null;

  const stats = await Rating.findOne({
    where: { ratedUserId: userId, ratedRoleCode: roleCode },
    attributes: [
      [fn("COUNT", col("id")), "totalRatings"],
      [fn("AVG", col("stars")), "averageRating"],
      [literal(`SUM(CASE WHEN "stars" = 5 THEN 1 ELSE 0 END)`), "fiveStarCount"],
      [literal(`SUM(CASE WHEN "stars" = 4 THEN 1 ELSE 0 END)`), "fourStarCount"],
      [literal(`SUM(CASE WHEN "stars" = 3 THEN 1 ELSE 0 END)`), "threeStarCount"],
      [literal(`SUM(CASE WHEN "stars" = 2 THEN 1 ELSE 0 END)`), "twoStarCount"],
      [literal(`SUM(CASE WHEN "stars" = 1 THEN 1 ELSE 0 END)`), "oneStarCount"],
    ],
    raw: true,
    transaction,
  });

  const totalRatings = Number(stats?.totalRatings || 0);
  const summary = {
    userId,
    roleCode,
    averageRating: totalRatings ? Number(stats.averageRating || 0).toFixed(2) : 0,
    totalRatings,
    fiveStarCount: Number(stats?.fiveStarCount || 0),
    fourStarCount: Number(stats?.fourStarCount || 0),
    threeStarCount: Number(stats?.threeStarCount || 0),
    twoStarCount: Number(stats?.twoStarCount || 0),
    oneStarCount: Number(stats?.oneStarCount || 0),
  };

  await ProviderRatingSummary.upsert(summary, { transaction });
  return summary;
};

const resolveRateableProvider = async ({ order, assignmentId, workAssignmentId, ratedUserId, ratedRoleCode }) => {
  const roleCode = normalizeRoleCode(ratedRoleCode);
  let assignment = null;

  if (assignmentId) {
    assignment = await db.orderAssignment.findOne({
      where: { id: assignmentId, orderId: order.id },
      include: [{ model: db.appRole, as: "providerRole", required: false }],
    });
    if (!assignment) return { error: notFound("Assignment not found for this order") };
    if (ratedUserId && Number(assignment.providerUserId) !== Number(ratedUserId)) {
      return { error: bad("Rated user does not match this assignment") };
    }
    const assignmentRoleCode = assignment.providerRole?.code || roleCode;
    if (!PROVIDER_ROLE_CODES.includes(assignmentRoleCode)) {
      return { error: bad("Only labour or contractor can be rated as provider") };
    }
    return {
      assignment,
      ratedUserId: assignment.providerUserId,
      ratedRoleCode: assignmentRoleCode,
      isCompleted: COMPLETED_ASSIGNMENT_STATUSES.includes(assignment.assignmentStatus) || COMPLETED_ORDER_STATUSES.includes(order.status),
    };
  }

  // Legacy work-assignment fallback for current website/app compatibility.
  if (workAssignmentId) {
    const workAssignment = await db.workAssignment.findOne({ where: { id: workAssignmentId, orderId: order.id } });
    if (!workAssignment) return { error: notFound("Work assignment not found for this order") };

    const globalUserId = await getLegacyLabourUserId(ratedUserId);
    if (!globalUserId) return { error: notFound("Rated labour not found") };

    const legacyLabour = await db.labour.findOne({ where: { userId: globalUserId }, attributes: ["id"] });
    const link = legacyLabour
      ? await db.workAssignmentLabour.findOne({ where: { workAssignmentId, labourId: legacyLabour.id } })
      : null;
    if (!link) return { error: bad("This labour is not assigned to this work") };

    return {
      assignment: null,
      workAssignment,
      ratedUserId: globalUserId,
      ratedRoleCode: "LABOUR",
      isCompleted: COMPLETED_WORK_STATUSES.includes(workAssignment.status) || COMPLETED_ORDER_STATUSES.includes(order.status),
    };
  }

  return { error: bad("assignmentId is required") };
};

// ── submit rating ─────────────────────────────────────────────────────────────

const submitRatingService = async ({ orderId, assignmentId, workAssignmentId, ratedUserId, ratedRoleCode, stars, feedback, _userId }) => {
  const starValue = normalizeStars(stars);
  if (!orderId || !starValue || !_userId) {
    return bad("orderId and stars are required");
  }

  if (starValue < 1 || starValue > 5) return bad("stars must be between 1 and 5");

  if (_userId === ratedUserId) return bad("You cannot rate yourself");

  const order = await Order.findByPk(orderId);
  if (!order) return notFound("Order not found");

  const requesterId = Number(_userId);
  const isOrderCreator = Number(order.createdByUserId) === requesterId;
  if (!isOrderCreator) {
    return { statusCode: 403, body: { success: false, message: "Only the order creator can rate the provider" } };
  }

  const resolved = await resolveRateableProvider({ order, assignmentId, workAssignmentId, ratedUserId, ratedRoleCode });
  if (resolved.error) return resolved.error;
  if (!resolved.isCompleted) {
    return bad("Rating is allowed only after the order or assignment is completed");
  }

  if (requesterId === Number(resolved.ratedUserId)) return bad("You cannot rate yourself");

  const existingWhere = {
    orderId,
    ratedByUserId: requesterId,
    ratedUserId: resolved.ratedUserId,
  };
  if (resolved.assignment?.id) existingWhere.assignmentId = resolved.assignment.id;
  if (resolved.workAssignment?.id) existingWhere.workAssignmentId = resolved.workAssignment.id;

  const existing = await Rating.findOne({
    where: existingWhere,
  });
  if (existing) return conflict("You have already rated this person for this order");

  const rating = await db.sequelize.transaction(async (transaction) => {
    const createdRating = await Rating.create({
      orderId,
      assignmentId: resolved.assignment?.id || null,
      workAssignmentId: resolved.workAssignment?.id || null,
      ratedByUserId: requesterId,
      ratedUserId: resolved.ratedUserId,
      ratedRoleCode: resolved.ratedRoleCode,
      raterType: "owner",
      rateeType: resolved.ratedRoleCode.toLowerCase(),
      stars: starValue,
      feedback: feedback || null,
    }, { transaction });

    await recalculateProviderSummary(resolved.ratedUserId, resolved.ratedRoleCode, transaction);
    return createdRating;
  });

  return created(rating, "Rating submitted successfully");
};

const updateRatingService = async (id, { stars, feedback, _userId }) => {
  const rating = await Rating.findByPk(id);
  if (!rating) return notFound("Rating not found");
  if (Number(rating.ratedByUserId) !== Number(_userId)) {
    return { statusCode: 403, body: { success: false, message: "You cannot update this rating" } };
  }

  const starValue = normalizeStars(stars);
  if (!starValue || starValue < 1 || starValue > 5) return bad("stars must be between 1 and 5");

  await db.sequelize.transaction(async (transaction) => {
    await rating.update({
      stars: starValue,
      feedback: feedback !== undefined ? feedback : rating.feedback,
    }, { transaction });
    await recalculateProviderSummary(rating.ratedUserId, rating.ratedRoleCode, transaction);
  });

  return ok(rating, "Rating updated successfully");
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
  const roleCode = normalizeRoleCode(rateeType);
  if (roleCode) where.ratedRoleCode = roleCode;

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

const getAllRatingsService = async ({ orderId, ratedUserId, rateeType, roleCode, page = 1, limit = 20 }) => {
  const where = {};
  if (orderId)     where.orderId     = orderId;
  if (ratedUserId) where.ratedUserId = ratedUserId;
  const normalizedRole = normalizeRoleCode(roleCode || rateeType);
  if (normalizedRole) where.ratedRoleCode = normalizedRole;

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
  const { ratedUserId, ratedRoleCode } = rating;
  await db.sequelize.transaction(async (transaction) => {
    await rating.destroy({ transaction });
    await recalculateProviderSummary(ratedUserId, ratedRoleCode, transaction);
  });
  return ok(null, "Rating deleted");
};

module.exports = {
  submitRatingService,
  updateRatingService,
  getRatingsByOrderService,
  getRatingsByUserService,
  getMyGivenRatingsService,
  getAllRatingsService,
  deleteRatingService,
};
