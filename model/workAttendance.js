module.exports = (sequelize, DataTypes) => {
  const WorkAttendance = sequelize.define("workAttendance", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    // ── old-flow fields (do NOT remove — used by workAssignmentController) ────
    workAssignmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    labourId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    attendanceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    // was ENUM(present,absent,half_day,leave) — converted to VARCHAR in ensureSchema
    status: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "present",
    },
    markedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // was ENUM(admin,middleman,owner) — converted to VARCHAR in ensureSchema
    markedByType: {
      type: DataTypes.STRING(20),
      allowNull: true,
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
    // ── new-flow fields (for orderAssignments) ────────────────────────────────
    assignmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    attendanceStatus: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "present",
    },
    markedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: "workAttendances",
    timestamps: true,
    indexes: [
      { fields: ["workAssignmentId"], name: "idx_work_attendance_wa_id" },
      { fields: ["labourId"], name: "idx_work_attendance_labour_id" },
      { fields: ["attendanceDate"], name: "idx_work_attendance_date" },
      { fields: ["assignmentId"], name: "idx_work_attendance_assignment_id" },
      {
        unique: true,
        fields: ["workAssignmentId", "labourId", "attendanceDate"],
        name: "uq_work_attendance_old",
      },
    ],
  });

  return WorkAttendance;
};
