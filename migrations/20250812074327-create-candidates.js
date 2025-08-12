"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("candidates", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      level: {
        type: DataTypes.ENUM("Elementary", "JHS", "SHS", "College"),
        allowNull: true,
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      middle_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      position: {
        type: DataTypes.ENUM(
          "President",
          "Vice President",
          "Secretary",
          "Treasurer",
          "Auditor",
          "Representative"
        ),
        allowNull: false,
      },
      party_list: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      gender: {
        type: DataTypes.ENUM("Male", "Female"),
        allowNull: false,
      },
      year: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      photo_path: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        allowNull: false,
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    });
  },

  async down(queryInterface) {
    // Drop table first, then drop ENUM types (Postgres)
    await queryInterface.dropTable("candidates");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_candidates_position";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_candidates_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_candidates_level";');
  },
};
