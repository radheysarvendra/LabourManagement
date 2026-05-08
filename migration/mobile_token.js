'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mobile_token_map', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      phone: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      token: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      // Labour ya Owner
      userType: {
        type: Sequelize.ENUM('labour', 'owner'),
        allowNull: false,
      },

      type: {
        type: Sequelize.ENUM('Primary', 'Secondary'),
        defaultValue: 'Primary',
      },

      parentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      companyCode: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      expiry: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mobile_token_map');
  },
};