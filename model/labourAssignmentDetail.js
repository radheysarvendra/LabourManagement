module.exports = (sequelize, DataTypes) => sequelize.define("labourAssignmentDetail", {
  assignmentId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  skillId: { type: DataTypes.INTEGER, allowNull: true },
  dailyWage: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
}, { tableName: "labour_assignment_details", timestamps: true });
