const { STRING, INTEGER, TEXT, DATE, ENUM } = require("sequelize");

module.exports = (Sequelize) => {
  const MobileTokenMap = Sequelize.define("mobile_token_maps", {
    id: {
      type: INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },

    userId: {
      type: INTEGER,
      allowNull: false,
    },

    phone: {
      type: STRING,
      allowNull: false,
    },

    token: {
      type: TEXT,
      allowNull: false,
    },

    userType: {
      type: ENUM('labour', 'owner', 'contractor', 'contractor_customer'),
      allowNull: false,
    },

    type: {
      type: ENUM('Primary', 'Secondary'),
      defaultValue: 'Primary',
    },

    parentId: {
      type: INTEGER,
      allowNull: true,
    },

    companyCode: {
      type: STRING,
      allowNull: true,
    },

    expiry: {
      type: DATE,
      allowNull: false,
    },
  });

  return MobileTokenMap;
};
