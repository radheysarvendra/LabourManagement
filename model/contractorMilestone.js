module.exports = (sequelize, DataTypes) => {
  const ContractorMilestone = sequelize.define("contractorMilestone", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    assignmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "orderAssignments", key: "id" },
      onDelete: "CASCADE",
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    // pending | in_progress | completed | verified
    milestoneStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verifiedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: "contractorMilestones",
    timestamps: true,
    indexes: [
      { fields: ["assignmentId"], name: "idx_contractor_milestones_assignment_id" },
      { fields: ["milestoneStatus"], name: "idx_contractor_milestones_status" },
    ],
  });

  return ContractorMilestone;
};
