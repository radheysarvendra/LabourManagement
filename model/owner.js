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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    workType: {
      type: DataTypes.ENUM("home_repair", "construction", "both"),
      allowNull: false,
      defaultValue: "both",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    registeredFrom: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "owner",
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
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
