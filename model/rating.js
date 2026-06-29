module.exports = (sequelize, DataTypes) => {
  const Rating = sequelize.define("rating", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assignmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    workAssignmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    ratedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ratedUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ratedRoleCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [["LABOUR", "CONTRACTOR", "OWNER"]] },
    },
    raterType: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    rateeType: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    stars: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
  }, {
    tableName: "ratings",
    timestamps: true,
    indexes: [
      { fields: ["orderId"] },
      { fields: ["assignmentId"] },
      { fields: ["ratedByUserId"] },
      { fields: ["ratedUserId"] },
      { unique: true, fields: ["orderId", "assignmentId", "ratedByUserId", "ratedUserId"], name: "uq_rating_per_provider_assignment" },
    ],
  });

  return Rating;
};
