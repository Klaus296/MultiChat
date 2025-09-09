const { Sequelize, DataTypes } = require("sequelize");

const { sequelize } = require("./db");

// Модель таблиці user_rooms
const UserRoom = sequelize.define("user_rooms", {
  id:{
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
  tableName: "user_room",
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
