const db         = require("../../model/index.js");
const cloudinary  = require("../../utils/cloudinary");

const LabourProfile = db.userVerification || db.labourProfile;
const Labour        = db.labour;
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

const submitVerificationService = async ({ userId, aadharNumber, documentUrl, cloudinaryPublicId, photoUrl, photoCloudinaryPublicId }) => {
  if (!documentUrl) {
    return bad("Aadhaar number and document are required");
  }

  // Strip spaces/dashes before format-checking
  const cleanAadhar = (aadharNumber || "").replace(/[\s\-]/g, "");
  if (cleanAadhar && !/^\d{12}$/.test(cleanAadhar)) {
    return bad("Aadhaar number must be exactly 12 digits (numbers only)");
  }

  if (!userId) return forbidden("Authentication required");

  let profile = await LabourProfile.findOne({ where: { userId } });
  if (!profile) {
    const labour = await Labour.findOne({ where: { userId } });
    if (!labour) return notFound("Labour profile not found. Complete your profile first.");

    [profile] = await LabourProfile.findOrCreate({
      where: { userId },
      defaults: {
        userId,
        userCode: labour.labourCode || null,
        experienceYears: labour.experienceYears || 0,
        isAvailable: labour.isAvailable !== false,
        verificationStatus: labour.isVerified ? "verified" : "pending",
      },
    });
  }

  // Locked after admin approval — cannot re-submit
  if (profile.isLocked) {
    return forbidden("Your verification is locked. Documents cannot be changed after approval. Contact admin to unlock.");
  }

  if (profile.verificationStatus === "verified") {
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

  const nextStatus = "pending";

  await profile.update({
    aadharNumber:            cleanAadhar                         || profile.aadharNumber,
    documentUrl:             documentUrl                         || profile.documentUrl,
    cloudinaryPublicId:      cloudinaryPublicId                  || profile.cloudinaryPublicId,
    photoUrl:                photoUrl                            || profile.photoUrl,
    photoCloudinaryPublicId: photoCloudinaryPublicId             || profile.photoCloudinaryPublicId,
    verificationStatus:      nextStatus,
    rejectionReason:         null,
    verificationSubmittedAt: new Date(),
  });

  return ok(
    {
      verificationStatus:      normalizeVerificationStatus(nextStatus),
      verificationSubmittedAt: new Date(),
    },
    "Document uploaded successfully. Your document is under review. Admin will review it within 24–48 hours."
  );
};

// ── get own verification status ───────────────────────────────────────────────

const getMyVerificationStatusService = async (userId) => {
  const profile = await LabourProfile.findOne({
    where: { userId },
    attributes: [
      "userId", "userCode", "verificationStatus",
    "verificationSubmittedAt", "verifiedAt", "rejectionReason",
      "aadharNumber", "documentUrl", "photoUrl", "isLocked",
    ],
  });

  if (!profile) return notFound("Labour profile not found");

  const statusMessages = {
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
  if (verificationStatus) where.verificationStatus = String(verificationStatus).toLowerCase() === "pending_review"
    ? "pending"
    : String(verificationStatus).toLowerCase() === "verified"
      ? "verified"
      : String(verificationStatus).toLowerCase();
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
        "userId", "userCode", "verificationStatus",
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
  const profile = await LabourProfile.findOne({ where: { userId: labourUserId } });
  if (!profile) return notFound("Labour profile not found");

  if (profile.verificationStatus === "verified") return bad("Already verified");
  if (profile.verificationStatus !== "pending")  return bad("No pending verification request found");

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
    verificationStatus:      "verified",
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
    verificationStatus:      "rejected",
    rejectionReason,
    verifiedByAdminId:       adminId || null,
    verifiedAt:              null,
    documentUrl:             null,
    cloudinaryPublicId:      null,
    photoUrl:                null,
    photoCloudinaryPublicId: null,
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
    isLocked:           false,
  });

  // Sync isVerified flag — revoked labour is no longer verified
  await Labour.update({ isVerified: false }, { where: { userId: labourUserId } });

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
