module.exports = (sequelize, DataTypes) => {
  const BookingAllocation = sequelize.define("bookingAllocation", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    bookingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    labourId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    skill: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dailyWage: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("allocated", "accepted", "rejected", "completed"),
      allowNull: false,
      defaultValue: "allocated",
    },
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: "bookingAllocations",
    timestamps: true,
    indexes: [
      { fields: ["bookingId"] },
      { fields: ["labourId"] },
      { fields: ["status"] },
    ],
  });

  return BookingAllocation;
};
