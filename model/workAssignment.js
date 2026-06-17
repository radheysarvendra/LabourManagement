module.exports = (sequelize, DataTypes) => {
  const WorkAssignment = sequelize.define("workAssignment", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    assignmentCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    middlemanId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fromDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    toDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    workLocation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("upcoming", "active", "completed", "cancelled"),
      allowNull: false,
      defaultValue: "upcoming",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: "workAssignments",
    timestamps: true,
    indexes: [
      { fields: ["assignmentCode"] },
      { fields: ["orderId"] },
      { fields: ["ownerId"] },
      { fields: ["middlemanId"] },
      { fields: ["status"] },
      { fields: ["fromDate"] },
      { fields: ["toDate"] },
    ],
  });

  return WorkAssignment;
};
