const db         = require("../../model/index.js");
const cloudinary  = require("../../utils/cloudinary");

const LabourProfile = db.labourProfile;
const Labour        = db.labour;
const User          = db.user;
const Admin         = db.admin;

// ── helpers ───────────────────────────────────────────────────────────────────

const ok       = (data, msg = "Success") => ({ statusCode: 200, body: { success: true,  message: msg,  data } });
const bad      = (msg)                   => ({ statusCode: 400, body: { success: false, message: msg } });
const notFound = (msg = "Not found")     => ({ statusCode: 404, body: { success: false, message: msg } });
const forbidden= (msg)                   => ({ statusCode: 403, body: { success: false, message: msg } });

// ── submit verification request ───────────────────────────────────────────────

const submitVerificationService = async ({ userId, aadharNumber, documentUrl, cloudinaryPublicId }) => {
  if (!aadharNumber && !documentUrl) {
    return bad("Provide at least one: aadharNumber or documentUrl");
  }

  const profile = await LabourProfile.findOne({ where: { userId } });
  if (!profile) return notFound("Labour profile not found. Complete your profile first.");

  if (profile.verificationStatus === "verified") {
    return bad("Your profile is already verified");
  }

  // If re-submitting, delete old temp document from Cloudinary
  if (profile.cloudinaryPublicId && profile.verificationStatus !== "verified") {
    await cloudinary.uploader.destroy(profile.cloudinaryPublicId).catch(() => {});
  }

  await profile.update({
    aadharNumber:            aadharNumber      || profile.aadharNumber,
    documentUrl:             documentUrl       || profile.documentUrl,
    cloudinaryPublicId:      cloudinaryPublicId || profile.cloudinaryPublicId,
    verificationStatus:      "pending",
    rejectionReason:         null,
    verificationSubmittedAt: new Date(),
  });

  return ok(
    {
      verificationStatus:      "pending",
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

const getVerificationsService = async ({ verificationStatus, userId, page = 1, limit = 20 }) => {
  const where = {};
  if (verificationStatus) where.verificationStatus = verificationStatus;
  if (userId)             where.userId             = userId;

  const offset = (Number(page) - 1) * Number(limit);

  // Accurate summary counts across ALL records, not just the current page
  const [pendingCount, verifiedCount, rejectedCount, { count, rows }] = await Promise.all([
    LabourProfile.count({ where: { verificationStatus: "pending" } }),
    LabourProfile.count({ where: { verificationStatus: "verified" } }),
    LabourProfile.count({ where: { verificationStatus: "rejected" } }),
    LabourProfile.findAndCountAll({
      where,
      include: [
        { model: User, as: "user", attributes: ["id", "name", "phone"] },
      ],
      attributes: [
        "userId", "labourCode", "verificationStatus",
        "verificationSubmittedAt", "verifiedAt", "rejectionReason",
        "aadharNumber", "documentUrl",
      ],
      order: [["verificationSubmittedAt", "DESC"]],
      limit:  Number(limit),
      offset,
    }),
  ]);

  const summary = { pending: pendingCount, verified: verifiedCount, rejected: rejectedCount };
  const totalPages = Math.ceil(count / Number(limit));

  return ok({ total: count, page: Number(page), limit: Number(limit), totalPages, summary, verifications: rows });
};

// ── admin: approve verification ───────────────────────────────────────────────

const approveVerificationService = async (labourUserId, adminId) => {
  const profile = await LabourProfile.findOne({ where: { userId: labourUserId } });
  if (!profile) return notFound("Labour profile not found");

  if (profile.verificationStatus === "verified") return bad("Already verified");
  if (profile.verificationStatus !== "pending")  return bad("No pending verification request found");

  // Move Cloudinary file from dehaade/temp/ → dehaade/verified/
  let newDocumentUrl = profile.documentUrl;
  let newPublicId    = profile.cloudinaryPublicId;

  if (profile.cloudinaryPublicId) {
    try {
      const oldId = profile.cloudinaryPublicId;
      const newId = oldId.replace("dehaade/temp/", "dehaade/verified/");
      const moved = await cloudinary.uploader.rename(oldId, newId);
      newDocumentUrl = moved.secure_url;
      newPublicId    = newId;
    } catch (err) {
      console.warn("Cloudinary rename failed (continuing approval):", err.message);
    }
  }

  await profile.update({
    verificationStatus: "verified",
    verifiedByAdminId:  adminId || null,
    verifiedAt:         new Date(),
    rejectionReason:    null,
    documentUrl:        newDocumentUrl,
    cloudinaryPublicId: newPublicId,
  });

  // Sync isVerified flag on the labours table for fast filtering
  await Labour.update({ isVerified: true }, { where: { userId: labourUserId } });

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

  // Delete document from Cloudinary temp folder
  if (profile.cloudinaryPublicId) {
    await cloudinary.uploader.destroy(profile.cloudinaryPublicId, { resource_type: "image" }).catch(() => {});
  }

  await profile.update({
    verificationStatus: "rejected",
    rejectionReason,
    verifiedByAdminId:  adminId || null,
    verifiedAt:         null,
    documentUrl:        null,
    cloudinaryPublicId: null,
  });

  // Sync isVerified flag — rejected labour is not verified
  await Labour.update({ isVerified: false }, { where: { userId: labourUserId } });

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
