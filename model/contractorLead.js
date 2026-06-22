module.exports = (sequelize, DataTypes) => {
  const ContractorLead = sequelize.define("contractorLead", {
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
    // contractor's userId (from users table)
    contractorUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Project value provided by contractor when expressing interest
    projectValue: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    // Auto-determined from projectValue: small/medium/large
    leadSize: {
      type: DataTypes.ENUM("small", "medium", "large"),
      allowNull: false,
    },
    // Lead fee: small=₹100, medium=₹200, large=₹500
    leadFee: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    // true after lead fee is paid — contact details become visible
    contactUnlocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    leadStatus: {
      type: DataTypes.ENUM("pending_payment", "paid", "cancelled"),
      allowNull: false,
      defaultValue: "pending_payment",
    },
    leadPaidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    // Platform service fee % based on project value (5/3/2/1)
    serviceFeePercent: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    // Calculated service fee amount (projectValue * serviceFeePercent / 100)
    serviceFeeAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    // pending | paid | waived (waived by admin if needed)
    serviceFeeStatus: {
      type: DataTypes.ENUM("pending", "paid", "waived"),
      allowNull: false,
      defaultValue: "pending",
    },
    serviceFeePaidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
  }, {
    tableName: "contractorLeads",
    timestamps: true,
    indexes: [
      { fields: ["orderId"] },
      { fields: ["contractorUserId"] },
      { fields: ["leadStatus"] },
      { fields: ["serviceFeeStatus"] },
      { unique: true, fields: ["orderId", "contractorUserId"], name: "uq_contractor_lead_per_order" },
    ],
  });

  return ContractorLead;
};
