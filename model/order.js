module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define("order", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    orderCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    ownerName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ownerPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    categoryName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    skillId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    skill: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    needType: {
      type: DataTypes.ENUM("labour", "contractor"),
      allowNull: false,
      defaultValue: "labour",
    },
    assignedType: {
      type: DataTypes.ENUM("labour", "contractor"),
      allowNull: true,
      defaultValue: null,
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
    state: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pincode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    postOffice: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    labourRequired: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    labourAllocated: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    requiredDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "partially_allocated", "allocated", "assigned", "confirmed", "admin_approved", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    adminStatus: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: "orders",
    timestamps: true,
    indexes: [
      { fields: ["orderCode"] },
      { fields: ["skill"] },
      { fields: ["stateId"] },
      { fields: ["districtId"] },
      { fields: ["pincode"] },
      { fields: ["postOfficeId"] },
      { fields: ["status"] },
      { fields: ["adminStatus"] },
    ],
  });

  return Order;
};
