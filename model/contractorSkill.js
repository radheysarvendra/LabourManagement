module.exports = (sequelize, DataTypes) => sequelize.define("contractorSkill", {
  contractorUserId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  skillId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  experienceYears: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  rate: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
}, { tableName: "contractor_skills", timestamps: true });
