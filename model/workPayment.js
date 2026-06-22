module.exports = (sequelize, DataTypes) => {
  const WorkPayment = sequelize.define("workPayment", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    workAssignmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    labourId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fromDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    toDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    presentDays: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    halfDays: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    absentDays: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    dailyWage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    grossAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    deductions: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    netAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    paymentStatus: {
      type: DataTypes.ENUM("pending", "approved", "paid", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    platformFee: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: "workPayments",
    timestamps: true,
    indexes: [
      { fields: ["workAssignmentId"] },
      { fields: ["labourId"] },
      { fields: ["fromDate"] },
      { fields: ["toDate"] },
      { fields: ["paymentStatus"] },
      { unique: true, fields: ["workAssignmentId", "labourId", "fromDate", "toDate"] },
    ],
  });

  return WorkPayment;
};
