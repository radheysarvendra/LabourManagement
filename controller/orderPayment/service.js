const db = require("../../model/index.js");

const OrderPayment = db.orderPayment;
const Order        = db.order;

// ── helpers ───────────────────────────────────────────────────────────────────

const ok       = (data, msg = "Success")  => ({ statusCode: 200, body: { success: true,  message: msg,  data } });
const created  = (data, msg = "Created")  => ({ statusCode: 201, body: { success: true,  message: msg,  data } });
const bad      = (msg)                    => ({ statusCode: 400, body: { success: false, message: msg } });
const notFound = (msg = "Not found")      => ({ statusCode: 404, body: { success: false, message: msg } });
const conflict = (msg)                    => ({ statusCode: 409, body: { success: false, message: msg } });

// ── fee calculator ────────────────────────────────────────────────────────────
// No service fee when jobValue >= ₹40,000 (platform earns from contractor side)
// Otherwise: 3% of jobValue, minimum ₹30
const calcServiceFee = (jobValue) => {
  if (jobValue >= 40000) return 0;
  return Math.max(parseFloat((jobValue * 0.03).toFixed(2)), 30);
};

// milestone split: 30% before, 40% during, 30% after
const MILESTONES = [
  { milestone: "before_work",      milestonePercent: 30 },
  { milestone: "during_work",      milestonePercent: 40 },
  { milestone: "after_completion", milestonePercent: 30 },
];

// Frontend-friendly type aliases
const MILESTONE_TYPE = {
  before_work:      "advance",
  during_work:      "midway",
  after_completion: "completion",
};

const serializeMilestone = (m) => {
  const json = m.toJSON ? m.toJSON() : m;
  return {
    ...json,
    type:   MILESTONE_TYPE[json.milestone] || json.milestone,
    amount: json.milestoneAmount,
  };
};

// ── initiate payment milestones ───────────────────────────────────────────────

const initiateOrderPaymentService = async ({ orderId, jobValue }) => {
  if (!orderId || !jobValue) return bad("orderId and jobValue are required");

  const jv = parseFloat(jobValue);
  if (isNaN(jv) || jv <= 0) return bad("jobValue must be a positive number");

  const order = await Order.findByPk(orderId);
  if (!order) return notFound("Order not found");

  const existing = await OrderPayment.findOne({ where: { orderId } });
  if (existing) return conflict("Payment milestones already exist for this order. Use the pay or refund endpoints.");

  const serviceFee = calcServiceFee(jv);

  const rows = await db.sequelize.transaction(async (t) => {
    return OrderPayment.bulkCreate(
      MILESTONES.map(({ milestone, milestonePercent }) => {
        const baseAmount = parseFloat(((jv * milestonePercent) / 100).toFixed(2));
        // Service fee is collected upfront with the first milestone
        const milestoneAmount = milestone === "before_work"
          ? parseFloat((baseAmount + serviceFee).toFixed(2))
          : baseAmount;

        return {
          orderId,
          jobValue: jv,
          serviceFee: milestone === "before_work" ? serviceFee : 0,
          milestone,
          milestonePercent,
          milestoneAmount,
          status: "pending",
        };
      }),
      { transaction: t, returning: true }
    );
  });

  return created(
    {
      orderId,
      jobValue: jv,
      serviceFee,
      serviceFeeNote: jv >= 40000
        ? "No service fee — platform earns from contractor side"
        : `3% of ₹${jv} (min ₹30)`,
      milestones: rows.map(serializeMilestone),
    },
    "Payment milestones created successfully"
  );
};

// ── get payment milestones for an order ──────────────────────────────────────

const getOrderPaymentService = async (orderId) => {
  const order = await Order.findByPk(orderId);
  if (!order) return notFound("Order not found");

  const milestones = await OrderPayment.findAll({
    where: { orderId },
    order: [["id", "ASC"]],
  });

  if (!milestones.length) {
    return ok(null, "No payment milestones found. Use /initiate to set up payments.");
  }

  const jobValue   = milestones[0].jobValue;
  const serviceFee = milestones.reduce((s, m) => s + m.serviceFee, 0);
  const totalDue   = milestones.reduce((s, m) => s + m.milestoneAmount, 0);
  const totalPaid  = milestones
    .filter((m) => m.status === "paid")
    .reduce((s, m) => s + m.milestoneAmount, 0);

  return ok({
    orderId,
    jobValue,
    serviceFee,
    totalDue: parseFloat(totalDue.toFixed(2)),
    totalPaid: parseFloat(totalPaid.toFixed(2)),
    balance: parseFloat((totalDue - totalPaid).toFixed(2)),
    milestones: milestones.map(serializeMilestone),
  });
};

// ── mark a milestone as paid ──────────────────────────────────────────────────

const payMilestoneService = async (orderId, milestoneId, { note } = {}) => {
  const milestone = await OrderPayment.findOne({ where: { id: milestoneId, orderId } });
  if (!milestone) return notFound("Milestone not found for this order");

  if (milestone.status === "paid")      return bad("This milestone is already paid");
  if (milestone.status === "refunded")  return bad("This milestone has been refunded");
  if (milestone.status === "cancelled") return bad("This milestone is cancelled");

  // Enforce order: before_work must be paid before during_work, etc.
  if (milestone.milestone === "during_work") {
    const before = await OrderPayment.findOne({ where: { orderId, milestone: "before_work" } });
    if (before?.status !== "paid") return bad("Pay the before_work milestone first");
  }
  if (milestone.milestone === "after_completion") {
    const during = await OrderPayment.findOne({ where: { orderId, milestone: "during_work" } });
    if (during?.status !== "paid") return bad("Pay the during_work milestone first");
  }

  await milestone.update({ status: "paid", paidAt: new Date(), note: note || null });

  return ok(milestone, `${milestone.milestone} payment recorded successfully`);
};

// ── refund the before_work milestone ─────────────────────────────────────────
// Used when the worker cannot do the job — refunds the 30% (job value portion only, not service fee)

const refundBeforeWorkService = async (orderId, { note } = {}) => {
  const before = await OrderPayment.findOne({ where: { orderId, milestone: "before_work" } });
  if (!before) return notFound("before_work milestone not found for this order");

  if (before.status !== "paid") return bad("before_work must be in paid status to refund");

  // Check that during_work and after_completion are still pending (work hasn't started)
  const others = await OrderPayment.findAll({
    where: { orderId, milestone: ["during_work", "after_completion"] },
  });
  const anyPaid = others.some((m) => m.status === "paid");
  if (anyPaid) return bad("Cannot refund — work has already progressed (during_work or after_completion is paid)");

  // Refund amount = only the job value portion (30%), service fee is non-refundable
  const refundAmount = parseFloat((before.milestoneAmount - before.serviceFee).toFixed(2));

  await before.update({
    status: "refunded",
    refundedAt: new Date(),
    note: note || "Worker unable to complete the job",
  });

  return ok(
    { ...before.toJSON(), refundAmount },
    `Refund of ₹${refundAmount} processed (service fee of ₹${before.serviceFee} is non-refundable)`
  );
};

// ── admin: all order payments ─────────────────────────────────────────────────

const getAllOrderPaymentsService = async ({ orderId, status, milestone, page = 1, limit = 20 }) => {
  const where = {};
  if (orderId)   where.orderId   = orderId;
  if (status)    where.status    = status;
  if (milestone) where.milestone = milestone;

  const offset = (Number(page) - 1) * Number(limit);

  const { count, rows } = await OrderPayment.findAndCountAll({
    where,
    include: [{ model: Order, as: "order", attributes: ["id", "orderCode", "skill", "status"] }],
    order: [["createdAt", "DESC"]],
    limit: Number(limit),
    offset,
  });

  return ok({ total: count, page: Number(page), limit: Number(limit), payments: rows });
};

module.exports = {
  initiateOrderPaymentService,
  getOrderPaymentService,
  payMilestoneService,
  refundBeforeWorkService,
  getAllOrderPaymentsService,
};
