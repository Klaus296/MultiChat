// сделать отображение моих и сохраненных комнат

const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { Server } = require("socket.io");
const { sequelize, User } = require("./db");
const { UserRoom } = require("./room-data");
const { where } = require("sequelize");
const {UserMessage} = require("./user-messages");
const { MafiaUser } = require("./mafia-users");
const { DataRoom } = require("./room-users"); 
const cookie = require("cookie");
const cookieParser = require("cookie-parser");
const { Op } = require("sequelize");
const cors = require("cors");
const chatsFile = path.join(__dirname, "chats.json");
const session = require("express-session");
const { use } = require("bcrypt/promises");


const app = express();
app.use(cookieParser());
app.use(session({
  secret: "super-secret-key",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // для HTTPS поставь true
}));
const sessionsFile = path.join(__dirname, "sessions.json");
let sessionsData = {};
if (fs.existsSync(sessionsFile)) {
  sessionsData = JSON.parse(fs.readFileSync(sessionsFile, "utf8"));
}

// Функция сохранения sessions.json
function saveSessions() {
  fs.writeFileSync(sessionsFile, JSON.stringify(sessionsData, null, 2));
}
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}
app.use(cors());
const server = http.createServer(app);
let list = 0
function getPrivateRoomId(user1, user2) {
  const sorted = [user1, user2].sort().join("_");
  return crypto.createHash("sha256").update(sorted).digest("hex");
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const io = new Server(server, {
  cors: {
    origin: "*", // ⚠️ или укажи точный домен Railway
    methods: ["GET", "POST"]
  }
});


require("./mafia-game")(io);
sequelize.authenticate()
  .then(() => console.log("✅ Підключено до бази даних"))
  .then(()=> User.findAll().then(usersFromDb => {
    console.log(`👥 Користувачів у БД: ${usersFromDb.length}`);
  }))
  .catch((err) => console.error("❌ Помилка підключення:", err.message));

app.use("/content", express.static("content"));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "content", "auth.html")));
app.get("/forgot-password", (req, res) => res.sendFile(path.join(__dirname, "content", "forgot-password.html")));
app.get("/guess_the_number", (req, res) => res.sendFile(path.join(__dirname, "content", "guess_the_number.html")));
app.get("/join_mafia", (req, res) => res.sendFile(path.join(__dirname, "content", "mafia-client.html")));
app.get("/enter",(req,res)=> res.sendFile(path.join(__dirname,"content","user-enter.html")));
app.get("/create", (req, res) => res.sendFile(path.join(__dirname, "content", "create-room.html")));
app.get("/chat", async (req, res) => {res.sendFile(path.join(__dirname, "content", "home.html"))});

  
app.get("/users-chat",(req,res)=>{res.sendFile(path.join(__dirname,"content","users-chat.html"))});
app.get("/messages",(req,res)=>{res.sendFile(path.join(__dirname,"content","messages.html"))});
app.get("/us_profile", (req, res) => res.sendFile(path.join(__dirname, "content", "user-profile.html")));
app.get("/search",(req,res)=>res.sendFile(path.join(__dirname,"content","search.html")));
app.get("/new-password",(req,res)=>res.sendFile(path.join(__dirname,"content","new-password.html")));
app.get("/room-chat", (req, res) => {
  res.sendFile(path.join(__dirname, "content", "chat.html"));
});

app.post("/api/login-or-register", async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ success: false, message: "Вкажіть ім'я та пароль" });
    }

    // Ищем пользователя в БД
    let user = await User.findOne({ where: { username:name } });

    if (user) {
      // Пользователь есть — проверяем пароль
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ success: false, message: "Невірний пароль" });
      }

      console.log(`✅ Користувач увійшов: ${name}`);


      return res.json({ success: true });
    } else {
      // Регистрируем нового пользователя
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        username: name,
        password: hashedPassword,
        status: "user",
        date: new Date()
      });


      console.log(`✅ Користувач зареєстрований: ${name}`);
      return res.json({ success: true });
    }
  } catch (err) {
    console.error("❌ Login/Register error:", err);
    res.status(500).json({ success: false, message: "Помилка сервера" });
  }
});

app.get("/api/check-user/:name", async (req, res) => {
  const username = req.params.name.trim();
  if (!username) return res.json({ exists: false });

  try {
    const user = await User.findOne({ where: { username: username } });
    res.json({ exists: !!user });
  } catch (err) {
    console.error("❌ Error checking user:", err);
    res.status(500).json({ exists: false, error: "Server error" });
  }
});

app.get("/main",(req,res)=>{
  res.sendFile(path.join(__dirname, "content", "chat.html"));
})
app.get("/your",(req,res)=>{
  res.sendFile(path.join(__dirname, "content", "users-chat.html"));
});
io.on("connection", (socket) => {
  console.log("🔌 Клієнт підключився:", socket.id);
  socket.on("joinRoom", (roomName) => {
    if (!roomName) return;
    socket.join(roomName);
    socket.roomName = roomName; 

    console.log(`👤 Пользователь вошёл в комнату: ${roomName}`);
    socket.emit("message", `Добро пожаловать в комнату ${roomName}`);
  });
  socket.on("del all users", async () => {
    try {
        await User.destroy({
            where: {}, // пустой объект означает "удалить всех"
            truncate: true // опционально: сбросит автоинкремент ID
        });
        await UserMessage.destroy({
            where: {}, // пустой объект означает "удалить всех"
            truncate: true // опционально: сбросит автоинкремент ID
        });
        await UserRoom.destroy({
            where: {}, // пустой объект означает "удалить всех"
            truncate: true // опционально: сбросит автоинкремент ID
        });
        await DataRoom.destroy({
            where: {}, // пустой объект означает "удалить всех"
            truncate: true // опционально: сбросит автоинкремент ID
        });
        console.log("Все пользователи удалены");
        socket.emit("all users deleted"); // уведомление клиенту
    } catch (err) {
        console.error("Ошибка при удалении пользователей:", err);
        socket.emit("error deleting users", err.message);
    }
  });

  socket.on("login", async ({ name, password }) => {
    try {
      const user = await User.findOne({ where: { username: name } });
      if (!user) {
        return socket.emit("loginError", "Користувач не знайдений");
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return socket.emit("loginError", "Невірний пароль");
      }

      // Сохраняем юзера в сокете (сессия)
      socket.username = user.username;

      console.log(`✅ ${user.username} увійшов`);
      socket.emit("loginSuccess", { username: user.username });
    } catch (err) {
      console.error("❌ Login error:", err);
      socket.emit("loginError", "Помилка сервера");
    }
  });

  socket.on("join_room", async ({ user, room }) => {
    socket.join(room);

    // Проверим, есть ли этот игрок в БД
    let player = await MafiaUser.findOne({ where: { user, room } });

    if (!player) {
      // Добавляем игрока в базу
      player = await MafiaUser.create({
        user_name: user,
        room,
        role_text: "pending", // роль выдаст админ
        do_text: "none",
      });
    }

    // Сообщаем всем, что новый игрок вошёл
    io.to(room).emit("system_message", `${user} вошёл в комнату ${room}`);
  });

  // Админ раздаёт роли
  socket.on("assign_roles", async ({ room, roles }) => {
    // roles = { "Игрок1": "mafia", "Игрок2": "citizen", ... }
    for (const [user, role] of Object.entries(roles)) {
      await MafiaUser.update({ role_text }, { where: { user_name, room } });
    }

    io.to(room).emit("system_message", "🎭 Роли розданы админом!");
  });

  // Игрок выполняет действие (например голосует)
  socket.on("player_action", async ({ user, room, action }) => {
    await MafiaUser.update({ do_text: action }, { where: { user_name, room } });

    io.to(room).emit("system_message", `${user} сделал действие: ${action}`);
  });
  socket.on("forgot-password", async (email) => {
    try {
      const user = await User.findOne({
        where: { email },
        attributes: ["username", "password", "language"]
      });

      if (user) {
        const username = user.username;
        socket.emit("correct email", { email, username });
        console.log("Correct email:", username);
      } else {
        socket.emit("incorrect email");
        console.log("Incorrect email:", email);
      }
    } catch (err) {
      console.error("Error in forgot-password:", err);
      socket.emit("forgot-password error", "Виникла помилка на сервері");
    }
  });




  // Получить список игроков в комнате
  socket.on("get_players", async (room, callback) => {
    const players = await MafiaUser.findAll({ where: { room } });
    callback(players);
  });

  socket.on("disconnect", () => {
    console.log("❌ Игрок вышел:", socket.id);
  });
  
  // Отправка нового сообщения с лимитом на количество сообщений в одной строке
  socket.on("set chat", async ({ chatNow, mainName, msg }) => {
    try {
      const roomId = getPrivateRoomId(mainName, chatNow);
      const MAX_MESSAGES = 50; // лимит сообщений в одной строке
      const username = mainName || "User";
      // Найти все переписки между двумя пользователями
      let chats = await UserMessage.findAll({
        where: {
          [Op.or]: [
            { sender: mainName, recipient: chatNow },
            { sender: chatNow, recipient: mainName }
          ]
        }
      });

      let lastChat = chats.length > 0 ? chats[chats.length - 1] : null;
      let updatedMessages = [];

      if (!lastChat) {
        // Нет переписки — создаём новую строку
        updatedMessages = [{ id: Date.now(), username: username, text: msg, date: new Date() }];
        lastChat = await UserMessage.create({
          sender: mainName,
          recipient: chatNow,
          messages: updatedMessages
        });
      } else {
        let oldMessages = typeof lastChat.messages === "string" ? JSON.parse(lastChat.messages) : lastChat.messages;
        if (!Array.isArray(oldMessages)) oldMessages = [];
        oldMessages.push({ id: Date.now(), username: username, text: msg, date: new Date() });

        if (oldMessages.length > MAX_MESSAGES) {
          updatedMessages = [oldMessages[oldMessages.length - 1]];
          await UserMessage.create({
            sender: mainName,
            recipient: chatNow,
            messages: updatedMessages
          });
        } else {
          updatedMessages = oldMessages;
          await lastChat.update({ messages: updatedMessages });
        }
      }

      let allMessages = [];
      for (const chat of chats) {
        let msgs = typeof chat.messages === "string" ? JSON.parse(chat.messages) : chat.messages;
        if (Array.isArray(msgs)) allMessages = allMessages.concat(msgs);
      }

      if (updatedMessages.length === 1 && allMessages[allMessages.length - 1]?.id !== updatedMessages[0].id) {
        allMessages.push(updatedMessages[0]);
      }

      io.to(roomId).emit("chat set", { chatNow, messages: allMessages });
    } catch (err) {
      console.error("❌ Ошибка set chat:", err);
    }
  });



  // Подключение к чату и выдача истории
  socket.on("join chat", async ({ mainName, chatNow }) => {
    console.log(`Join chat ${mainName},${chatNow}`);
    try {
      const roomId = getPrivateRoomId(mainName, chatNow);

      // Загружаем все переписки между этими двумя
      let chats = await UserMessage.findAll({
        where: {
          [Op.or]: [
            { sender: mainName, recipient: chatNow },
            { sender: chatNow, recipient: mainName }
          ]
        }
      });

      // Собираем все сообщения из всех строк
      let messages = [];
      for (const chat of chats) {
        let msgs = typeof chat.messages === "string" ? JSON.parse(chat.messages) : chat.messages;
        if (Array.isArray(msgs)) messages = messages.concat(msgs);
      }

      socket.join(roomId);
      socket.emit("chat set", { chatNow, messages });

      console.log(`${mainName} подключился к ${roomId}, сообщений: ${messages.length}`);
      console.log(messages);
    } catch (err) {
      console.error("❌ Ошибка join chat:", err);
      socket.emit("chat set", { chatNow, messages: [] });
    }
  });


  socket.on("delete friend", async (friendNamem,username) => {
    console.log(`Delete friend: ${friendName}`);
    try {
      if (!username) {
        socket.emit("friend delete error", "Ви не авторизовані");
        return;

      }
      UserMessage.destroy({
        where: {
          [Op.or]: [
            { sender: username },
            { recipient: username }
          ]
        },
        attributes: ["recipient", "sender"],
      }).then(() => {
        console.log(`✅ ${username} deleted friend ${friendName}`);
        socket.emit("friend deleted", friendName);
      }).catch(err => {
        console.error("❌ Error deleting friend:", err);
        socket.emit("friend delete error", "Server error");
      });
    } catch (err) {
      console.error("❌ Error deleting friend:", err);
      socket.emit("friend delete error", "Server error");
    }
  });
  socket.on("del room", async (room,username) => {
    try {
      console.log("Удаление сохранённой комнаты:", room);


      if (!username) {
        return socket.emit("room delete error", "Нет сохранённых комнат");
      }

      const deleted = await DataRoom.destroy({
        where: { room: room, username: username }
      });

      if (deleted) {
        socket.emit("room deleted", room.room);
      } else {
        socket.emit("room delete error", "Комната не найдена в savedRooms");
      }
    } catch (err) {
      console.error(err);
      socket.emit("room delete error", "Ошибка при удалении комнаты");
    }
  });
  socket.on("new-password", async ({ newPassword, email }) => {
    try {
      // Хэшируем пароль
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Обновляем в базе
      await User.update(
        { password: hashedPassword },
        { where: { email } }
      );

      socket.emit("password-updated");
      console.log("Password updated for:", email);
    } catch (err) {
      console.error("Error updating password:", err);
      socket.emit("password-update-error", "Помилка при оновленні пароля");
    }
  });

  socket.on("edit room", async ({ room, newDescription }) => {
    try {
      console.log("Редактирование сохранённой комнаты:", room);
      
      await DataRoom.update(
        { description: newDescription },
        { where: { room: room } }
      );

      await UserRoom.update(
        { description: newDescription },
        { where: { room_name: room } }
      );

      console.log("Комната отредактирована");
      socket.emit("room edited", { room, newDescription });
    } catch (err) {
      console.error(err);
      socket.emit("room edit error", err.message);
    }
  });

  socket.on("del-room", async (room,username) => {
    try {
      console.log("del-room");
      console.log("Удаление главной комнаты:", room);

      if (!username) {
        return socket.emit("room delete error", "Нет сохранённых комнат");
      }

      const deletedRoom = await DataRoom.destroy({
        where: { room: room, username: username }
      });

      const deletedUserRoom = await UserRoom.destroy({
        where: { room_name: room, user_name: username }
      });

      if (deletedRoom || deletedUserRoom) {
        socket.emit("room deleted", room);
      } else {
        socket.emit("room delete error", "Комната не найдена");
      }
    } catch (err) {
      console.error(err);
      socket.emit("room delete error", "Ошибка при удалении комнаты");
    }
  });

  socket.on("add message", (msg) => {
    console.log(msg)
    
    socket.emit("add mess", { msg });
  });
  socket.on("get messages", async (username,chatNow) => {
    try {
      console.log("Текущий пользователь:", username);
      console.log("Его chatNow:", chatNow);

      if (!chatNow) {
        socket.emit("chat seted", []);
        console.log("Нет выбранного собеседника (chatNow пуст)");
        return;
      }

      const chat = await UserMessage.findAll({
        where: {
          [Op.or]: [
            { sender: username, recipient: chatNow },
            { sender: chatNow, recipient: username }
          ]
        },
        attributes: ["recipient", "sender", "messages"],
        raw: true
      });

      socket.emit("chat set", (chat));
      console.log("Переписка:", chat);

    } catch (err) {
      console.error("Ошибка при получении сообщений:", err);
      socket.emit("chat set", []);
    }
  });
  
  socket.on("change language",(language,username)=>{
    User.update({language:language},{where:{username:username}});
    console.log(`Language changed to ${language}`);
    socket.emit("language changed",language);
  });
  socket.on("delete message", async (data) => {
    const { id, mainName, chatNow } = data;
    console.log(`Delete`)
    try {
      const roomId = getPrivateRoomId(mainName, chatNow);

      // Находим все строки переписки между двумя пользователями
      let chats = await UserMessage.findAll({
        where: {
          [Op.or]: [
            { sender: mainName, recipient: chatNow },
            { sender: chatNow, recipient: mainName }
          ]
        }
      });

      if (!chats || chats.length === 0) return;

      let allMessages = [];

      for (let chat of chats) {
        let messages = typeof chat.messages === "string" ? JSON.parse(chat.messages) : chat.messages;
        if (!Array.isArray(messages)) messages = [];

        // фильтруем по id
        const newMessages = messages.filter(m => m.id !== id);

        // если что-то изменилось — обновляем
        if (newMessages.length !== messages.length) {
          await chat.update({ messages: newMessages });
        }

        allMessages = allMessages.concat(newMessages);
      }

      // Отправляем обновлённые сообщения всем в комнате
      io.to(roomId).emit("chat set", { chatNow, messages: allMessages });

      console.log(`🗑 Удалено сообщение ${id} в ${roomId}`);
    } catch (err) {
      console.error("❌ Ошибка delete message:", err);
    }
  });
  socket.on("change name",(name,username)=>{
    User.update({username:name},{where:{username:username}});
    UserMessage.update({sender:name},{where:{sender:username}});
    UserMessage.update({recipient:name},{where:{recipient:username}});
    DataRoom.update({username:name},{where:{username:username}});
    UserRoom.update({user_name:name},{where:{user_name:username}});
    username = name;
    socket.emit("name changed",name);
  });

  socket.on("edit message", async ({ id, text, mainName, chatNow }) => {
    try {
      const roomId = getPrivateRoomId(mainName, chatNow);

      let chat = await UserMessage.findOne({
        where: {
          [Op.or]: [
            { sender: mainName, recipient: chatNow },
            { sender: chatNow, recipient: mainName }
          ]
        }
      });

      if (!chat) return;

      let messages = typeof chat.messages === "string" ? JSON.parse(chat.messages) : chat.messages;
      const index = messages.findIndex(m => m.id === id);
      if (index !== -1) {
        messages[index].text = text;
        await chat.update({ messages });
      }

      io.to(roomId).emit("chat set", { chatNow, messages });
      console.log(`✏ Сообщение ${id} изменено`);
    } catch (err) {
      console.error("❌ Ошибка edit message:", err);
    }
  });

  socket.on("add friend", async ({ name,username }) => {
    console.log(`➡ Добавление друга: ${name}`);
    try {
      if (!username) {
        socket.emit("friend error", "Вы не авторизованы");
        return;
      }

      const existingFriend = await UserMessage.findOne({
        where: { sender: username, recipient: name }
      });

      if (existingFriend) {
        socket.emit("friend error", "Цей користувач вже у друзях");
        return;
      }

      await UserMessage.create({
        sender: username,
        recipient: name,
        messages: []
      });

      console.log(`✅ ${username} добавил друга ${name}`);
      socket.emit("friend added", name);
    } catch (err) {
      console.error("❌ Error adding friend:", err);
      socket.emit("friend error", "Ошибка сервера");
    }
  });

  socket.on("add to main room", async ({user,username, room_name, description, language}) => {
    try {
      const existingRoom = await DataRoom.findOne({ where: { room: room_name } });
      // Используйте правильное имя модели (Room или UserRoom)
      const newUser = await DataRoom.create({
        name: user,
        username: username, // main name
        room: room_name, // Обратите внимание: в модели Room поле называется 'room', а не 'room_name'
        description: description,
        language: language,
      });
      
      console.log("✅ Новая запись в Room:", newUser.toJSON());
      socket.emit("main room added", room_name);
    } catch (err) {
      console.error("❌ Ошибка при добавлении комнаты:", err);
      socket.emit("main room error", "Помилка при додаванні кімнати");
    }
  });


  socket.on("show rooms", async (username) => {
    try {
      console.log(`User: ${username}`)
      // Ждём результат из базы
      const rooms = await UserRoom.findAll({
        where: { user_name: username },
        attributes: ["room_name", "description"],
      });

      // rooms — это массив объектов
      console.log("📋 Список моих комнат:", rooms.map(r => r.room_name));

      // Отправляем клиенту
      socket.emit("rooms", rooms);
    } catch (err) {
      console.error("❌ Ошибка чтения комнат:", err);
      socket.emit("rooms", []);
    }
  });

  socket.on("show saved rooms", async (username) => {
    console.log("show saved rooms");
    try {
      console.log(`Username: ${username}`);
      // ВАЖНО: raw: true и алиасы полей
      const rows = await DataRoom.findAll({
        where: { username: username },
        attributes: [
          ["room", "room"],
          ["description", "description"],
          ["language", "language"],
          ["name", "name"]
        ],
        raw: true,
      });

      console.log("📋 Сохранённые комнаты из БД:", rows);


      
      socket.emit("saved rooms", rows); // уже plain-объекты с {room, description, language, author}
    } catch (err) {
      console.error("❌ Ошибка чтения комнат:", err);
      socket.emit("saved rooms", []);
    }
  });


  socket.on("del account",(username)=>{
    
    if (!username) {
      socket.emit("user del");
      return;
    }
    try{
      User.destroy({where:{username:username},
        attributes:["username"],
      });
      console.log("✅ Користувач видалений:", username);
      socket.emit("user del");
    }catch(err){
      console.log(err);
    }
    
  });

  socket.on("register", async ({ name, password, language, email }) => {
    console.log("➡ Реєстрація:", name);

    try {
      // Проверяем, есть ли уже такой пользователь в БД
      const existingUser = await User.findOne({ where: { username: name } });
      if (existingUser) {
        socket.emit("useRegister"); // имя занято
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        username: name,
        password: hashedPassword,
        status: "user",
        date: new Date(),
        language: language,
        email: email
      });

      const sessionId = name;


      console.log("✅ Користувач створений:", sessionId);
      socket.emit("registerSuccess", sessionId);

    } catch (err) {
      console.error("❌ Помилка реєстрації:", err.message);
      socket.emit("registerError", err.message);
    }
  });

  socket.on("get user name", () => {
    // берём строку куков
    const rawCookies = socket.handshake.headers.cookie || "";

    // превращаем в объект
    const cookies = cookie.parse(rawCookies);

    console.log("Все куки:", cookies);
    const sessionId = cookies.sessionId; // вот твой sessionId

    if (!sessionId) {
      socket.emit("set name", null);
      return;
    }

    // дальше ищем пользователя по sessionId...
  });
  socket.on("getRooms", async (room) => {
    console.log("➡ Отримання списку кімнат");
    const backgrounds = ["study.jpg", "social.jpg"]
    const randomIndex = Math.floor(Math.random() * backgrounds.length);
    background = backgrounds[randomIndex];
    try {
      const rooms = await UserRoom.findAll({
        attributes: ["room_name", "description","user_name","language","categorie"], 
        raw: true
      });
      rooms.push(room)
      socket.emit("roomsList", rooms);
    } catch (err) {
      console.error("❌ Помилка отримання кімнат:", err);
      socket.emit("roomsList", []);
    }
  });
  socket.on("newRoom", (room) => {
    const existing = document.querySelector(`[data-room="${room.room_name}"]`);
    if (existing) return; // уже є — не додаємо
    renderRoom(room);
  });

  socket.on("createRoom", async ({ roomName, roomDescription, language, categorie,username }) => {
    if (!roomName || !roomDescription) {
      socket.emit("createRoomError", "Заповніть всі поля");
      return;
    }

    try {

      // Перевірка на існуючу кімнату
      const existingRoom = await UserRoom.findOne({ where: { room_name: roomName } });
      if (existingRoom) {
        socket.emit("createRoomError", "Кімната з такою назвою вже існує");
        return;
      }

      // Створюємо кімнату
      const newRoom = await UserRoom.create({
        room_name: roomName,
        description: roomDescription,
        user_name: username,
        date: new Date(),
        language: language || "en",
        categorie: categorie,
      });

      console.log("✅ Кімната створена:", newRoom.toJSON());

      socket.emit("createRoomSuccess", newRoom);
      io.emit("newRoom", newRoom);
    } catch (err) {
      console.error("❌ Помилка створення кімнати:", err);
      socket.emit("createRoomError", "Помилка при створенні кімнати");
    }
  });

  socket.on("show chats", async (username) => {
    try {
      const senders = await UserMessage.findAll({
        where: {
          recipient: username // где я получатель
        },
        attributes: ["sender"], // берем только поле sender
        group: ["sender"] // уникальные отправители
      });

      // превращаем в массив имён
      const senderList = senders.map(s => s.sender);

      console.log("Список отправителей:", senderList);
      socket.emit("chatList", senderList);

    } catch (err) {
      console.error("Ошибка при получении списка чатов:", err);
    }
  });

  socket.on("show friends", async (username) => {
    try {
      
      const messages = await UserMessage.findAll({
        where: {
          [Op.or]: [
            { sender: username },
            { recipient: username }
          ]
        },
        attributes: ["recipient", "sender"],
        raw: true
      });

      // Собираем список друзей
      const friendsSet = new Set();

      messages.forEach(msg => {
        if (msg.sender !== username) {
          friendsSet.add(msg.sender);
        }
        if (msg.recipient !== username) {
          friendsSet.add(msg.recipient);
        }
      });

      const friends = Array.from(friendsSet);

      console.log("📋 Список друзей:", friends);

      socket.emit("chatsList", friends);
    } catch (err) {
      console.error("❌ Ошибка чтения друзей:", err);
      socket.emit("friends", []);
    }
  });

  
  socket.on("enter room",(room,username)=>{
    User.update({chat:room},{where:{username:username}})
  })
  socket.on("get hash", (friend, username) => {
    console.log("Get hash");

    // если friend прилетает объект { friend: "Support service", username: "Stas" }
    const friendName = typeof friend === "object" ? friend.friend : friend;

    const chats = [friendName, username];
    chats.sort();

    console.log(`Chat: ${chats}`);
    console.log(`Me: ${username}, Friend: ${friendName}`);

    if (!friendName) {
      socket.emit("no friend");
      return;
    }

    // сохраняем только строку в chat
    User.update(
      { chat: friendName },
      { where: { username } }
    );

    const hash = getPrivateRoomId(chats[0], chats[1]);
    console.log(`Result: ${hash}`);

    socket.emit("set hash", hash);
  });

  socket.on("get chatNow", async (username) => {
    try {
      const user = await User.findOne({
        where: { username },
        attributes: ["chat"]
      });

      if (user) {
        socket.emit("chatNow", user.chat); // теперь вернётся строка
      } else {
        socket.emit("chatNow", null); // если не найден
      }
    } catch (err) {
      console.error("❌ Ошибка get chatNow:", err);
      socket.emit("chatNow error", "Ошибка при получении пользователя");
    }
  });


  

  socket.on("del user",()=>{
    console.log("Del-user")
    User.destroy({where:{username},
      attributes:["useraname"],
    });
  })
  
  socket.on("set zero", () => {
    list = 0;
    console.log("🔍 Режим поиска: комнаты");
  });
  socket.on("get language",()=>{
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1]; 
    const language = currentUser.language || "en"; 
    socket.emit("set language", language);
  });
  socket.on("get user name",()=>{
    console.log(username);
    if (!username) {
      socket.emit("no user");
      return;
    }else{
      socket.emit("set username", username);
    }
    
  })
  socket.on("set one", () => {
    list = 1;
    console.log("🔍 Режим поиска: пользователи");
  });
  socket.on("check admin",(username)=>{

    User.findOne({where:{username:username}}).then(user=>{
      if(user && user.status === "admin"){
        socket.emit("is admin");
      }else{
        socket.emit("not admin");
      }
    });
  })
  socket.on("go search", async ({ search }) => {
    console.log("Search:", search);

    const { Op } = require("sequelize");

    if (list === 0) {
      // Поиск комнат
      try {
        const results = await UserRoom.findAll({
          where: {
            [Op.or]: [
              { room_name: { [Op.like]: `%${search}%` } },
              { description: { [Op.like]: `%${search}%` } }
            ]
          },
          attributes: ["room_name", "description","user_name","language","categorie"],
          raw: true
        });
        socket.emit("search result", results, list);
      } catch (err) {
        console.error("❌ Search error:", err);
        socket.emit("search result", [], list);
      }
    } else {
      // Поиск пользователей
      try {
        const results = await User.findAll({
          where: { username: { [Op.like]: `%${search}%` } },
          attributes: ["username"],
          raw: true
        });
        socket.emit("search result", results, list);
      } catch (err) {
        console.error("❌ Search error:", err);
        socket.emit("search result", [], list);
      }
    }
    
  });

});

server.listen(5050, () => {
  console.log("🚀 Сервер працює на http://localhost:5050");
});
