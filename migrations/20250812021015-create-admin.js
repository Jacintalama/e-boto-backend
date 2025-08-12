'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Admins', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      admin_username: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      admin_password: {
        type: Sequelize.STRING(255), // store the HASH here
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // explicit unique index (good practice + clear name)
    await queryInterface.addIndex('Admins', ['admin_username'], {
      unique: true,
      name: 'admins_admin_username_uq'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Admins');
  }
};
