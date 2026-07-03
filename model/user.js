module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("user", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stateId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    districtId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    pincodeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    postOfficeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    area: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // active | suspended | deleted
    accountStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active",
    },
    // kept for backward compat with old flow
    registeredAs: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // old location string fields — kept for backward compat, new records use IDs
    state: { type: DataTypes.STRING, allowNull: true },
    district: { type: DataTypes.STRING, allowNull: true },
    pincode: { type: DataTypes.STRING, allowNull: true },
    postOffice: { type: DataTypes.STRING, allowNull: true },
    city: { type: DataTypes.STRING, allowNull: true },
    village: { type: DataTypes.STRING, allowNull: true },
    // old status field kept for backward compat
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: "users",
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ["phone"], name: "idx_users_phone" },
      { fields: ["accountStatus"], name: "idx_users_account_status" },
      { fields: ["stateId"], name: "idx_users_state_id" },
      { fields: ["districtId"], name: "idx_users_district_id" },
      { fields: ["pincodeId"], name: "idx_users_pincode_id" },
    ],
  });

  return User;
};
