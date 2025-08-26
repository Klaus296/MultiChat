// db.js
const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize("multichat-users", "root", "root", {
  host: "localhost",
  dialect: "mysql",
  port: 3306, // стандартный порт MySQL
});

// Модель для таблицы mafia-users
const MafiaUser = sequelize.define("mafia_users", {
  user: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  room: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  do: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // добавь все колонки из своей таблицы
}, {
  tableName: "mafia-users", // имя таблицы
  timestamps: false,        // если нет createdAt / updatedAt
});

module.exports = { sequelize, MafiaUser };
