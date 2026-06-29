module.exports = (sequelize, DataTypes) => {
  const ProviderRatingSummary = sequelize.define("providerRatingSummary", {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    roleCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      primaryKey: true,
      validate: { isIn: [["LABOUR", "CONTRACTOR"]] },
    },
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalRatings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    fiveStarCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    fourStarCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    threeStarCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    twoStarCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    oneStarCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: "providerRatingSummaries",
    timestamps: true,
    indexes: [
      { fields: ["roleCode"], name: "idx_provider_rating_role" },
      { fields: ["averageRating"], name: "idx_provider_rating_average" },
      { fields: ["totalRatings"], name: "idx_provider_rating_total" },
    ],
  });

  return ProviderRatingSummary;
};
