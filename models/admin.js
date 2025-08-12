'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
  class Admin extends Model {
    static associate(_models) {}
    checkPassword(plain) {
      return bcrypt.compare(plain, this.admin_password);
    }
  }

  Admin.init(
    {
      // Remove this block if your table has NO id column.
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      // Map these to your actual column names.
      admin_username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        // field: 'AdminUsername', // <-- uncomment & set if your DB uses this exact column name
      },
      admin_password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        // field: 'AdminPassword', // <-- uncomment & set if needed
      },
    },
    {
      sequelize,
      modelName: 'Admin',
      tableName: 'Admins',     // <-- EXACT table name
      freezeTableName: true,   // don't let Sequelize change it
      timestamps: false,       // set true ONLY if the table has createdAt/updatedAt
      hooks: {
        async beforeCreate(admin) {
          if (admin.admin_password && !admin.admin_password.startsWith('$2')) {
            admin.admin_password = await bcrypt.hash(admin.admin_password, 10);
          }
        },
        async beforeUpdate(admin) {
          if (admin.changed('admin_password') && !admin.admin_password.startsWith('$2')) {
            admin.admin_password = await bcrypt.hash(admin.admin_password, 10);
          }
        },
      },
    }
  );

  return Admin;
};
