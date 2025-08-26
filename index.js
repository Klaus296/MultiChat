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
const { Op } = require("sequelize");
const filePath = path.join(__dirname, "users.json");
if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf8");
let users = JSON.parse(fs.readFileSync(filePath, "utf8"));
const username = users.length > 0 ? users[users.length - 1].username : null;
const chatsFile = path.join(__dirname, "chats.json");

// Загрузка истории
function loadChatHistory(chatNow) {
    if (!fs.existsSync(chatsFile)) return [];
    const data = JSON.parse(fs.readFileSync(chatsFile, "utf-8"));
    return data[chatNow] || [];
}

// Сохранение нового сообщения
function saveMessage(chatNow, message) {
    let data = {};
    if (fs.existsSync(chatsFile)) {
        data = JSON.parse(fs.readFileSync(chatsFile, "utf-8"));
    }
    if (!data[chatNow]) data[chatNow] = [];
    data[chatNow].push(message);
    fs.writeFileSync(chatsFile, JSON.stringify(data, null, 2));
}
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
app.get("/join_mafia", (req, res) => res.sendFile(path.join(__dirname, "content", "mafia-client.html")));
app.get("/enter",(req,res)=> res.sendFile(path.join(__dirname,"content","user-enter.html")));
app.get("/create", (req, res) => res.sendFile(path.join(__dirname, "content", "create-room.html")));
app.get("/chat", (req, res) => res.sendFile(path.join(__dirname, "content", "home.html")));
app.get("/users-chat",(req,res)=>{res.sendFile(path.join(__dirname,"content","users-chat.html"))});
app.get("/messages",(req,res)=>{res.sendFile(path.join(__dirname,"content","messages.html"))});
app.get("/us_profile", (req, res) => res.sendFile(path.join(__dirname, "content", "user-profile.html")));
app.get("/search",(req,res)=>res.sendFile(path.join(__dirname,"content","search.html")));
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

  // Получить список игроков в комнате
  socket.on("get_players", async (room, callback) => {
    const players = await MafiaUser.findAll({ where: { room } });
    callback(players);
  });

  socket.on("disconnect", () => {
    console.log("❌ Игрок вышел:", socket.id);
  });

  // Отправка нового сообщения
  socket.on("set chat", async ({ chatNow, mainName, msg }) => {
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

      let updatedMessages = [];
      if (!chat) {
        updatedMessages = [{ id: Date.now(), username: mainName, text: msg, date: new Date() }];
        chat = await UserMessage.create({
          sender: mainName,
          recipient: chatNow,
          messages: updatedMessages
        });
      } else {
        let oldMessages = typeof chat.messages === "string" ? JSON.parse(chat.messages) : chat.messages;
        if (!Array.isArray(oldMessages)) oldMessages = [];
        updatedMessages = [...oldMessages, { id: Date.now(), username: mainName, text: msg, date: new Date() }];
        await chat.update({ messages: updatedMessages });
      }

      io.to(roomId).emit("chat set", { chatNow, messages: updatedMessages });
    } catch (err) {
      console.error("❌ Ошибка set chat:", err);
    }
  });



  // Подключение к чату и выдача истории
  socket.on("join chat", async ({ mainName, chatNow }) => {
    try {
      const roomId = getPrivateRoomId(mainName, chatNow);

      // Загружаем все переписки между этими двумя
      let chat = await UserMessage.findOne({
        where: {
          [Op.or]: [
            { sender: mainName, recipient: chatNow },
            { sender: chatNow, recipient: mainName }
          ]
        }
      });

      let messages = [];
      if (chat) {
        messages = typeof chat.messages === "string" ? JSON.parse(chat.messages) : chat.messages;
      }

      socket.join(roomId);
      socket.emit("chat set", { chatNow, messages });

      console.log(`${mainName} подключился к ${roomId}, сообщений: ${messages.length}`);
    } catch (err) {
      console.error("❌ Ошибка join chat:", err);
      socket.emit("chat set", { chatNow, messages: [] });
    }
  });





  socket.on("del room",(room)=>{
    console.log("del")
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1];

    // room - это имя комнаты, удаляем из savedRooms по значению
    if (currentUser && Array.isArray(currentUser.savedRooms)) {
      const index = currentUser.savedRooms.indexOf(room);
      if (index !== -1) {
      currentUser.savedRooms.splice(index, 1);
      fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));
      socket.emit("room deleted", room);
      } else {
      socket.emit("room delete error", "Комната не найдена в savedRooms");
      }
    } else {
      socket.emit("room delete error", "Нет сохранённых комнат");
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
  // Удаление сообщения
  socket.on("delete message", async ({ id, mainName, chatNow }) => {
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
      messages = messages.filter(m => m.id !== id);

      await chat.update({ messages });

      io.to(roomId).emit("chat set", { chatNow, messages });
      console.log(`🗑 Удалено сообщение ${id} в ${roomId}`);
    } catch (err) {
      console.error("❌ Ошибка delete message:", err);
    }
  });


  // Редактирование сообщения
  // Редактирование сообщения
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
  socket.on("add to main room",(data)=>{
    const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const currentUser = usersData[usersData.length - 1];

    if (!currentUser.savedRooms) currentUser.savedRooms = [];
    if (!currentUser.savedRooms.includes(data)) {
      currentUser.savedRooms.push(data);
      fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));
      socket.emit("main room added", data);
    } else {
      socket.emit("main room error", "Кімната вже додана");
    }
  })
  socket.on("show rooms",()=>{
    try {
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1]; // последний вошедший

      const rooms = currentUser.mainRooms || [];
      console.log("📋 Список комнат:", rooms);
    
      socket.emit("rooms",(rooms));
    } catch (err) {
      console.error("❌ Ошибка чтения комнат:", err);
      socket.emit("rooms", []);
    }
  })
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

      users.push({ username: name, pass: password, createdAt: new Date().toISOString(),language:language,savedRooms:[],mainRooms:[],userFriends:[],email:email,chatNow:"",});
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
        attributes: ["room_name", "description"], 
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
  socket.on("createRoom", async ({ roomName, roomDescription,language,categorie }) => {
    if (!roomName || !roomDescription) {
      socket.emit("createRoomError", "Заповніть всі поля");
      return;
    }

    try {
      // Находим пользователя из JSON по имени, сохранённому в сокете
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData.find(u => u.username === socket.username);

      if (!currentUser) {
        socket.emit("createRoomError", "Користувач не знайдений");
        return;
      }

      const newRoom = await UserRoom.create({
        room_name: roomName,
        description: roomDescription,
        user_name: currentUser.username, // имя из JSON
        date: new Date(),
        language: language || "en",
        categorie: categorie,
      });

      console.log("✅ Кімната створена:", newRoom.toJSON());

      if (!currentUser.mainRooms) currentUser.mainRooms = [];
      currentUser.mainRooms.push(roomName);

      // Сохраняем обновлённый JSON
      fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));

      socket.emit("createRoomSuccess", newRoom);
      io.emit("newRoom", newRoom);
    } catch (err) {
      console.error("❌ Помилка створення кімнати:", err);
      socket.emit("createRoomError", "Помилка при створенні кімнати");
    }
  });

  socket.on("show friends", () => {
    try {
      const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const currentUser = usersData[usersData.length - 1]; // последний вошедший
      const friends = currentUser.userFriends || [];
      // const rooms = currentUser.savedRooms || [];
      console.log("📋 Список друзей:", friends);
    
      socket.emit("friends",(friends));
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
          attributes: ["room_name", "description"],
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
function pushToUsersJson(element){
  const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const currentUser = usersData[usersData.length - 1]; // последний вошедший
  currentUser.element.push(push);
  fs.writeFileSync(filePath, JSON.stringify(currentUser, null, 2));
  return current
}
function spliceFromUsersJson(element){
  const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const currentUser = usersData[usersData.length - 1]; // последний вошедший
  const index = currentUser.element.indexOf(element);
  if (index !== -1) {
    currentUser.element.splice(index, 1);
    fs.writeFileSync(filePath, JSON.stringify(usersData, null, 2));
    return true;
  } else {
    return false;
  }
}
server.listen(5050, () => {
  console.log("🚀 Сервер працює на http://localhost:5050");
  const result = getPrivateRoomId("Liza","Stas");
  console.log(`Result: ${result}`);
});
