module.exports = (sequelize, DataTypes) => {
  const LabourProfile = sequelize.define("labourProfile", {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    userCode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    experienceYears: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    // pending | verified | rejected
    verificationStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    verifiedByAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Verification documents submitted by labour
    aadharNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    documentUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    verificationSubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cloudinaryPublicId: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Profile photo uploaded during verification
    photoUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    photoCloudinaryPublicId: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Locked = true after admin approves. Prevents re-upload until admin revokes.
    isLocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    tableName: "labourProfiles",
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ["isAvailable"], name: "idx_labour_profiles_available" },
      { fields: ["verificationStatus"], name: "idx_labour_profiles_verification" },
    ],
  });

  return LabourProfile;
};
