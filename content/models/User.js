const { DataTypes } = require("sequelize");
const { sequelize } = require("../db");

const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  pass: { type: DataTypes.STRING(255), allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: "user" },
  language: { type: DataTypes.STRING(10), defaultValue: "en" },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

module.exports = User;
