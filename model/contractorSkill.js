module.exports = (sequelize, DataTypes) => {
  const ContractorSkill = sequelize.define("contractorSkill", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    contractorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    skillId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    experienceYears: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
  }, {
    tableName: "contractorSkills",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["contractorId", "skillId"] },
      { fields: ["contractorId"] },
      { fields: ["skillId"] },
      { fields: ["categoryId"] },
    ],
  });

  return ContractorSkill;
};
