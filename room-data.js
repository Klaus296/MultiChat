const { Sequelize, DataTypes } = require("sequelize");

// Параметри підключення
const sequelize = new Sequelize("multichat-users", "root", "root", {
  host: "localhost",
  dialect: "mysql",
  port: 3306
});

// Модель таблиці user_rooms
const UserRoom = sequelize.define("user_rooms", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  room_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  language: {
    type: DataTypes.STRING,
    allowNull: false
  },
}, {
  tableName: "user_rooms",
  timestamps: false
});

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log("✅ Підключення до бази даних успішне");
  } catch (error) {
    console.error("❌ Помилка підключення:", error);
  }
}

module.exports = { sequelize, connectDB, UserRoom };
