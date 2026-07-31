const db         = require("../../model/index.js");
const cloudinary  = require("../../utils/cloudinary");

const Verification   = db.userVerification;
const User          = db.user;
const Admin         = db.admin;

// ── helpers ───────────────────────────────────────────────────────────────────

const ok       = (data, msg = "Success") => ({ statusCode: 200, body: { success: true,  message: msg,  data } });
const bad      = (msg)                   => ({ statusCode: 400, body: { success: false, message: msg } });
const notFound = (msg = "Not found")     => ({ statusCode: 404, body: { success: false, message: msg } });
const forbidden= (msg)                   => ({ statusCode: 403, body: { success: false, message: msg } });
const normalizeVerificationStatus = (value) => {
  const status = String(value || "").toUpperCase();
  if (status === "PENDING") return "PENDING_REVIEW";
  if (status === "APPROVED") return "VERIFIED";
  return status || "NOT_UPLOADED";
};

// ── submit verification request ───────────────────────────────────────────────

const submitVerificationService = async ({ userId, labourId, aadharNumber, documentUrl, cloudinaryPublicId, photoUrl, photoCloudinaryPublicId }) => {
  if (!documentUrl) {
    return bad("Aadhaar number and document are required");
  }

  // Strip spaces/dashes before format-checking
  const cleanAadhar = (aadharNumber || "").replace(/[\s\-]/g, "");
  if (cleanAadhar && !/^\d{12}$/.test(cleanAadhar)) {
    return bad("Aadhaar number must be exactly 12 digits (numbers only)");
  }

  const resolvedUserId = userId || labourId;
  if (!resolvedUserId) {
    return forbidden("Authentication required");
  }

  const user = await User.findByPk(resolvedUserId, { attributes: ["id"] });
  if (!user) return notFound("User not found");

  const [profile] = await Verification.findOrCreate({
    where: { userId: resolvedUserId },
    defaults: { userId: resolvedUserId, verificationStatus: "NOT_UPLOADED" },
  });

  // Locked after admin approval — cannot re-submit
  if (profile.isLocked) {
    return forbidden("Your verification is locked. Documents cannot be changed after approval. Contact admin to unlock.");
  }

  if (String(profile.verificationStatus).toUpperCase() === "VERIFIED") {
    return bad("Your profile is already verified");
  }

  // Require aadhaar: must come from the request OR already be stored on profile
  if (!cleanAadhar && !profile.aadharNumber) {
    return bad("Aadhaar number is required");
  }

  // Only delete from temp/ — never touch already-approved verified/ files
  const isInTemp = id => id && !id.includes("dihadii/verified/");
  if (isInTemp(profile.cloudinaryPublicId)) {
    await cloudinary.uploader.destroy(profile.cloudinaryPublicId).catch(() => {});
  }
  if (isInTemp(profile.photoCloudinaryPublicId) && photoCloudinaryPublicId && photoCloudinaryPublicId !== profile.photoCloudinaryPublicId) {
    await cloudinary.uploader.destroy(profile.photoCloudinaryPublicId).catch(() => {});
  }

  const nextStatus = "PENDING_REVIEW";
  const submittedAt = new Date();

  await profile.update({
    aadharNumber:            cleanAadhar                         || profile.aadharNumber,
    documentUrl:             documentUrl                         || profile.documentUrl,
    cloudinaryPublicId:      cloudinaryPublicId                  || profile.cloudinaryPublicId,
    photoUrl:                photoUrl                            || profile.photoUrl,
    photoCloudinaryPublicId: photoCloudinaryPublicId             || profile.photoCloudinaryPublicId,
    verificationStatus:      nextStatus,
    rejectionReason:         null,
    verificationSubmittedAt: submittedAt,
  });

  return ok(
    {
      verificationStatus:      normalizeVerificationStatus(nextStatus),
      verificationSubmittedAt: submittedAt,
    },
    "Document uploaded successfully. Your document is under review. Admin will review it within 24–48 hours."
  );
};

// ── get own verification status ───────────────────────────────────────────────

const getMyVerificationStatusService = async (userId) => {
  if (!userId) return forbidden("Authentication required");

  const user = await User.findByPk(userId, { attributes: ["id"] });
  if (!user) return notFound("User not found");

  const profile = await Verification.findOne({
    where: { userId },
    attributes: [
      "userId", "verificationStatus",
    "verificationSubmittedAt", "verifiedAt", "rejectionReason",
      "aadharNumber", "documentUrl", "photoUrl", "isLocked",
    ],
  });

  if (!profile) return ok({
    userId: Number(userId),
    verificationStatus: "NOT_UPLOADED",
    statusMessage: "No identity document has been uploaded yet.",
    isLocked: false,
  });

  const statusMessages = {
    pending_review: "Your documents have been submitted successfully. Admin review usually takes 24-48 hours.",
    pending:  "Your documents have been submitted successfully. Admin review usually takes 24–48 hours.",
    verified: "Your identity verification is approved.",
    rejected: `Your document was rejected. Please upload again.${profile.rejectionReason ? ` Reason: ${profile.rejectionReason}` : ""}`,
  };
  const normalizedStatus = normalizeVerificationStatus(profile.verificationStatus);

  return ok({
    ...profile.toJSON(),
    verificationStatus: normalizedStatus,
    statusMessage: statusMessages[String(profile.verificationStatus || "").toLowerCase()] || statusMessages[String(normalizedStatus || "").toLowerCase()] || "Unknown status",
  });
};

// ── admin: get all pending/filtered verifications ─────────────────────────────

const getVerificationsService = async ({ verificationStatus, userId, page = 1, limit = 20 }) => {
  const where = {};
  if (verificationStatus) where.verificationStatus = normalizeVerificationStatus(verificationStatus);
  if (userId)             where.userId             = userId;

  const offset = (Number(page) - 1) * Number(limit);

  // Accurate summary counts across ALL records, not just the current page
  const [pendingCount, verifiedCount, rejectedCount, { count, rows }] = await Promise.all([
    Verification.count({ where: { verificationStatus: "PENDING_REVIEW" } }),
    Verification.count({ where: { verificationStatus: "VERIFIED" } }),
    Verification.count({ where: { verificationStatus: "REJECTED" } }),
    Verification.findAndCountAll({
      where,
      include: [
        { model: User, as: "user", attributes: ["id", "name", "phone"] },
      ],
      attributes: [
        "userId", "verificationStatus",
        "verificationSubmittedAt", "verifiedAt", "rejectionReason",
        "aadharNumber", "documentUrl", "photoUrl", "isLocked",
      ],
      order: [["verificationSubmittedAt", "DESC"]],
      limit:  Number(limit),
      offset,
    }),
  ]);

  const summary = { pending: pendingCount, verified: verifiedCount, rejected: rejectedCount };
  const totalPages = Math.max(1, Math.ceil(count / Number(limit)));

  return ok({ total: count, page: Number(page), limit: Number(limit), totalPages, summary, verifications: rows });
};

// ── admin: approve verification ───────────────────────────────────────────────

const approveVerificationService = async (labourUserId, adminId) => {
  const profile = await Verification.findOne({ where: { userId: labourUserId } });
  if (!profile) return notFound("User verification not found");

  if (profile.verificationStatus === "VERIFIED") return bad("Already verified");
  if (profile.verificationStatus !== "PENDING_REVIEW") return bad("No pending verification request found");

  // Move Cloudinary files from dihadii/temp/ → dihadii/verified/
  const moveToVerified = async (publicId, currentUrl) => {
    if (!publicId || publicId.includes("dihadii/verified/")) return { url: currentUrl, id: publicId };
    try {
      const newId  = publicId.replace("dihadii/temp/", "dihadii/verified/");
      const moved  = await cloudinary.uploader.rename(publicId, newId);
      return { url: moved.secure_url, id: newId };
    } catch (err) {
      console.warn("Cloudinary rename failed (continuing):", err.message);
      return { url: currentUrl, id: publicId };
    }
  };

  const [doc, photo] = await Promise.all([
    moveToVerified(profile.cloudinaryPublicId,      profile.documentUrl),
    moveToVerified(profile.photoCloudinaryPublicId, profile.photoUrl),
  ]);

  await profile.update({
    verificationStatus:      "VERIFIED",
    verifiedByAdminId:       adminId || null,
    verifiedAt:              new Date(),
    rejectionReason:         null,
    documentUrl:             doc.url,
    cloudinaryPublicId:      doc.id,
    photoUrl:                photo.url,
    photoCloudinaryPublicId: photo.id,
    isLocked:                true,
  });

  // Sync isVerified flag on the labours table for fast filtering

  const user = await User.findByPk(labourUserId, { attributes: ["id", "name", "phone"] });

  return ok(
    { profile, user },
    `User ${user?.name || labourUserId} has been verified successfully`
  );
};

// ── admin: reject verification ────────────────────────────────────────────────

const rejectVerificationService = async (labourUserId, { rejectionReason, adminId } = {}) => {
  if (!rejectionReason) return bad("rejectionReason is required when rejecting");

  const profile = await Verification.findOne({ where: { userId: labourUserId } });
  if (!profile) return notFound("User verification not found");

  if (profile.verificationStatus === "VERIFIED") return bad("Cannot reject an already verified profile");
  if (profile.verificationStatus !== "PENDING_REVIEW") return bad("No pending verification request found");

  // Delete both document and photo from Cloudinary temp folder
  await Promise.allSettled([
    profile.cloudinaryPublicId
      ? cloudinary.uploader.destroy(profile.cloudinaryPublicId, { resource_type: "image" })
      : Promise.resolve(),
    profile.photoCloudinaryPublicId
      ? cloudinary.uploader.destroy(profile.photoCloudinaryPublicId, { resource_type: "image" })
      : Promise.resolve(),
  ]);

  await profile.update({
    verificationStatus:      "REJECTED",
    rejectionReason,
    verifiedByAdminId:       adminId || null,
    verifiedAt:              null,
    documentUrl:             null,
    cloudinaryPublicId:      null,
    photoUrl:                null,
    photoCloudinaryPublicId: null,
  });

  // Sync isVerified flag — rejected labour is not verified

  const user = await User.findByPk(labourUserId, { attributes: ["id", "name", "phone"] });

  return ok(
    { profile, user },
    `Verification rejected for ${user?.name || labourUserId}`
  );
};

// ── admin: revoke verification (revert to pending) ────────────────────────────

const revokeVerificationService = async (labourUserId) => {
  const profile = await Verification.findOne({ where: { userId: labourUserId } });
  if (!profile) return notFound("User verification not found");

  if (profile.verificationStatus !== "VERIFIED") return bad("Profile is not currently verified");

  await profile.update({
    verificationStatus: "PENDING_REVIEW",
    verifiedByAdminId:  null,
    verifiedAt:         null,
    rejectionReason:    null,
    isLocked:           false,
  });

  // Sync isVerified flag — revoked labour is no longer verified

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
