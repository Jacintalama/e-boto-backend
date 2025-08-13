// models/candidate.js
"use strict";
module.exports = (sequelize, DataTypes) => {
  const Candidate = sequelize.define(
    "Candidate",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      level: {
        type: DataTypes.ENUM("Elementary", "JHS", "SHS", "College"),
        allowNull: true,
      },
      firstName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      middleName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      lastName: {
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
      partyList: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      gender: {
        type: DataTypes.ENUM("Male", "Female"),
        allowNull: false,
      },
      // ← changed to TEXT to allow long descriptive strings
      year: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      photoPath: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Virtual field for convenience
      fullName: {
        type: DataTypes.VIRTUAL,
        get() {
          const fn = this.getDataValue("firstName") || "";
          const mn = this.getDataValue("middleName") || "";
          const ln = this.getDataValue("lastName") || "";
          return [fn, mn, ln].filter(Boolean).join(" ");
        },
        set() {
          throw new Error("Do not set `fullName` directly.");
        },
      },
    },
    {
      tableName: "candidates",
      underscored: true, // maps firstName -> first_name, etc.
      // timestamps true by default: created_at / updated_at due to underscored
    }
  );

  return Candidate;
};
