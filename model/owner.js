module.exports = (sequelize, DataTypes) => {  // FIX: DataTypes bhi receive karo
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
    },
    village: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM("male", "female"),
      allowNull: true,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: "owners",   // FIX: PostgreSQL table name exact match
    timestamps: true,
  });

  return Owner;
};