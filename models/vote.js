"use strict";
module.exports = (sequelize, DataTypes) => {
  const Vote = sequelize.define(
    "Vote",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      voterId: { type: DataTypes.UUID, allowNull: false, field: "voter_id" },
      candidateId: { type: DataTypes.UUID, allowNull: false, field: "candidate_id" },
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
      createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
    },
    {
      tableName: "votes",
      underscored: true,
    }
  );

  Vote.associate = (models) => {
    // optional relations if you want eager loads
    Vote.belongsTo(models.Voter, { foreignKey: "voter_id", as: "voter" });
    Vote.belongsTo(models.Candidate, { foreignKey: "candidate_id", as: "candidate" });
  };

  return Vote;
};
