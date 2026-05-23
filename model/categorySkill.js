module.exports = (sequelize, DataTypes) => {
  const CategorySkill = sequelize.define("categorySkill", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "categories",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    skillId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "skills",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: "categorySkills",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["categoryId", "skillId"] },
      { fields: ["categoryId"] },
      { fields: ["skillId"] },
    ],
  });

  return CategorySkill;
};
