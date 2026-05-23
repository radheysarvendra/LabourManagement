module.exports = (sequelize, DataTypes) => {
  const Skill = sequelize.define(
    "skill",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      skillName: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      defaultWage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      category: {
        type: DataTypes.ENUM("construction", "electrical", "general"),
        allowNull: false,
      },
    },
    {
      tableName: "skills",
      timestamps: true,
    }
  );

  return Skill;
};
