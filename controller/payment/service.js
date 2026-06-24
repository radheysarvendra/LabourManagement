const db = require("../../model/index.js");

const OrderPayment    = db.orderPayment;
const ContractorLead  = db.contractorLead;
const Order           = db.order;

const ok       = (data, msg = "Success") => ({ statusCode: 200, body: { success: true,  message: msg, data } });
const bad      = (msg)                   => ({ statusCode: 400, body: { success: false, message: msg } });
const notFound = (msg = "Not found")     => ({ statusCode: 404, body: { success: false, message: msg } });

// ── GET /api/payment/config ───────────────────────────────────────────────────
// Returns UPI ID so the app can build the deeplink without hardcoding

const getPaymentConfigService = () => {
  const upiId       = process.env.UPI_ID       || "";
  const businessName= process.env.BUSINESS_NAME || "Dehaade";

  if (!upiId) {
    return { statusCode: 503, body: { success: false, message: "Payment not configured. Contact support." } };
  }

  return ok({
    upiId,
    businessName,
    currency: "INR",
    deeplink: `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(businessName)}&cu=INR`,
  }, "Payment config fetched");
};

// ── POST /api/payment/verify ──────────────────────────────────────────────────
// Called by app AFTER user completes UPI payment
// Records transaction details and marks the target as paid

const verifyPaymentService = async (payload, userId) => {
  const {
    paymentType,     // "milestone" | "lead_fee" | "service_fee"
    orderId,
    milestoneId,
    leadId,
    amount,
    upiRef,
    paidAt,
  } = payload;

  const paymentMethod = payload.paymentMethod || "upi";
  const isCash = paymentMethod === "cod" || paymentMethod === "cash";
  // Cash payments don't have a transaction ID — generate a reference
  const transactionId = payload.transactionId || (isCash ? `CASH-${Date.now()}` : null);

  if (!paymentType)    return bad("paymentType is required");
  if (!transactionId)  return bad("transactionId is required");
  if (!amount || Number(amount) <= 0) return bad("Valid amount is required");

  // ── milestone payment ──────────────────────────────────────────────────────
  if (paymentType === "milestone") {
    if (!orderId || !milestoneId) return bad("orderId and milestoneId are required for milestone payment");

    const milestone = await OrderPayment.findOne({ where: { id: milestoneId, orderId } });
    if (!milestone) return notFound("Milestone not found");
    if (milestone.status === "paid") return bad("This milestone is already paid");

    // Enforce milestone order
    if (milestone.milestone === "during_work") {
      const before = await OrderPayment.findOne({ where: { orderId, milestone: "before_work" } });
      if (before?.status !== "paid") return bad("Pay the before_work milestone first");
    }
    if (milestone.milestone === "after_completion") {
      const during = await OrderPayment.findOne({ where: { orderId, milestone: "during_work" } });
      if (during?.status !== "paid") return bad("Pay the during_work milestone first");
    }

    await milestone.update({
      status: "paid",
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      transactionId,
      upiRef: upiRef || null,
      paymentMethod: "upi",
    });

    return ok({
      milestone: milestone.milestone,
      amount: milestone.milestoneAmount,
      transactionId,
      paidAt: milestone.paidAt,
    }, `${milestone.milestone} payment recorded`);
  }

  // ── lead fee payment ───────────────────────────────────────────────────────
  if (paymentType === "lead_fee") {
    if (!leadId) return bad("leadId is required for lead_fee payment");

    const lead = await ContractorLead.findByPk(leadId);
    if (!lead) return notFound("Lead not found");
    if (userId && lead.contractorUserId !== userId) {
      return { statusCode: 403, body: { success: false, message: "Access denied" } };
    }
    if (lead.leadStatus === "paid") return bad("Lead fee already paid");

    await lead.update({
      leadStatus: "paid",
      contactUnlocked: true,
      leadPaidAt: paidAt ? new Date(paidAt) : new Date(),
      transactionId,
      upiRef: upiRef || null,
    });

    return ok({
      leadId: lead.id,
      leadFee: lead.leadFee,
      contactUnlocked: true,
      transactionId,
    }, "Lead fee paid — contact details unlocked");
  }

  // ── service fee payment ────────────────────────────────────────────────────
  if (paymentType === "service_fee") {
    if (!leadId) return bad("leadId is required for service_fee payment");

    const lead = await ContractorLead.findByPk(leadId);
    if (!lead) return notFound("Lead not found");
    if (lead.serviceFeeStatus === "paid") return bad("Service fee already paid");

    await lead.update({
      serviceFeeStatus: "paid",
      serviceFeePaidAt: paidAt ? new Date(paidAt) : new Date(),
      transactionId,
      upiRef: upiRef || null,
    });

    return ok({
      leadId: lead.id,
      serviceFeeAmount: lead.serviceFeeAmount,
      transactionId,
    }, "Service fee payment recorded");
  }

  return bad(`Invalid paymentType: ${paymentType}. Use milestone | lead_fee | service_fee`);
};

// ── GET /api/payment/history ──────────────────────────────────────────────────
// Returns all payments made by this user (milestone + lead fees)

const getPaymentHistoryService = async (userId, { page = 1, limit = 20 } = {}) => {
  const offset    = (Number(page) - 1) * Number(limit);
  const pageLimit = Math.min(Number(limit) || 20, 50);

  // Milestone payments — via orders they created
  const milestones = await OrderPayment.findAll({
    where: { status: "paid" },
    include: [{
      model: Order,
      as: "order",
      where: { createdByUserId: userId },
      required: true,
      attributes: ["id", "orderCode", "skill", "status"],
    }],
    order: [["paidAt", "DESC"]],
    limit: pageLimit,
    offset,
  });

  // Lead fee payments — by this contractor
  const leads = await ContractorLead.findAll({
    where: { contractorUserId: userId, leadStatus: "paid" },
    include: [{
      model: Order,
      as: "order",
      attributes: ["id", "orderCode", "skill"],
    }],
    order: [["leadPaidAt", "DESC"]],
    limit: pageLimit,
    offset,
  });

  const history = [
    ...milestones.map((m) => ({
      type: "milestone",
      paymentType: m.milestone,
      amount: m.milestoneAmount,
      transactionId: m.transactionId,
      upiRef: m.upiRef,
      paidAt: m.paidAt,
      order: m.order,
    })),
    ...leads.map((l) => ({
      type: "lead_fee",
      amount: l.leadFee,
      transactionId: l.transactionId,
      upiRef: l.upiRef,
      paidAt: l.leadPaidAt,
      order: l.order,
    })),
  ].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

  return ok({ total: history.length, page: Number(page), data: history }, "Payment history fetched");
};

module.exports = {
  getPaymentConfigService,
  verifyPaymentService,
  getPaymentHistoryService,
};
