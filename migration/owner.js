'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('owners', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        unique: true,
      },

      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      phone: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      // Screenshot se — Work Type
      workType: {
        type: Sequelize.ENUM('home_repair', 'construction', 'both'),
        allowNull: false,
      },

      // Screenshot se — Village/Shahar
      village: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // Screenshot se — District
      district: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      state: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      pincode: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      area: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      postOffice: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      age: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      gender: {
        type: Sequelize.ENUM('male', 'female'),
        allowNull: true,
      },

      profileImage: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },

      createdById: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      updatedById: {
        type: Sequelize.INTEGER,
        allowNull: true,
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

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('owners');
  },
};
