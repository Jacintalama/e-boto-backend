'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const basename = path.basename(__filename);

let sequelize;
const fromEnvUrl =
  process.env.DB_URL ||
  process.env.DATABASE_URL || // common on PaaS
  null;

const commonOpts = {
  logging: process.env.DEBUG_SQL === '1' ? console.log : false,
  dialect: process.env.DB_DIALECT || 'postgres',
  define: {
    underscored: false,
    freezeTableName: false,
  },
};

// 👉 Force SSL when in production or using DATABASE_URL
if (process.env.NODE_ENV === 'production' || fromEnvUrl) {
  commonOpts.dialectOptions = {
    ssl: { require: true, rejectUnauthorized: false },
  };
}

if (fromEnvUrl) {
  sequelize = new Sequelize(fromEnvUrl, commonOpts);
} else {
  const env = process.env.NODE_ENV || 'development';
  let config = {};
  try {
    config = require(path.join(__dirname, '../config/config.json'))[env] || {};
  } catch (_) {}

  const username = process.env.DB_USER ?? config.username;
  const password = process.env.DB_PASS ?? config.password;
  const database = process.env.DB_NAME ?? config.database;
  const host     = process.env.DB_HOST ?? config.host ?? '127.0.0.1';
  const port     = Number(process.env.DB_PORT ?? config.port) || 5432;
  const dialect  = process.env.DB_DIALECT ?? config.dialect ?? 'postgres';

  sequelize = new Sequelize(database, username, password, {
    host,
    port,
    dialect,
    ...commonOpts,
  });
}

const db = {};
fs
  .readdirSync(__dirname)
  .filter(
    (file) =>
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      !file.endsWith('.test.js')
  )
  .forEach((file) => {
    const modelFactory = require(path.join(__dirname, file));
    const model = modelFactory(sequelize, DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
