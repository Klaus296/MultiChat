// db.js
require('@dotenvx/dotenvx').config();
const { Sequelize, DataTypes } = require("sequelize");

// Настройка подключения
const sequelize = new Sequelize(process.env.MYSQL_DATABASE, process.env.MYSQLUSER , process.env.MYSQL_ROOT_PASSWORD, {
  host: process.env.MYHOST,
  port: 20568,
  dialect: "mysql",
  dialectOptions: {
    connectTimeout: 60000,
  },
  logging: false,
});

// Модель пользователей
const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date:{
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  status:{
    type: DataTypes.STRING,
    defaultValue: "user",
    allowNull: false,
  },
  language:{
    type: DataTypes.STRING,
    defaultValue: "en",
    allowNull: false,
  },
  email:{
    type: DataTypes.STRING,
    allowNull: true,
  },
  isPremium:{
    type: DataTypes.STRING,
    defaultValue: "no",
    allowNull: false,
  }
}, {
  tableName: "multichat_users",
  timestamps: false,
});

// Экспортируем
module.exports = { sequelize, User };
