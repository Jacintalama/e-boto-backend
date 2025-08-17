"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, DataTypes) {
    await queryInterface.createTable("votes", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      // ✅ snake_case
      voter_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "voters", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      candidate_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "candidates", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

      level: {
        type: DataTypes.ENUM("Elementary", "JHS", "SHS", "College"),
        allowNull: false,
      },

      created_at: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      updated_at: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    });

    // ✅ must match the column names above
    await queryInterface.addIndex(
      "votes",
      ["voter_id", "position", "level"],
      { unique: true, name: "votes_voter_position_level_uq" }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("votes", "votes_voter_position_level_uq");
    await queryInterface.dropTable("votes");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_votes_position";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_votes_level";');
  },
};
