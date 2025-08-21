const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("./db"); // твой файл db.js

const UserMessage = sequelize.define("UserMessage", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  receiver_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,   // если сообщения могут быть длинными
    allowNull: false
  },
//   created_at: {
//     type: DataTypes.DATE,
//     defaultValue: DataTypes.NOW
//   }
}, {
  tableName: "user-messages",
  timestamps: false
});

module.exports = UserMessage;
