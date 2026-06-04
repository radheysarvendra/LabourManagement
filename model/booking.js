module.exports = (sequelize, DataTypes) => {
  const Booking = sequelize.define("booking", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    bookingCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    skill: {
      type: DataTypes.STRING,
      allowNull: false,
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
    labourRequired: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    allocatedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    requiredDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "confirmed", "cancelled", "completed"),
      allowNull: false,
      defaultValue: "pending",
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updatedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: "bookings",
    timestamps: true,
    indexes: [
      { fields: ["ownerId"] },
      { fields: ["skill"] },
      { fields: ["stateId"] },
      { fields: ["districtId"] },
      { fields: ["pincode"] },
      { fields: ["postOfficeId"] },
      { fields: ["requiredDate"] },
      { fields: ["status"] },
    ],
  });

  return Booking;
};
