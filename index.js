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

const filePath = path.join(__dirname, "users.json");
if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]", "utf8");
let users = JSON.parse(fs.readFileSync(filePath, "utf8"));
const username = users.length > 0 ? users[users.length - 1].username : null;

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
const chatNow = [];
sequelize.authenticate()
  .then(() => console.log("✅ Підключено до бази даних"))
  .catch((err) => console.error("❌ Помилка підключення:", err.message));

app.use(express.static(path.join(__dirname, "content")));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "content", "auth.html")));
app.get("/enter",(req,res)=> res.sendFile(path.join(__dirname,"content","user-enter.html")))
app.get("/create", (req, res) => res.sendFile(path.join(__dirname, "content", "create-room.html")));
app.get("/chat", (req, res) => res.sendFile(path.join(__dirname, "content", "home.html")));
app.get("/users-chat",(req,res)=>{res.sendFile(path.join(__dirname,"content","users-chat.html"))})
app.get("/messages",(req,res)=>{res.sendFile(path.join(__dirname,"content","messages.html"))});
app.get("/us_profile", (req, res) => res.sendFile(path.join(__dirname, "content", "user-profile.html")));
app.get("/search",(req,res)=>res.sendFile(path.join(__dirname,"content","search.html")));
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
app.get("/chatNow.json", (req, res) => {
  const usersData = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const currentUser = usersData[usersData.length - 1]; // берем последнего вошедшего
  const chatNow = currentUser.chatNow || [];
  res.json({ chatNow, username: currentUser.username || "User" });
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

app.get
app.get("/main",(req,res)=>{
  const roomName = req.query.room; 
  if (!roomName) {
    return res.send("❌ Комната не указана");
  }

  console.log("➡ Пользователь зашёл в комнату:", roomName);

  res.sendFile(path.join(__dirname, "content", "chat.html"));
})
app.get("/your",(req,res)=>{
  // const chatName = req.query.name;
  // if (!chatName) {
  //   return res.send("❌ Комната не указана");
  // }

  // console.log("➡ Пользователь зашёл в комнату:", chatName);

  res.sendFile(path.join(__dirname, "content", "chat.html"));
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
  socket.on("login", (username) => {
    socket.username = username;
  });
  socket.on("set chat", async ({ chatNow, mainName }) => {
    console.log("➡ Отримання чату:", chatNow, mainName);
    try {
      if (!chatNow || !mainName) {
        socket.emit("chat error", "Некоректні дані для створення чату");
        return;
      }
      const newMessage = await UserMessage.create({
        sender_id: chatNow[0],
        receiver_id: mainName,
        message: "Початок чату",
      });
      console.log("Chat set:", chatNow, mainName);
      socket.emit("chat set", newMessage);
    } catch (err) {
      console.error("❌ Помилка створення чату:", err);
      socket.emit("chat error", "Помилка створення чату");
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
  socket.on("send message",()=>{

  })
  socket.on("get friend",()=>{
    console.log("Get friend");
    console.log(chatNow[0].friend);
    socket.emit("set friend",(chatNow[0].friend));
  })
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

      users.push({ username: name, pass: password, createdAt: new Date().toISOString(),language:language,savedRooms:[],mainRooms:[],userFriends:[],email:email,chatNow:chatNow });
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
  socket.on("createRoom", async ({ roomName, roomDescription,language }) => {
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
        language: language || "en" 
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
  socket.on("get hash",(friend,me)=>{
    const hash = getPrivateRoomId(friend,me);
    chatNow.push(friend);
    console.log(chatNow);
    socket.emit("set hash",hash);
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


server.listen(5050, () => {
  console.log("🚀 Сервер працює на http://localhost:5050");
  const result = getPrivateRoomId("Liza","Stas");
  console.log(`Result: ${result}`);
});
// Result: 58b372b709cfda0fb272d736895956b5ec88c70112add7b938f7bbeb9a235e48