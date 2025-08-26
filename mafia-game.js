// mafia-game.js
module.exports = function initMafia(io) {
  const { MafiaUser } = require("./mafia-users"); // твоя модель
  const { Op } = require("sequelize");

  // Лобі — тимчасове сховище гравців, що чекають
  const lobby = [];

  // Кімнати гри, ключ -> об'єкт стану
  const games = {}; // { roomName: { players:[], phase:'lobby'|'night'|'day', timers... } }

  // Конфіг (можна змінити)
  const PLAYERS_PER_ROOM = 10;
  const NIGHT_DURATION_MS = 30000; // 30s на ніч (налаштуй)
  const DAY_DISCUSSION_MS = 60000; // 60s обговорення
  const VOTE_DURATION_MS = 30000; // 30s голосування

  // Допоміжні
  function makeRoomName() {
    return `mafia_${Date.now().toString(36)}`;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  // Створюємо кімнату, переміщуємо туди гравців з лобі
  async function createRoomFromLobby() {
    if (lobby.length < PLAYERS_PER_ROOM) return;
    const players = lobby.splice(0, PLAYERS_PER_ROOM);
    const room = makeRoomName();

    // Ініціалізуємо записи в БД для кожного гравця
    for (const p of players) {
      await MafiaUser.upsert({
        user: p.username,
        room,
        role: "pending",
        do: "waiting",
      }, { where: { user: p.username, room } }).catch(console.error);
    }

    // Зберігаємо стан гри
    games[room] = {
      players: players.map(p => ({ id: p.id, username: p.username, socketId: p.socketId, alive: true })),
      phase: "lobby",
      votes: {}, // голосування
      actions: {}, // нічні дії
    };

    // Повідомляємо гравців і примусово приєднуємо сокети
    for (const p of players) {
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock) {
        sock.join(room);
        sock.emit("mafia_room_assigned", { room, players: games[room].players.map(x => ({ user: x.username })) });
      }
    }

    // Через 2 сек починаємо гру
    setTimeout(() => startGame(room), 2000);
  }

  // Роздати ролі
  async function assignRoles(room) {
    const game = games[room];
    if (!game) return;
    const n = game.players.length;

    // Мінімум: 1 mafia, 1 doctor, 1 detective
    const roles = ["mafia", "doctor", "detective"];
    while (roles.length < n) roles.push("civilian");
    shuffle(roles);

    // Запис у БД та в пам'ять
    for (let i = 0; i < n; i++) {
      const p = game.players[i];
      p.role = roles[i];
      p.alive = true;
      await MafiaUser.update({ role: roles[i], do: "waiting" }, { where: { user: p.username, room } });
      // особиста приватна інформація
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock) sock.emit("mafia_your_role", { role: roles[i] });
    }

    io.to(room).emit("mafia_roles_assigned", { publicCount: game.players.length });
  }

  // Починаємо гру
  async function startGame(room) {
    const game = games[room];
    if (!game) return;
    game.phase = "night";
    await assignRoles(room);

    io.to(room).emit("mafia_game_started", { room });
    beginNight(room);
  }

  // Ніч — збираємо дії
  function beginNight(room) {
    const game = games[room];
    if (!game) return;
    game.phase = "night";
    game.actions = {}; // { username: { type:'kill'|'heal'|'check', target } }

    io.to(room).emit("mafia_phase", { phase: "night", duration: NIGHT_DURATION_MS });

    // Після таймера обробляємо результати
    game.nightTimer = setTimeout(async () => {
      await resolveNight(room);
      beginDay(room);
    }, NIGHT_DURATION_MS);
  }

  // Розв'язання ночі
  async function resolveNight(room) {
    const game = games[room];
    if (!game) return;
    const actions = game.actions || {};

    // Хто мафія вбиває: якщо кілька - беремо найчастіше
    const killVotes = {};
    for (const [actor, act] of Object.entries(actions)) {
      if (act.type === "kill" && act.target) killVotes[act.target] = (killVotes[act.target] || 0) + 1;
    }
    let killTarget = null;
    let max = 0;
    for (const [t, v] of Object.entries(killVotes)) if (v > max) { killTarget = t; max = v; }

    // Хто лікар лікує (може бути null)
    const healedBy = Object.entries(actions).find(([a, act]) => act.type === "heal")?.[1]?.target || null;

    // Детектив перевірки
    const checks = []; // { checker, target, targetRole }
    for (const [actor, act] of Object.entries(actions)) {
      if (act.type === "check" && act.target) {
        const userInGame = game.players.find(p => p.username === act.target);
        if (userInGame) checks.push({ checker: actor, target: act.target, targetRole: userInGame.role });
      }
    }

    // Обробляємо вбивство (якщо лікування не збіглося)
    let killed = null;
    if (killTarget && killTarget !== healedBy) {
      const victim = game.players.find(p => p.username === killTarget && p.alive);
      if (victim) {
        victim.alive = false;
        await MafiaUser.update({ do: "dead" }, { where: { user: victim.username, room } });
        killed = victim.username;
      }
    }

    // Повідомлення
    io.to(room).emit("mafia_night_result", { killed, healedBy, checks });

    // Оновлюємо список гравців (alive flag)
    await Promise.all(game.players.map(p => MafiaUser.update({ do: p.alive ? "alive" : "dead" }, { where: { user: p.username, room } })));
  }

  // День — обговорення + голосування
  function beginDay(room) {
    const game = games[room];
    if (!game) return;
    game.phase = "day";
    game.votes = {}; // target -> count
    io.to(room).emit("mafia_phase", { phase: "day", duration: DAY_DISCUSSION_MS + VOTE_DURATION_MS });

    // Обговорення
    io.to(room).emit("mafia_day_start", { discussionMs: DAY_DISCUSSION_MS });

    // Після обговорення — голосування
    game.dayTimer = setTimeout(() => {
      io.to(room).emit("mafia_vote_start", { voteMs: VOTE_DURATION_MS });
      // кінець голосування
      game.voteTimer = setTimeout(async () => {
        await concludeVoting(room);
        // Перевірка на закінчення гри
        if (!checkGameOver(room)) {
          // Починаємо наступну ніч
          beginNight(room);
        } else {
          // гра завершена, чистимо
          endGame(room);
        }
      }, VOTE_DURATION_MS);
    }, DAY_DISCUSSION_MS);
  }

  // Гравець робить нічну дію
  function playerNightAction({ socket, data }) {
    // data: { room, username, type, target }
    const { room, username, type, target } = data;
    const game = games[room];
    if (!game || game.phase !== "night") return;
    // перевіряємо, що гравець живий
    const pl = game.players.find(p => p.username === username);
    if (!pl || !pl.alive) return;
    // записуємо
    game.actions[username] = { type, target };
    io.to(room).emit("mafia_player_action_ack", { username });
  }

  // Голосування (день)
  async function playerVote({ socket, data }) {
    // data: { room, username, target }
    const { room, username, target } = data;
    const game = games[room];
    if (!game || game.phase !== "day") return;
    if (!game.votesBy) game.votesBy = {}; // who voted for whom
    // Один голос від гравця; якщо перевибір — змінюємо
    const prev = game.votesBy[username];
    if (prev) {
      game.votes[prev] = Math.max(0, (game.votes[prev] || 1) - 1);
    }
    game.votesBy[username] = target;
    game.votes[target] = (game.votes[target] || 0) + 1;

    io.to(room).emit("mafia_votes_update", { votes: game.votes });
  }

  // Підрахунок голосів після кінця голосування
  async function concludeVoting(room) {
    const game = games[room];
    if (!game) return;
    // хто набрав максимум
    let max = 0, victim = null;
    for (const [t, c] of Object.entries(game.votes || {})) {
      if (c > max) { max = c; victim = t; }
    }
    if (victim) {
      const p = game.players.find(x => x.username === victim && x.alive);
      if (p) {
        p.alive = false;
        await MafiaUser.update({ do: "dead" }, { where: { user: p.username, room } });
        io.to(room).emit("mafia_lynch_result", { victim });
      } else {
        io.to(room).emit("mafia_lynch_result", { victim: null });
      }
    } else {
      io.to(room).emit("mafia_lynch_result", { victim: null });
    }

    // Скидуємо голоси
    game.votes = {};
    game.votesBy = {};
  }

  // Перевірка на кінець гри
  function checkGameOver(room) {
    const game = games[room];
    if (!game) return true;
    const alive = game.players.filter(p => p.alive);
    const mafiaCount = alive.filter(p => p.role === "mafia").length;
    const others = alive.length - mafiaCount;
    if (mafiaCount === 0) {
      io.to(room).emit("mafia_game_over", { winner: "civilians" });
      return true;
    }
    if (mafiaCount >= others) {
      io.to(room).emit("mafia_game_over", { winner: "mafia" });
      return true;
    }
    return false;
  }

  // Завершення гри (вивантаження, очищення)
  async function endGame(room) {
    const game = games[room];
    if (!game) return;
    // Видаляємо записи з БД або ставимо role=finished (на твій вибір)
    try {
      await MafiaUser.destroy({ where: { room } });
    } catch (e) {
      console.error("Error cleaning mafia users:", e);
    }

    // Повідомлення і чистка
    io.to(room).emit("mafia_cleanup");
    // Вигнання сіткетів з кімнати
    for (const p of game.players) {
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock) sock.leave(room);
    }
    clearTimeout(game.nightTimer);
    clearTimeout(game.dayTimer);
    clearTimeout(game.voteTimer);
    delete games[room];
  }

  // Підключення сокетів — обробка подій
  io.on("connection", (socket) => {
    // гравець заходить в лобі мафії
    socket.on("mafia_join_lobby", async ({ username }) => {
      // захист від дублювань
      if (!username) return socket.emit("mafia_error", "no_name");
      if (lobby.find(x => x.username === username)) return socket.emit("mafia_already_waiting");
      lobby.push({ username, socketId: socket.id, id: socket.id });
      socket.emit("mafia_joined_lobby", { position: lobby.length });
      io.emit("mafia_lobby_count", { count: lobby.length });

      // Спробуємо створити кімнату
      createRoomFromLobby();
    });

    // Гравець запросив список своїх кімнат/стан
    socket.on("mafia_get_my_game", async ({ room }, cb) => {
      const game = games[room];
      cb && cb(game ? { ok: true, game } : { ok: false });
    });

    // Нічна дія від клієнта
    socket.on("mafia_night_action", (data) => {
      playerNightAction({ socket, data });
    });

    // Голосування (день)
    socket.on("mafia_vote", (data) => {
      playerVote({ socket, data });
    });

    // Коли гравець примусово виходить з лобі
    socket.on("mafia_leave_lobby", ({ username }) => {
      const idx = lobby.findIndex(x => x.username === username);
      if (idx !== -1) lobby.splice(idx, 1);
      io.emit("mafia_lobby_count", { count: lobby.length });
    });

    // Якщо гравець відключається, видаляємо з лобі
    socket.on("disconnect", () => {
      const idx = lobby.findIndex(x => x.socketId === socket.id);
      if (idx !== -1) lobby.splice(idx, 1);
      io.emit("mafia_lobby_count", { count: lobby.length });
    });

  }); // io.on connection end

  // Експорт корисних речей (якщо потрібно)
  return {
    lobby, games
  };
};
