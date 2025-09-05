// Сделай службу поддержки
// Сделай кортинки для комнат
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
const { Op } = require("sequelize");
const filePath = path.join(__dirname, "users.json");
if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf8");
let users = JSON.parse(fs.readFileSync(filePath, "utf8"));
const username = users.length > 0 ? users[users.length - 1].username : null;
const chatsFile = path.join(__dirname, "chats.json");

const app = express();
const server = http.createServer(app);
let list = 0
function getPrivateRoomId(user1, user2) {
  const sorted = [user1, user2].sort().join("_");
  return crypto.createHash("sha256").update(sorted).digest("hex");
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const io = new Server(server);

require("./mafia-game")(io);

sequelize.authenticate()
  .then(() => console.log("✅ Підключено до бази даних"))
  .catch((err) => console.error("❌ Помилка підключення:", err.message));

app.use(express.static(path.join(__dirname, "content")));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "content", "auth.html")));
app.get("/forgot-password", (req, res) => res.sendFile(path.join(__dirname, "content", "forgot-password.html")));
app.get("/guess_the_number", (req, res) => res.sendFile(path.join(__dirname, "content", "guess_the_number.html")));
app.get("/join_mafia", (req, res) => res.sendFile(path.join(__dirname, "content", "mafia-client.html")));
app.get("/enter",(req,res)=> res.sendFile(path.join(__dirname,"content","user-enter.html")));
app.get("/create", (req, res) => res.sendFile(path.join(__dirname, "content", "create-room.html")));
app.get("/chat", (req, res) => res.sendFile(path.join(__dirname, "content", "home.html")));
app.get("/users-chat",(req,res)=>{res.sendFile(path.join(__dirname,"content","users-chat.html"))});
app.get("/messages",(req,res)=>{res.sendFile(path.join(__dirname,"content","messages.html"))});
app.get("/us_profile", (req, res) => res.sendFile(path.join(__dirname, "content", "user-profile.html")));
app.get("/search",(req,res)=>res.sendFile(path.join(__dirname,"content","search.html")));
const LIQPAY_PUBLIC_KEY = "sandbox_i55874930238";
const LIQPAY_PRIVATE_KEY = "sandbox_vIVAwR6BVucTxSCb9aT98KPfxrjQuYbQTPZgE35Y";





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
    let user = await User.findOne({ where: { name } });

    if (user) {
      // Пользователь есть — проверяем пароль
      const match = await bcrypt.compare(password, user.pass);
      if (!match) {
        return res.status(401).json({ success: false, message: "Невірний пароль" });
      }

      console.log(`✅ Користувач увійшов: ${name}`);

      // Сохраняем в users.json
      users.push({
        username: name,
        createdAt: new Date().toISOString(),
        savedRooms: [],
        mainRooms: [],
        userFriends: []
      });
      fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

      return res.json({ success: true });
    } else {
      // Регистрируем нового пользователя
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        name,
        pass: hashedPassword,
        status: "user",
        date: new Date()
      });

      users.push({
        username: name,
        createdAt: new Date().toISOString(),
        savedRooms: [],
        mainRooms: [],
        userFriends: []
      });
      fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

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
    const user = await User.findOne({ where: { name: username } });
    res.json({ exists: !!user });
  } catch (err) {
    console.error("❌ Error checking user:", err);
    res.status(500).json({ exists: false, error: "Server error" });
  }
});
app.get("/api/users", (req, res) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "[]", "utf8");
    }

    let usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Якщо файл пошкоджений або це не масив → робимо масив
    if (!Array.isArray(usersData)) {
      console.warn("⚠ users.json не є масивом, відновлюю");
      usersData = [];
      fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));
    }

    res.json(usersData);
  } catch (err) {
    console.error("❌ Error reading users.json:", err);
    res.json([]);
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
  socket.on("userLeft", () => {
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1];
    currentUser.chatNow = ""; // очищаем
    fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));
  });
  socket.on("joinRoom", (roomName) => {
    if (!roomName) return;
    socket.join(roomName);
    socket.roomName = roomName; 

    console.log(`👤 Пользователь вошёл в комнату: ${roomName}`);
    socket.emit("message", `Добро пожаловать в комнату ${roomName}`);
  });
  socket.on("login", (username) => {
    socket.username = username;
  });
  socket.on("join_room", async ({ user, room }) => {
    socket.join(room);

    // Проверим, есть ли этот игрок в БД
    let player = await MafiaUser.findOne({ where: { user, room } });

    if (!player) {
      // Добавляем игрока в базу
      player = await MafiaUser.create({
        user,
        room,
        role: "pending", // роль выдаст админ
        do: "none",
      });
    }

    // Сообщаем всем, что новый игрок вошёл
    io.to(room).emit("system_message", `${user} вошёл в комнату ${room}`);
  });

  // Админ раздаёт роли
  socket.on("assign_roles", async ({ room, roles }) => {
    // roles = { "Игрок1": "mafia", "Игрок2": "citizen", ... }
    for (const [user, role] of Object.entries(roles)) {
      await MafiaUser.update({ role }, { where: { user, room } });
    }

    io.to(room).emit("system_message", "🎭 Роли розданы админом!");
  });

  // Игрок выполняет действие (например голосует)
  socket.on("player_action", async ({ user, room, action }) => {
    await MafiaUser.update({ do: action }, { where: { user, room } });

    io.to(room).emit("system_message", `${user} сделал действие: ${action}`);
  });
  socket.on("forgot-password", (email) => {
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const user = usersData.find(u => u.email === email);

    if (user) {
      socket.emit("correct email");
      console.log("Correct email:", email);
    } else {
      socket.emit("incorrect email");
      console.log("Incorrect email:", email);
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
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1];
      const username = currentUser.username || "User";
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
    } catch (err) {
      console.error("❌ Ошибка join chat:", err);
      socket.emit("chat set", { chatNow, messages: [] });
    }
  });





  socket.on("del room", async (room) => {
    try {
      console.log("Удаление сохранённой комнаты:", room);
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1];

      if (!currentUser) {
        return socket.emit("room delete error", "Нет сохранённых комнат");
      }

      const deleted = await DataRoom.destroy({
        where: { room: room, username: currentUser.username }
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

  socket.on("del-room", async (room) => {
    try {
      console.log("del-room");
      console.log("Удаление главной комнаты:", room);
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1];

      if (!currentUser) {
        return socket.emit("room delete error", "Нет сохранённых комнат");
      }

      const deletedRoom = await DataRoom.destroy({
        where: { room: room, username: currentUser.username }
      });

      const deletedUserRoom = await UserRoom.destroy({
        where: { room_name: room, user_name: currentUser.username }
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
  socket.on("get messages", async () => {
    try {
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1];
      const chatNow = currentUser.chatNow;
      console.log("Текущий пользователь:", currentUser.username);
      console.log("Его chatNow:", currentUser.chatNow);

      if (!chatNow) {
        socket.emit("chat seted", []);
        console.log("Нет выбранного собеседника (chatNow пуст)");
        return;
      }

      const chat = await UserMessage.findAll({
        where: {
          [Op.or]: [
            { sender: currentUser.username, recipient: chatNow },
            { sender: chatNow, recipient: currentUser.username }
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
  socket.on("change language",(language)=>{
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1];
    currentUser.language = language;
    fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));
    User.update({language:language},{where:{name:currentUser.username}});
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
  socket.on("change name",(name)=>{
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1];
    User.update({name:name},{where:{name:currentUser.username}});
    UserMessage.update({sender:name},{where:{sender:currentUser.username}});
    UserMessage.update({recipient:name},{where:{recipient:currentUser.username}});
    DataRoom.update({username:name},{where:{username:currentUser.username}});
    UserRoom.update({user_name:name},{where:{user_name:currentUser.username}});
    currentUser.username = name;
    fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));
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

  socket.on("get friend", () => {
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1];
    console.log("Get friend");
    console.log(currentUser.chatNow);
    if (currentUser.chatNow.length > 0) {
      socket.emit("set friend", currentUser.chatNow);
    } else {
      socket.emit("set friend", null);
    }
  });
  const currentUser = users.length > 0 ? users[users.length - 1].username : null;

  socket.on("add friend", ({ name }) => {
    try {
      if (!currentUser) {
        socket.emit("friend error", "Вы не авторизованы");
        return;
      }

      const userIndex = users.findIndex(u => u.username === currentUser);
      if (userIndex === -1) {
        socket.emit("friend error", "Текущий пользователь не найден");
        return;
      }

      if (!users[userIndex].userFriends) {
        users[userIndex].userFriends = [];
      }

      if (users[userIndex].userFriends.includes(name)) {
        socket.emit("friend error", "Этот пользователь уже в друзьях");
        return;
      }

      users[userIndex].userFriends.push(name);
      fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

      console.log(`✅ ${currentUser} добавил друга ${name}`);
      socket.emit("friend added", name);
    } catch (err) {
      console.error("❌ Error adding friend:", err);
      socket.emit("friend error", "Ошибка сервера");
    }
  });
  socket.on("add to main room", async ({user, room_name, description, language}) => {
    try {
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1];

      // Используйте правильное имя модели (Room или UserRoom)
      const newUser = await DataRoom.create({
        user: user,
        username: currentUser.username, // main name
        room: room_name, // Обратите внимание: в модели Room поле называется 'room', а не 'room_name'
        description: description,
        language: language,
      });
      const existingRoom = await DataRoom.findOne({ where: { room: room_name } });
      if (existingRoom) {
        socket.emit("main room error", "Кімната з такою назвою вже існує");
        return;
      }
      console.log("✅ Новая запись в Room:", newUser.toJSON());
      socket.emit("main room added", room_name);
    } catch (err) {
      console.error("❌ Ошибка при добавлении комнаты:", err);
      socket.emit("main room error", "Помилка при додаванні кімнати");
    }
  });


  socket.on("show rooms", async () => {
    try {
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1];

      // Ждём результат из базы
      const rooms = await UserRoom.findAll({
        where: { user_name: currentUser.username },
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

  socket.on("show saved rooms", () => {
    console.log("show saved rooms");
    try {
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1]; // последний вошедший

      DataRoom.findAll({
        where: { username: currentUser.username },
        attributes: ["room", "description", "username", "language", "user"],
      }).then(rooms => {
        
        const uniqueRooms = rooms.filter(
          (room, index, self) =>
            index === self.findIndex(r => r.room === room.room)
        );
        currentUser.savedRooms = uniqueRooms.map(r => r.room);
        fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));
        console.log(currentUser.savedRooms);
        console.log("📋 Список уникальных комнат:", uniqueRooms.map(r => r.room));
        socket.emit("saved rooms", uniqueRooms);
      });
    } catch (err) {
      console.error("❌ Ошибка чтения комнат:", err);
      socket.emit("saved rooms", []);
    }
  });

  socket.on("del account",()=>{
    const username = users.length > 0 ? users[users.length - 1].username : null;
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1]; 

    const index = usersData.findIndex(u => u.username === username);
    
    if (!username) {
      socket.emit("user del");
      return;
    }
    try{
      User.destroy({where:{name:"Stas"},
        attributes:["name"],
      });
      if (index !== -1) {
        usersData.splice(index, 1);
        fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));
        console.log(`✅ Користувач ${username} видалений з users.json`);
      }
      console.log("✅ Користувач видалений:", username);
      socket.emit("user del");
    }catch(err){
      console.log(err);
    }
    
  });

  socket.on("register", async ({ name, password,language,email }) => {
    console.log("➡ Реєстрація:", name);
    const hashedPassword = await bcrypt.hash(password, 10);
    if (users.some(u => u.username === name)) {
      socket.emit("useRegister");
      return;
    }
    try {
      const newUser = await User.create({
        name:name,
        pass: hashedPassword,
        status: "user",
        date: new Date(),
        language: language,
        email: email
      });

      users.push({ username: name, pass: password, createdAt: new Date().toISOString(),language:language,savedRooms:[],email:email,chatNow:"",roomNow:""});
      fs.writeFileSync(filePath, JSON.stringify(users, null, 2));

      console.log("✅ Користувач створений:", name);

      socket.emit("registerSuccess", name);
    } catch (err) {
      console.error("❌ Помилка реєстрації:", err);
      socket.emit("registerError", "Validation error");
    }
  });
  socket.on("get user name",()=>{
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const username = usersData.length > 0 ? usersData[usersData.length - 1].username : null;
    socket.emit("set name",username);
  });
  socket.on("getRooms", async (room) => {
    console.log("➡ Отримання списку кімнат");
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
  socket.on("saveRoom",(room)=>{
  const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const currentUser = usersData[usersData.length - 1];
  currentUser.savedRooms.push(room);
  fs.writeFileSync(filePath, JSON.stringify(currentUser, null, 2));
  })
  socket.on("createRoom", async ({ userName, roomName, roomDescription, language, categorie }) => {
    if (!roomName || !roomDescription) {
      socket.emit("createRoomError", "Заповніть всі поля");
      return;
    }

    try {
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1];
      
      if (!currentUser) {
        console.log("Current user for room creation:", currentUser);
        socket.emit("createRoomError", "Користувача не знайдено");
        return;
      }

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
        user_name: userName,
        date: new Date(),
        language: language || "en",
        categorie: categorie,
      });

      console.log("✅ Кімната створена:", newRoom.toJSON());

      // Оновлюємо mainRooms без дублікатів
      if (!currentUser.savedRooms) currentUser.savedRooms = [];
      if (!currentUser.savedRooms.includes(roomName)) {
        currentUser.savedRooms.push(roomName);
      }

      // Сохраняем обновлённый JSON
      fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));

      socket.emit("createRoomSuccess", newRoom);
      io.emit("newRoom", newRoom);
    } catch (err) {
      console.error("❌ Помилка створення кімнати:", err);
      socket.emit("createRoomError", "Помилка при створенні кімнати");
    }
  });

  socket.on("show chats", async () => {
    try {
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1];

      const senders = await UserMessage.findAll({
        where: {
          recipient: currentUser.username // где я получатель
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

  socket.on("show friends", async () => {
    try {
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1]; // последний вошедший
      
      const messages = await UserMessage.findAll({
        where: {
          [Op.or]: [
            { sender: currentUser.username },
            { recipient: currentUser.username }
          ]
        },
        attributes: ["recipient", "sender"],
        raw: true
      });

      // Собираем список друзей
      const friendsSet = new Set();

      messages.forEach(msg => {
        if (msg.sender !== currentUser.username) {
          friendsSet.add(msg.sender);
        }
        if (msg.recipient !== currentUser.username) {
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

  socket.on("save profile", ({ name, bio }) => {
    if (!name) {
      socket.emit("profile error", "Ім'я не вказано");
      return;
    }

    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // ищем текущего по socket.username
    const currentIndex = usersData.findIndex(u => u.username === socket.username);

    if (currentIndex === -1) {
      socket.emit("profile error", "Користувач не знайдений");
      return;
    }

    // проверка что новое имя не занято другим
    const nameTaken = usersData.some(
      (u, i) => i !== currentIndex && u.username === name
    );

    if (nameTaken) {
      socket.emit("profile error", "Таке ім'я вже використовується");
      return;
    }

    // обновляем
    usersData[currentIndex].username = name;
    usersData[currentIndex].bio = bio || "";

    fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));

    // обновляем сессию
    socket.username = name;

    socket.emit("profile saved", {
      name,
      bio: usersData[currentIndex].bio
    });
  });
  socket.on("enter room",(room)=>{
    console.log(`Enter room ${room}`);
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1];
    currentUser.roomNow = room;
    console.log(currentUser.roomNow);
    fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));
  })
  socket.on("get hash",(fr)=>{
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1];
    console.log("Get hash");
    const me = currentUser.username;
    currentUser.chatNow = fr;
    const friend = fr;
    console.log(currentUser.chatNow);
    console.log(`Me: ${me}, Friend: ${friend}`);
    if (!friend) {
      socket.emit("no friend");
      return;
    }
    const hash = getPrivateRoomId(friend, me);
    console.log(`Result: ${hash}`);
    // 👇 сохраняем имя собеседника как строку
    

    fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));

    socket.emit("set hash", hash);
  });

  

  socket.on("del user",()=>{
    console.log("Del-user")
    User.destroy({where:{username},
      attributes:["useraname"],
    });
  })
  socket.on("createRoom", async ({ roomName, roomDescription }) => {
    if (!roomName || !roomDescription) {
        socket.emit("createRoomError", "Будь ласка, заповніть всі поля");
        return;
    }
    const room = await UserRoom.findOne({ where: { room_name: roomName } });
    if (room) {
      socket.emit("createRoomError", "Кімната з такою назвою вже існує");
      return;
    }

    // Сохраняем комнату в users.json
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!usersData.length) {
      socket.emit("createRoomError", "Ви не авторизовані. Зайдіть через сторінку реєстрації.");
      return;
    }
    const lastUser = usersData[usersData.length - 1];
    const username = lastUser.username;

    // Добавляем комнату в mainRooms пользователя
    if (!lastUser.mainRooms) lastUser.mainRooms = [];
    lastUser.mainRooms.push(roomName);
    fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));

    const newRoom = await UserRoom.create({
      user_name: username, 
      room_name: roomName,
      description: roomDescription,
      date: new Date()
    });{
        socket.emit("createRoomError", "Кімната з такою назвою вже існує");
        return;
    };
  });
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
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1]; 
    const username = currentUser.username || "User"; 
    console.log(username);
    socket.emit("set username", username);
  })
  socket.on("set one", () => {
    list = 1;
    console.log("🔍 Режим поиска: пользователи");
  });

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
          where: { name: { [Op.like]: `%${search}%` } },
          attributes: ["name"],
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
