const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize("multichat-users", "root", "root", {
  host: "localhost",
  port: 3306,
  dialect: "mysql",
  logging: false,
});

const User = sequelize.define("multichat_users", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: "user",
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
  pass: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  language: {
    type: DataTypes.STRING(2),
    allowNull: false,
    defaultValue: "en",
  },
}, {
  tableName: "multichat-users", // Назва таблиці з дефісом
  timestamps: false,
});

module.exports = {
  sequelize,
  User,
};
