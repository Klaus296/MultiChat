// models/DataRoom.js
const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize("railway", "root", "uhnKiDdqwDIqBIdOmDQHPaKMmcHCHoId", {
  host: "switchback.proxy.rlwy.net",
  port: 20568,
  dialect: "mysql",
  dialectOptions: {
    connectTimeout: 60000,
  },
  logging: false,
});

const DataRoom = sequelize.define("DataRoom", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  room: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  language: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: "data_rooms", // имя таблицы в БД
  timestamps: false,       // если нет createdAt/updatedAt
});

module.exports = { DataRoom, sequelize };
