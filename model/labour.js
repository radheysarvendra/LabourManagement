const {
  STRING,
  INTEGER,
  BOOLEAN,
  DATE,
  TEXT,
  FLOAT,
  BIGINT,
  ENUM,
  UUID,
  JSONB,
} = require("sequelize");
module.exports = (Sequelize, DataTypes) => {
  const labour = Sequelize.define("labour", {
    id: {
      type: INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      unique: true,
    },

    userId: {
      type: INTEGER,
      allowNull: true,
    },

    name: {
      type: STRING,
      allowNull: false,
    },

    phone: {
      type: STRING,
      allowNull: false,
      unique: true,
    },

    city: {
      type: STRING,
    },

    address: {
      type: TEXT,
    },

    isAvailable: {
      type: BOOLEAN,
      defaultValue: true,
    },

    profileImage: {
      type: STRING,
    },

    experienceYears: {
      type: INTEGER,
      defaultValue: 0,
    },

 age: {
  type: INTEGER,
  allowNull: false,
},
   gender: {
  type: ENUM("male", "female"),
  allowNull: false,
},
    createdById: {
      type: INTEGER,
    },

    updatedById: {
      type: INTEGER,
    },
  });

  return labour;
};