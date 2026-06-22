const db = require("../../model/index.js");

const LabourProfile = db.labourProfile;
const User          = db.user;
const Admin         = db.admin;

// ── helpers ───────────────────────────────────────────────────────────────────

const ok       = (data, msg = "Success") => ({ statusCode: 200, body: { success: true,  message: msg,  data } });
const bad      = (msg)                   => ({ statusCode: 400, body: { success: false, message: msg } });
const notFound = (msg = "Not found")     => ({ statusCode: 404, body: { success: false, message: msg } });
const forbidden= (msg)                   => ({ statusCode: 403, body: { success: false, message: msg } });

// ── submit verification request ───────────────────────────────────────────────

const submitVerificationService = async ({ userId, aadharNumber, documentUrl }) => {
  if (!aadharNumber && !documentUrl) {
    return bad("Provide at least one: aadharNumber or documentUrl");
  }

  const profile = await LabourProfile.findOne({ where: { userId } });
  if (!profile) return notFound("Labour profile not found. Complete your profile first.");

  if (profile.verificationStatus === "verified") {
    return bad("Your profile is already verified");
  }

  await profile.update({
    aadharNumber:            aadharNumber  || profile.aadharNumber,
    documentUrl:             documentUrl   || profile.documentUrl,
    verificationStatus:      "pending",
    rejectionReason:         null,
    verificationSubmittedAt: new Date(),
  });

  return ok(
    {
      verificationStatus:      profile.verificationStatus,
      verificationSubmittedAt: profile.verificationSubmittedAt,
    },
    "Verification request submitted. Admin will review and approve shortly."
  );
};

// ── get own verification status ───────────────────────────────────────────────

const getMyVerificationStatusService = async (userId) => {
  const profile = await LabourProfile.findOne({
    where: { userId },
    attributes: [
      "userId", "labourCode", "verificationStatus",
      "verificationSubmittedAt", "verifiedAt", "rejectionReason",
      "aadharNumber", "documentUrl",
    ],
  });

  if (!profile) return notFound("Labour profile not found");

  const statusMessages = {
    pending:  "Your verification is under review",
    verified: "Your profile is verified",
    rejected: `Verification rejected: ${profile.rejectionReason || "No reason provided"}`,
  };

  return ok({
    ...profile.toJSON(),
    statusMessage: statusMessages[profile.verificationStatus] || "Unknown status",
  });
};

// ── admin: get all pending/filtered verifications ─────────────────────────────

const getVerificationsService = async ({ verificationStatus, page = 1, limit = 20 }) => {
  const where = {};
  if (verificationStatus) where.verificationStatus = verificationStatus;

  const offset = (Number(page) - 1) * Number(limit);

  const { count, rows } = await LabourProfile.findAndCountAll({
    where,
    include: [{
      model: User,
      as: "user",
      attributes: ["id", "name", "phone"],
    }],
    attributes: [
      "userId", "labourCode", "verificationStatus",
      "verificationSubmittedAt", "verifiedAt", "rejectionReason",
      "aadharNumber", "documentUrl",
    ],
    order: [["verificationSubmittedAt", "DESC"]],
    limit:  Number(limit),
    offset,
  });

  const summary = {
    pending:  rows.filter((r) => r.verificationStatus === "pending").length,
    verified: rows.filter((r) => r.verificationStatus === "verified").length,
    rejected: rows.filter((r) => r.verificationStatus === "rejected").length,
  };

  return ok({ total: count, page: Number(page), limit: Number(limit), summary, verifications: rows });
};

// ── admin: approve verification ───────────────────────────────────────────────

const approveVerificationService = async (labourUserId, adminId) => {
  const profile = await LabourProfile.findOne({ where: { userId: labourUserId } });
  if (!profile) return notFound("Labour profile not found");

  if (profile.verificationStatus === "verified") return bad("Already verified");
  if (profile.verificationStatus !== "pending")  return bad("No pending verification request found");

  await profile.update({
    verificationStatus: "verified",
    verifiedByAdminId:  adminId || null,
    verifiedAt:         new Date(),
    rejectionReason:    null,
  });

  const user = await User.findByPk(labourUserId, { attributes: ["id", "name", "phone"] });

  return ok(
    { profile, user },
    `Labour ${user?.name || labourUserId} has been verified successfully`
  );
};

// ── admin: reject verification ────────────────────────────────────────────────

const rejectVerificationService = async (labourUserId, { rejectionReason, adminId } = {}) => {
  if (!rejectionReason) return bad("rejectionReason is required when rejecting");

  const profile = await LabourProfile.findOne({ where: { userId: labourUserId } });
  if (!profile) return notFound("Labour profile not found");

  if (profile.verificationStatus === "verified") return bad("Cannot reject an already verified profile");
  if (profile.verificationStatus !== "pending")  return bad("No pending verification request found");

  await profile.update({
    verificationStatus: "rejected",
    rejectionReason,
    verifiedByAdminId:  adminId || null,
    verifiedAt:         null,
  });

  const user = await User.findByPk(labourUserId, { attributes: ["id", "name", "phone"] });

  return ok(
    { profile, user },
    `Verification rejected for ${user?.name || labourUserId}`
  );
};

// ── admin: revoke verification (revert to pending) ────────────────────────────

const revokeVerificationService = async (labourUserId) => {
  const profile = await LabourProfile.findOne({ where: { userId: labourUserId } });
  if (!profile) return notFound("Labour profile not found");

  if (profile.verificationStatus !== "verified") return bad("Profile is not currently verified");

  await profile.update({
    verificationStatus: "pending",
    verifiedByAdminId:  null,
    verifiedAt:         null,
    rejectionReason:    null,
  });

  return ok(profile, "Verification revoked. Profile set back to pending.");
};

module.exports = {
  submitVerificationService,
  getMyVerificationStatusService,
  getVerificationsService,
  approveVerificationService,
  rejectVerificationService,
  revokeVerificationService,
};
