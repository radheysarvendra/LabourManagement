module.exports = (sequelize, DataTypes) => {
  const OrderPayment = sequelize.define("orderPayment", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Total agreed job value set by owner when initiating payment
    jobValue: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    // Platform service fee: 3% of jobValue (min ₹30), 0 if jobValue >= ₹40,000
    serviceFee: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    // which of the three payment stages this row represents
    milestone: {
      type: DataTypes.ENUM("before_work", "during_work", "after_completion"),
      allowNull: false,
    },
    // % of jobValue for this milestone (30 / 40 / 30)
    milestonePercent: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    // jobValue * (milestonePercent / 100); serviceFee added to before_work row
    milestoneAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "paid", "refunded", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    refundedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    upiRef: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    paymentMethod: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "upi",
    },
  }, {
    tableName: "orderPayments",
    timestamps: true,
    indexes: [
      { fields: ["orderId"] },
      { fields: ["milestone"] },
      { fields: ["status"] },
      { unique: true, fields: ["orderId", "milestone"], name: "uq_order_payment_milestone" },
    ],
  });

  return OrderPayment;
};
