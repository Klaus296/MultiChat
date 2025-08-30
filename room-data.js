const { Sequelize, DataTypes } = require("sequelize");

// Параметри підключення
const sequelize = new Sequelize("multichat-users", "root", "R9m!kZ2p#X7vQ4t", {
  host: "localhost",
  dialect: "mysql",
  port: 3306
});

// Модель таблиці user_rooms
const UserRoom = sequelize.define("user_rooms", {
  user_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  room_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  language: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "en"   // <-- дефолтна мова
  },
  categorie: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "sport" // <-- дефолтна категорія
  },
},{
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
