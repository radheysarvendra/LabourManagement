module.exports = (sequelize, DataTypes) => sequelize.define("contractorCategory", {
  contractorUserId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  categoryId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
}, { tableName: "contractor_categories", timestamps: true });
