module.exports = (sequelize, DataTypes) => {
  const AuthOtp = sequelize.define(
    "authOtp",
    {
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
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userType: {
        type: DataTypes.ENUM("labour", "owner", "contractor", "contractor_customer"),
        allowNull: false,
      },
      otpHash: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "authOtps",
      timestamps: true,
      indexes: [
        {
          name: "idx_auth_otps_phone",
          fields: ["phone"],
        },
        {
          name: "idx_auth_otps_phone_user_type",
          fields: ["phone", "userType"],
        },
      ],
    }
  );

  return AuthOtp;
};
