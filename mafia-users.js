// db.js
const { Sequelize, DataTypes } = require("sequelize");

const { sequelize } = require("./db");

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
