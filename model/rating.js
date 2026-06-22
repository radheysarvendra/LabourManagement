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
    ratedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ratedUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    raterType: {
      type: DataTypes.ENUM("owner", "labour", "contractor"),
      allowNull: false,
    },
    rateeType: {
      type: DataTypes.ENUM("owner", "labour", "contractor"),
      allowNull: false,
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
      { fields: ["ratedByUserId"] },
      { fields: ["ratedUserId"] },
      { unique: true, fields: ["orderId", "ratedByUserId", "rateeType"], name: "uq_rating_per_ratee_per_order" },
    ],
  });

  return Rating;
};
