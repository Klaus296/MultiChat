const { DataTypes } = require("sequelize");
const { sequelize } = require("../db");
const Conversation = require("./Conversation");
const User = require("./User");

const Message = sequelize.define("Message", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  conversation_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Conversation, key: "id" } },
  sender_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: "id" } },
  text: { type: DataTypes.TEXT, allowNull: false },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

module.exports = Message;
