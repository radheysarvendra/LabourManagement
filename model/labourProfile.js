module.exports = (sequelize, DataTypes) => {
  const LabourProfile = sequelize.define("labourProfile", {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    labourCode: {
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
