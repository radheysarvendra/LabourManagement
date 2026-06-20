module.exports = (sequelize, DataTypes) => {
  const OrderAssignment = sequelize.define("orderAssignment", {
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
    providerUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    providerRoleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // pending | assigned | accepted | in_progress | completed | rejected | cancelled
    assignmentStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "assigned",
    },
    // pending | approved | rejected
    adminStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    assignedByAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: "orderAssignments",
    timestamps: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ["orderId", "providerUserId", "providerRoleId"], name: "uq_order_assignments" },
      { fields: ["orderId"], name: "idx_order_assignments_order_id" },
      { fields: ["providerUserId"], name: "idx_order_assignments_provider_user_id" },
      { fields: ["assignmentStatus"], name: "idx_order_assignments_status" },
    ],
  });

  return OrderAssignment;
};
