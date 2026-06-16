module.exports = (sequelize, DataTypes) => {
  const OrderMapping = sequelize.define("orderMapping", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    labourId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    userType: {
      type: DataTypes.ENUM("owner", "labour", "contractor"),
      allowNull: false,
    },
    skill: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    dailyWage: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("requested", "assigned", "accepted", "rejected", "completed"),
      allowNull: false,
      defaultValue: "assigned",
    },
    adminStatus: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: "orderMappings",
    timestamps: true,
    indexes: [
      { fields: ["orderId"] },
      { fields: ["ownerId"] },
      { fields: ["labourId"] },
      { fields: ["userType"] },
      { fields: ["status"] },
      { fields: ["adminStatus"] },
    ],
  });

  return OrderMapping;
};
