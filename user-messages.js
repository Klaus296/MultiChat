const { DataTypes } = require("sequelize");
const { sequelize } = require("./db");

const UserMessage = sequelize.define("UserMessage", {
  id: {
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
    type: DataTypes.JSON,
    allowNull: false,
  }
}, {
  tableName: "messages",
  timestamps: false
});

module.exports = { UserMessage };
