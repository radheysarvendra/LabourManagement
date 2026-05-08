const {
  INTEGER,
  STRING,
  ENUM,
  TEXT,
} = require("sequelize");

module.exports = (Sequelize, DataTypes) => {
  const Role = Sequelize.define("role", {
    id: {
      type: INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    UNIQUE: true,
    },
   name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: TEXT,
      allowNull: true,
    },
    accessLevel: {
      type: INTEGER, 
    },
  });

  return Role;
};