// models/DataRoom.js
const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize("multichat-users", "root", "R9m!kZ2p#X7vQ4t", {
  host: "localhost",
  dialect: "mysql",
  port: 3306,
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
  user: {
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
  tableName: "data-rooms", // имя таблицы в БД
  timestamps: false,       // если нет createdAt/updatedAt
});

module.exports = { DataRoom, sequelize };
