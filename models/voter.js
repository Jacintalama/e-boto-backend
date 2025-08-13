"use strict";
module.exports = (sequelize, DataTypes) => {
  const Voter = sequelize.define(
    "Voter",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      schoolId: { type: DataTypes.STRING(50), allowNull: false, field: "school_id", unique: "voters_school_id_department_uq" },
      fullName: { type: DataTypes.STRING(150), allowNull: false, field: "full_name" },
      course: { type: DataTypes.STRING(120), allowNull: true },
      year: {
        type: DataTypes.TEXT,
        allowNull: false,
        set(value) {
          const s = (typeof value === "string" ? value : String(value ?? "")).trim();
          this.setDataValue("year", s === "NaN" ? "" : s);
        },
        validate: { notEmpty: { msg: "Year is required" } },
      },
      status: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { isIn: { args: [[0, 1]], msg: "Status must be 0 or 1" } },
      },
      department: {
        type: DataTypes.ENUM("Elementary", "JHS", "SHS", "College"),
        allowNull: false,
        unique: "voters_school_id_department_uq",
      },
      passwordHash: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "password_hash",
      },
    },
    { tableName: "voters", underscored: true }
  );

  // optional instance method (if you’ll do login verification):
  Voter.prototype.checkPassword = async function (password, bcrypt) {
    if (!this.passwordHash) return false;
    return bcrypt.compare(password, this.passwordHash);
  };

  return Voter;
};
