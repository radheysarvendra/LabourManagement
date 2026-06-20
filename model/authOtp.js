module.exports = (sequelize, DataTypes) => {
  const AuthOtp = sequelize.define("authOtp", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // nullable — new flow only needs phone for OTP; userId linked after verification
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    otpHash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // null = not yet verified, DATE = verified at this time
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  }, {
    tableName: "authOtps",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["phone"], name: "idx_auth_otps_phone" },
      { fields: ["phone", "verifiedAt"], name: "idx_auth_otps_phone_verified" },
    ],
  });

  return AuthOtp;
};
