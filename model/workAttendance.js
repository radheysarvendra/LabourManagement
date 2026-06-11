module.exports = (sequelize, DataTypes) => {
  const WorkAttendance = sequelize.define("workAttendance", {
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
    attendanceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("present", "absent", "half_day", "leave"),
      allowNull: false,
      defaultValue: "present",
    },
    markedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    markedByType: {
      type: DataTypes.ENUM("admin", "middleman", "owner"),
      allowNull: false,
      defaultValue: "admin",
    },
    checkInTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    checkOutTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: "workAttendances",
    timestamps: true,
    indexes: [
      { fields: ["workAssignmentId"] },
      { fields: ["labourId"] },
      { fields: ["attendanceDate"] },
      { fields: ["status"] },
      { unique: true, fields: ["workAssignmentId", "labourId", "attendanceDate"] },
    ],
  });

  return WorkAttendance;
};
