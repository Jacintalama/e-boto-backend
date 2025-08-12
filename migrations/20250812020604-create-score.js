'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Scores', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      schoolID: {
        type: Sequelize.INTEGER
      },
      gov: {
        type: Sequelize.INTEGER
      },
      vice_gov: {
        type: Sequelize.INTEGER
      },
      rep: {
        type: Sequelize.INTEGER
      },
      rep_1: {
        type: Sequelize.INTEGER
      },
      voted_time: {
        type: Sequelize.DATE
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Scores');
  }
};