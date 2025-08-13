// migrations/20250812-create-voters.js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("voters", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      school_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      full_name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      course: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      year: {
        type: DataTypes.TEXT, // words like "Grade 11", "1st Year"
        allowNull: false,
      },
      status: {
        type: DataTypes.INTEGER, // 0 or 1
        allowNull: false,
        defaultValue: 0,
      },
      department: {
        type: DataTypes.ENUM("Elementary", "JHS", "SHS", "College"),
        allowNull: false,
      },
      password_hash: {
        type: DataTypes.STRING(100), // bcrypt is 60 chars; 100 is safe
        allowNull: true, // set to true in case some rows have no password in Excel
      },
      created_at: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updated_at: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    });

    await queryInterface.addIndex("voters", ["school_id", "department"], {
      unique: true,
      name: "voters_school_id_department_uq",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("voters", "voters_school_id_department_uq");
    await queryInterface.dropTable("voters");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_voters_department";');
  },
};
