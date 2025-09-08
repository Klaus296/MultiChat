// db.js
const { Sequelize, DataTypes } = require("sequelize");

// Настройка подключения
const sequelize = new Sequelize("railway", "root", "uhnKiDdqwDIqBIdOmDQHPaKMmcHCHoId", {
  host: "switchback.proxy.rlwy.net",
  port: 20568,
  dialect: "mysql",
  dialectOptions: {
    connectTimeout: 60000,
  },
  logging: false,
});

// Модель пользователей
const MafiaUser = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  room: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role_text:{
    type: DataTypes.STRING,
    allowNull: false,
  },
  do_text:{
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: "mafia_users",
  timestamps: false,
});

// Экспортируем
module.exports = { sequelize, MafiaUser };
