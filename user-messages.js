const { DataTypes } = require("sequelize");
const { sequelize } = require("./db");

const UserMessage = sequelize.define("UserMessage", {
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
  tableName: "user-messages",
  timestamps: false   // ⬅️ ВАЖНО!
});

module.exports = { UserMessage };
