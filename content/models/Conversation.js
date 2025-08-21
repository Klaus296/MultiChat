const { DataTypes } = require("sequelize");
const { sequelize } = require("../db");
const User = require("./User");

const Conversation = sequelize.define("Conversation", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user1_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: "id" } },
  user2_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: "id" } },
  status: { type: DataTypes.ENUM("pending", "accepted", "blocked"), defaultValue: "pending" }
});

module.exports = Conversation;
