// models/admin.js
"use strict";
const { Model } = require("sequelize");
const bcrypt = require("bcrypt");

function isBcryptHash(s) {
  return typeof s === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(s);
}

module.exports = (sequelize, DataTypes) => {
  class Admin extends Model {
    static associate(_models) {}

    // Promise<boolean>
    async checkPassword(plain) {
      const stored = this.admin_password || "";
      if (isBcryptHash(stored)) {
        return bcrypt.compare(plain, stored);
      }
      // legacy/plaintext: allow login once, then upgrade to bcrypt
      const ok = String(plain) === stored;
      if (ok) {
        try {
          this.admin_password = await bcrypt.hash(String(plain), 10);
          await this.save(); // upgrade silently
        } catch (_) {}
      }
      return ok;
    }
  }

  Admin.init(
    {
      // adjust if your table uses a different PK
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      admin_username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        // field: "AdminUsername", // ← uncomment & set if your DB column name differs
      },
      admin_password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        // field: "AdminPassword", // ← uncomment & set if your DB column name differs
      },
    },
    {
      sequelize,
      modelName: "Admin",
      tableName: "Admins",   // ← EXACT table name
      freezeTableName: true, // don't pluralize
      timestamps: false,     // set to true ONLY if table has createdAt/updatedAt
      hooks: {
        // hash on create/update if not already bcrypt
        async beforeSave(admin) {
          if (
            admin.changed("admin_password") &&
            admin.admin_password &&
            !isBcryptHash(admin.admin_password)
          ) {
            admin.admin_password = await bcrypt.hash(admin.admin_password, 10);
          }
        },
      },
      indexes: [
        { unique: true, fields: ["admin_username"] },
      ],
    }
  );

  return Admin;
};
