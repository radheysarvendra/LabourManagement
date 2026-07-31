module.exports = (sequelize, DataTypes) => sequelize.define("userVerification", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    field: "user_id",
  },
  aadharNumber: {
    type: DataTypes.STRING(12),
    allowNull: true,
    field: "aadhar_number",
  },
  documentUrl: { type: DataTypes.TEXT, allowNull: true, field: "document_url" },
  cloudinaryPublicId: { type: DataTypes.TEXT, allowNull: true, field: "cloudinary_public_id" },
  photoUrl: { type: DataTypes.TEXT, allowNull: true, field: "photo_url" },
  photoCloudinaryPublicId: { type: DataTypes.TEXT, allowNull: true, field: "photo_cloudinary_public_id" },
  verificationStatus: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "NOT_UPLOADED",
    field: "status",
  },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: "rejection_reason" },
  verificationSubmittedAt: { type: DataTypes.DATE, allowNull: true, field: "submitted_at" },
  verifiedAt: { type: DataTypes.DATE, allowNull: true, field: "reviewed_at" },
  verifiedByAdminId: { type: DataTypes.INTEGER, allowNull: true, field: "verified_by_admin_id" },
  isLocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_locked" },
}, {
  tableName: "verifications",
  timestamps: true,
  underscored: true,
});
