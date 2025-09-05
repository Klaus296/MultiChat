// models/MafiaUser.js
const { Sequelize, DataTypes } = require("sequelize");

// Параметри підключення
const sequelize = new Sequelize("multichat-users", "root", "R9m!kZ2p#X7vQ4t", {
  host: "localhost",
  dialect: "mysql",
  port: 5049
});

const MafiaUser = sequelize.define("MafiaUser", {
    user: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    role: {
        type: DataTypes.STRING,
        allowNull: true, // например "mafia", "citizen", "don", "sheriff"
    },
    room: {
        type: DataTypes.STRING,
        allowNull: true, // имя комнаты/игры
    },
    do: {
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    tableName: "mafia-users",
    timestamps: false // если нет createdAt и updatedAt
});

module.exports = MafiaUser;
