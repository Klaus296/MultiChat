const { DataTypes } = require("sequelize");
const { sequelize } = require("./db");

const UserMessage = sequelize.define("UserMessage", {
  id:{
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  sender: {
    type: DataTypes.STRING,
    allowNull: false
  },
  recipient: {
    type: DataTypes.STRING,
    allowNull: false
  },
  messages: {
    type: DataTypes.JSON, // или TEXT, если хранишь строки
    allowNull: false
  }
}, {
  tableName: "user_messages",
  timestamps: false   // ⬅️ ВАЖНО!
});

module.exports = { UserMessage };
