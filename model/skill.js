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
      hindi: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      defaultWage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      category: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: "skills",
      timestamps: true,
    }
  );

  return Skill;
};
