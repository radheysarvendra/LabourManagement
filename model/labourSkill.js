module.exports = (sequelize, DataTypes) => {
  const LabourSkill = sequelize.define(
    "labourSkill",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      // new-flow: FK → labourProfiles.userId (= users.id)
      labourUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "labourProfiles", key: "userId" },
        onDelete: "CASCADE",
      },
      // old-flow backward compat: FK → labours.id
      labourId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "labours",
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
      dailyWage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      isPrimary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      experienceYears: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "labourSkills",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["labourId", "skillId"],
        },
      ],
    }
  );

  return LabourSkill;
};
