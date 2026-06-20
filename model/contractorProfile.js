module.exports = (sequelize, DataTypes) => {
  const ContractorProfile = sequelize.define("contractorProfile", {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    contractorCode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gstNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
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
  }, {
    tableName: "contractorProfiles",
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ["isAvailable"], name: "idx_contractor_profiles_available" },
      { fields: ["verificationStatus"], name: "idx_contractor_profiles_verification" },
    ],
  });

  return ContractorProfile;
};
