module.exports = (sequelize, DataTypes) => {
  const Owner = sequelize.define("ownersx", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    workType: {
      type: DataTypes.ENUM("home_repair", "construction", "both"),
      allowNull: false,
      defaultValue: "both",
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    skillId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    registeredFrom: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "owner",
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updatedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: "owners",
    timestamps: true,
  });

  return Owner;
};
