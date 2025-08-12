'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
 User.init(
    {
      full_name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        validate: { len: [1, 150] }
      },
      email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
      },
      voter_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      voted_for: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'Users' // matches the migration
    }
  );

  return User;
};