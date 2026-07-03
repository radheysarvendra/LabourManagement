const {
  INTEGER,
  TEXT,
} = require("sequelize");

module.exports = (Sequelize, DataTypes) => {
  const Role = Sequelize.define("role", {
    id: {
      type: INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
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
  });

  return Role;
};
