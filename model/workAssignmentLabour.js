module.exports = (sequelize, DataTypes) => {
  const WorkAssignmentLabour = sequelize.define("workAssignmentLabour", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    workAssignmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    labourId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    skillId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    skill: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    dailyWage: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    assignmentStatus: {
      type: DataTypes.ENUM("assigned", "joined", "removed", "completed"),
      allowNull: false,
      defaultValue: "assigned",
    },
    joinedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    leftAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: "workAssignmentLabours",
    timestamps: true,
    indexes: [
      { fields: ["workAssignmentId"] },
      { fields: ["labourId"] },
      { fields: ["skillId"] },
      { fields: ["assignmentStatus"] },
      { unique: true, fields: ["workAssignmentId", "labourId"] },
    ],
  });

  return WorkAssignmentLabour;
};
