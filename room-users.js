// models/MafiaUser.js
const { Sequelize, DataTypes } = require("sequelize");

// Параметри підключення
const sequelize = new Sequelize("multichat-users", "root", "R9m!kZ2p#X7vQ4t", {
  host: "localhost",
  dialect: "mysql",
  port: 3306
});

const RoomUsers = sequelize.define("MafiaUser", {
    user: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    usename: {
        type: DataTypes.STRING,
        allowNull: true, // например "mafia", "citizen", "don", "sheriff"
    },
    room: {
        type: DataTypes.STRING,
        allowNull: true, // имя комнаты/игры
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    language: {
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    tableName: "data-rooms",
    timestamps: false // если нет createdAt и updatedAt
});

module.exports = RoomUsers;
