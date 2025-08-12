'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Score extends Model {
    static associate(models) {
      // e.g. Score.belongsTo(models.School, { foreignKey: 'schoolID' });
    }
  }

  Score.init(
    {
      schoolID:   { type: DataTypes.INTEGER, allowNull: false },
      gov:        { type: DataTypes.INTEGER, allowNull: true },
      vice_gov:   { type: DataTypes.INTEGER, allowNull: true },
      rep:        { type: DataTypes.INTEGER, allowNull: true },
      rep_1:      { type: DataTypes.INTEGER, allowNull: true },
      voted_time: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'Score',
      tableName: 'score',   // exact table name (no plural)
      timestamps: false,    // no createdAt/updatedAt
      // freezeTableName: true, // optional; tableName already fixes it
    }
  );

  return Score;
};
