const db = require("../../model/index.js");

const ContractorLead    = db.contractorLead;
const Order             = db.order;
const User              = db.user;
const ContractorProfile = db.contractorProfile;

// ── helpers ───────────────────────────────────────────────────────────────────

const ok       = (data, msg = "Success") => ({ statusCode: 200, body: { success: true,  message: msg,  data } });
const created  = (data, msg = "Created") => ({ statusCode: 201, body: { success: true,  message: msg,  data } });
const bad      = (msg)                   => ({ statusCode: 400, body: { success: false, message: msg } });
const notFound = (msg = "Not found")     => ({ statusCode: 404, body: { success: false, message: msg } });
const conflict = (msg)                   => ({ statusCode: 409, body: { success: false, message: msg } });
const forbidden= (msg)                   => ({ statusCode: 403, body: { success: false, message: msg } });

// ── lead size + fee from project value ───────────────────────────────────────
// Small (≤ ₹50,000) → ₹100 | Medium (₹50k–₹2L) → ₹200 | Large (₹2L+) → ₹500
const calcLeadSize = (projectValue) => {
  if (projectValue <= 50000)  return { leadSize: "small",  leadFee: 100 };
  if (projectValue <= 200000) return { leadSize: "medium", leadFee: 200 };
  return                             { leadSize: "large",  leadFee: 500 };
};

// ── contractor service fee % from project value ───────────────────────────────
// ≤ ₹50k → 5% | ₹50k–₹2L → 3% | ₹2L–₹10L → 2% | ₹10L+ → 1%
const calcServiceFeePercent = (projectValue) => {
  if (projectValue <= 50000)   return 5;
  if (projectValue <= 200000)  return 3;
  if (projectValue <= 1000000) return 2;
  return 1;
};

// Mask contact details until lead fee is paid
const maskOrder = (order) => {
  const json = order.toJSON ? order.toJSON() : { ...order };
  return {
    id:           json.id,
    orderCode:    json.orderCode,
    skill:        json.skill,
    categoryName: json.categoryName,
    needType:     json.needType,
    district:     json.district,
    state:        json.state,
    pincode:      json.pincode,
    postOffice:   json.postOffice,
    requiredDate: json.requiredDate,
    status:       json.status,
    // contact hidden
    ownerName:  "****",
    ownerPhone: "****",
  };
};

// ── express interest / create lead ───────────────────────────────────────────

const createLeadService = async ({ orderId, projectValue, contractorUserId }) => {
  if (!orderId || !projectValue || !contractorUserId) {
    return bad("orderId, projectValue, and contractorUserId are required");
  }

  const pv = parseFloat(projectValue);
  if (isNaN(pv) || pv <= 0) return bad("projectValue must be a positive number");

  const order = await Order.findByPk(orderId);
  if (!order) return notFound("Order not found");
  if (order.needType !== "contractor") return bad("This order is not for a contractor");

  const contractor = await ContractorProfile.findOne({ where: { userId: contractorUserId } });
  if (!contractor) return forbidden("Only registered contractors can express interest");

  const existing = await ContractorLead.findOne({ where: { orderId, contractorUserId } });
  if (existing) return conflict("You have already expressed interest in this order");

  const { leadSize, leadFee }     = calcLeadSize(pv);
  const serviceFeePercent         = calcServiceFeePercent(pv);
  const serviceFeeAmount          = parseFloat(((pv * serviceFeePercent) / 100).toFixed(2));

  const lead = await ContractorLead.create({
    orderId,
    contractorUserId,
    projectValue: pv,
    leadSize,
    leadFee,
    contactUnlocked: false,
    leadStatus: "pending_payment",
    serviceFeePercent,
    serviceFeeAmount,
    serviceFeeStatus: "pending",
  });

  return created(
    {
      lead,
      orderPreview: maskOrder(order),
      nextStep: `Pay lead fee of ₹${leadFee} to unlock owner contact details`,
    },
    "Interest expressed. Pay lead fee to unlock contact details."
  );
};

// ── pay lead fee → unlock contact details ────────────────────────────────────

const payLeadFeeService = async (leadId, contractorUserId) => {
  const lead = await ContractorLead.findByPk(leadId);
  if (!lead) return notFound("Lead not found");
  if (lead.contractorUserId !== contractorUserId) return forbidden("Access denied");
  if (lead.leadStatus === "paid")      return bad("Lead fee already paid");
  if (lead.leadStatus === "cancelled") return bad("This lead is cancelled");

  await lead.update({
    leadStatus:      "paid",
    contactUnlocked: true,
    leadPaidAt:      new Date(),
  });

  // Fetch full order with contact details now that fee is paid
  const order = await Order.findByPk(lead.orderId);

  return ok(
    {
      lead,
      ownerName:  order.ownerName,
      ownerPhone: order.ownerPhone,
      order: order.toJSON ? order.toJSON() : order,
    },
    `Lead fee of ₹${lead.leadFee} paid. Contact details unlocked.`
  );
};

// ── pay contractor service fee (after winning the contract) ──────────────────

const payServiceFeeService = async (leadId, contractorUserId) => {
  const lead = await ContractorLead.findByPk(leadId);
  if (!lead) return notFound("Lead not found");
  if (lead.contractorUserId !== contractorUserId) return forbidden("Access denied");
  if (lead.leadStatus !== "paid") return bad("Lead fee must be paid before paying service fee");
  if (lead.serviceFeeStatus === "paid")   return bad("Service fee already paid");
  if (lead.serviceFeeStatus === "waived") return bad("Service fee has been waived by admin");

  await lead.update({
    serviceFeeStatus:  "paid",
    serviceFeePaidAt:  new Date(),
  });

  return ok(lead, `Service fee of ₹${lead.serviceFeeAmount} (${lead.serviceFeePercent}%) paid successfully`);
};

// ── get my leads (contractor) ─────────────────────────────────────────────────

const getMyLeadsService = async (contractorUserId, { leadStatus, serviceFeeStatus, page = 1, limit = 20 }) => {
  const where = { contractorUserId };
  if (leadStatus)       where.leadStatus       = leadStatus;
  if (serviceFeeStatus) where.serviceFeeStatus = serviceFeeStatus;

  const offset = (Number(page) - 1) * Number(limit);

  const { count, rows } = await ContractorLead.findAndCountAll({
    where,
    include: [{ model: Order, as: "order", attributes: ["id", "orderCode", "skill", "district", "state", "status", "needType", "requiredDate"] }],
    order: [["createdAt", "DESC"]],
    limit: Number(limit),
    offset,
  });

  // Mask contact details for leads where fee is not paid
  const leads = rows.map((row) => {
    const json = row.toJSON ? row.toJSON() : row;
    if (!json.contactUnlocked && json.order) {
      json.order.ownerName  = "****";
      json.order.ownerPhone = "****";
    }
    return json;
  });

  return ok({ total: count, page: Number(page), limit: Number(limit), leads });
};

// ── get single lead ───────────────────────────────────────────────────────────

const getLeadByIdService = async (leadId, contractorUserId) => {
  const lead = await ContractorLead.findByPk(leadId, {
    include: [{ model: Order, as: "order" }],
  });
  if (!lead) return notFound("Lead not found");
  if (lead.contractorUserId !== contractorUserId) return forbidden("Access denied");

  const json = lead.toJSON ? lead.toJSON() : lead;
  if (!json.contactUnlocked && json.order) {
    json.order.ownerName  = "****";
    json.order.ownerPhone = "****";
  }

  return ok(json);
};

// ── admin: all leads ──────────────────────────────────────────────────────────

const getAllLeadsService = async ({ orderId, contractorUserId, leadStatus, serviceFeeStatus, leadSize, page = 1, limit = 20 }) => {
  const where = {};
  if (orderId)          where.orderId          = orderId;
  if (contractorUserId) where.contractorUserId = contractorUserId;
  if (leadStatus)       where.leadStatus       = leadStatus;
  if (serviceFeeStatus) where.serviceFeeStatus = serviceFeeStatus;
  if (leadSize)         where.leadSize         = leadSize;

  const offset = (Number(page) - 1) * Number(limit);

  const { count, rows } = await ContractorLead.findAndCountAll({
    where,
    include: [
      { model: Order, as: "order", attributes: ["id", "orderCode", "skill", "ownerName", "ownerPhone", "district", "state", "status"] },
      { model: User,  as: "contractor", attributes: ["id", "name", "phone"] },
    ],
    order: [["createdAt", "DESC"]],
    limit: Number(limit),
    offset,
  });

  const totalLeadRevenue    = rows.filter((r) => r.leadStatus === "paid").reduce((s, r) => s + r.leadFee, 0);
  const totalServiceRevenue = rows.filter((r) => r.serviceFeeStatus === "paid").reduce((s, r) => s + r.serviceFeeAmount, 0);

  return ok({
    total: count,
    page: Number(page),
    limit: Number(limit),
    totalLeadRevenue,
    totalServiceRevenue,
    leads: rows,
  });
};

// ── admin: waive service fee ──────────────────────────────────────────────────

const waiveServiceFeeService = async (leadId, { note } = {}) => {
  const lead = await ContractorLead.findByPk(leadId);
  if (!lead) return notFound("Lead not found");
  if (lead.serviceFeeStatus === "paid") return bad("Service fee already paid, cannot waive");

  await lead.update({ serviceFeeStatus: "waived", note: note || "Waived by admin" });
  return ok(lead, "Service fee waived");
};

module.exports = {
  createLeadService,
  payLeadFeeService,
  payServiceFeeService,
  getMyLeadsService,
  getLeadByIdService,
  getAllLeadsService,
  waiveServiceFeeService,
};
