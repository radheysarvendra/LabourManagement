module.exports = (sequelize, DataTypes) => {
  const ContractorAssignmentDetail = sequelize.define("contractorAssignmentDetail", {
    assignmentId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    contractFee: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    // daily | weekly | milestone | on_completion
    paymentTermType: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    paymentTerms: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: "contractorAssignmentDetails",
    timestamps: true,
  });

  return ContractorAssignmentDetail;
};
