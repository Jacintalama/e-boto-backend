// models/index.js
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const basename = path.basename(__filename);

// ---- build sequelize from env or config/config.json ----
let sequelize;
const fromEnvUrl =
  process.env.DB_URL ||
  process.env.DATABASE_URL || // common on PaaS
  null;

const commonOpts = {
  logging: process.env.DEBUG_SQL === '1' ? console.log : false,
  dialect: process.env.DB_DIALECT || 'postgres',
  // Optional: unicode + sane defaults
  define: {
    // keep default sequelize behavior; change if your models expect otherwise
    underscored: false,
    freezeTableName: false,
  },
};

// SSL (useful for hosted DBs)
if (process.env.DB_SSL === 'true') {
  commonOpts.dialectOptions = {
    ssl: { require: true, rejectUnauthorized: false },
  };
}

if (fromEnvUrl) {
  sequelize = new Sequelize(fromEnvUrl, commonOpts);
} else {
  // fallback to individual env vars or config/config.json
  const env = process.env.NODE_ENV || 'development';
  // If you still keep config.json, you can load it; otherwise env-only is fine
  let config = {};
  try {
    // Optional: only if you still have config/config.json
    config = require(path.join(__dirname, '../config/config.json'))[env] || {};
  } catch (_) {
    // no config.json, that's fine
  }

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

// ---- auto-load all models in /models (except this file) ----
const db = {};
fs
  .readdirSync(__dirname)
  .filter((file) =>
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

// ---- run associations if defined ----
Object.keys(db).forEach((modelName) => {
  if (typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
  }
});

// ---- export ----
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
