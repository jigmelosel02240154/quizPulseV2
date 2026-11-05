const { db } = require('./firebase');
const C = require('./config');
const { computeScore } = require('./scoring');
const { recordResult } = require('./stats');
const { sampleQuestions } = require('./questions');

const rooms = new Map();    // room code -> room
const userRoom = new Map(); // uid -> room code (one active room per user)
const queues = new Map();   // "subject|difficulty" -> [socket]

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

function genCode() {
  let c;
  do { c = String(Math.floor(100000 + Math.random() * 900000)); } while (rooms.has(c));
  return c;
}

function sanitizeOpts(o = {}) {
  return {
    subject: ['Mixed', ...C.SUBJECTS].includes(o.subject) ? o.subject : 'Mixed',
    difficulty: ['any', ...C.DIFFICULTIES].includes(o.difficulty) ? o.difficulty : 'any',
    questionCount: clamp(parseInt(o.questionCount) || C.DEFAULT_QUESTIONS, C.MIN_QUESTIONS, C.MAX_QUESTIONS),
  };
}

const publicPlayers = (room) =>
  [...room.players.values()].map((p) => ({
    uid: p.uid, name: p.name, avatar: p.avatar, score: p.score,
    connected: p.connected, answered: p.answered, left: !!p.left,
  }));

const lobbyPayload = (room) => ({
  code: room.code, host: room.host, type: room.type, subject: room.subject,
  difficulty: room.difficulty, questionCount: room.questionCount, players: publicPlayers(room),
});

function registerGame(io) {
  const emitLobby = (room) => io.to(room.code).emit('lobby_update', lobbyPayload(room));

  // ---------- room lifecycle ----------
  function makeRoom(type, opts, hostUid) {
    const room = {
      code: genCode(), type, host: hostUid, ...opts,
      players: new Map(), state: 'lobby', questions: [], idx: -1,
      questionOpen: false, qStart: 0, timer: null, nextTimer: null, log: [],
    };
    rooms.set(room.code, room);
    return room;
  }

  function addPlayer(room, socket) {
    const { uid, name, avatar } = socket.user;
    room.players.set(uid, { uid, name, avatar, score: 0, answered: false, connected: true, left: false, socketId: socket.id, graceTimer: null });
    userRoom.set(uid, room.code);
    socket.join(room.code);
    socket.roomCode = room.code;
  }

  function cleanupRoom(room) {
    clearTimeout(room.timer);
    clearTimeout(room.nextTimer);
    room.players.forEach((p) => {
      clearTimeout(p.graceTimer);
      if (userRoom.get(p.uid) === room.code) userRoom.delete(p.uid);
    });
    rooms.delete(room.code);
  }

  // Ends the match if nobody (or only one player of a multiplayer match) is still in it.
  function checkAbandon(room) {
    if (room.state === 'ended') return;
    const present = [...room.players.values()].filter((p) => !p.left);
    if (present.length === 0) return cleanupRoom(room);
    if (room.state === 'playing' && room.players.size > 1 && present.length === 1) endMatch(room);
  }

  // Player explicitly leaves (or switches to another room).
  function removeFromRoom(uid, socket) {
    const code = userRoom.get(uid);
    const room = rooms.get(code);
    userRoom.delete(uid);
    if (socket) { if (code) socket.leave(code); socket.roomCode = null; }
    if (!room) return;
    if (room.state === 'lobby') {
      room.players.delete(uid);
      if (room.players.size === 0) return rooms.delete(code);
      if (room.host === uid) room.host = room.players.keys().next().value;
      emitLobby(room);
    } else if (room.state === 'playing' || room.state === 'starting') {
      const p = room.players.get(uid);
      if (p) { p.left = true; p.connected = false; clearTimeout(p.graceTimer); }
      io.to(room.code).emit('score_update', { scores: publicPlayers(room) });
      checkAbandon(room);
      maybeEndQuestionEarly(room);
    }
  }

  // ---------- match flow (the server is the timer authority) ----------
  async function startMatch(room) {
    if (room.state !== 'lobby') return;
    room.state = 'starting';
    let questions = [];
    try {
      questions = await sampleQuestions({ subject: room.subject, difficulty: room.difficulty, count: room.questionCount });
    } catch (e) { console.error('sampleQuestions failed', e); }
    if (!questions.length) {
      io.to(room.code).emit('match_error', { message: 'No questions available for this selection.' });
      return cleanupRoom(room);
    }
    room.questions = questions;
    room.state = 'playing';
    io.to(room.code).emit('match_start', { total: questions.length });
    room.nextTimer = setTimeout(() => nextQuestion(room), C.START_DELAY_MS);
  }

  function nextQuestion(room) {
    if (room.state !== 'playing') return;
    room.idx++;
    if (room.idx >= room.questions.length) return endMatch(room);
    const q = room.questions[room.idx];
    room.players.forEach((p) => { p.answered = false; });
    room.qStart = Date.now();
    room.questionOpen = true;
    // correctIndex is NEVER sent before the question closes
    io.to(room.code).emit('question_start', {
      index: room.idx, total: room.questions.length, text: q.text,
      options: q.options, subject: q.subject, durationMs: C.QUESTION_MS,
    });
    room.timer = setTimeout(() => endQuestion(room), C.QUESTION_MS);
  }

  function endQuestion(room) {
    if (room.state !== 'playing' || !room.questionOpen) return;
    room.questionOpen = false;
    clearTimeout(room.timer);
    const q = room.questions[room.idx];
    room.players.forEach((p) => {
      if (!p.answered && !p.left) room.log.push({ uid: p.uid, questionId: q.id, subject: q.subject, choice: null, correct: false, timeMs: null });
    });
    io.to(room.code).emit('question_end', { correctIndex: q.correctIndex, scores: publicPlayers(room) });
    room.nextTimer = setTimeout(() => nextQuestion(room), C.REVEAL_MS);
  }

  function maybeEndQuestionEarly(room) {
    if (room.state !== 'playing' || !room.questionOpen) return;
    const waiting = [...room.players.values()].filter((p) => !p.left && p.connected && !p.answered);
    if (waiting.length === 0) endQuestion(room);
  }

  async function endMatch(room) {
    if (room.state === 'ended') return;
    room.state = 'ended';
    room.questionOpen = false;

    const ranking = publicPlayers(room).sort((a, b) => (a.left - b.left) || (b.score - a.score));
    const players = [...room.players.values()];
    const log = room.log;
    const total = room.questions.length;
    const multiplayer = players.length > 1;
    const top = ranking[0];
    const winners = multiplayer && top && !top.left && (top.score > 0 || ranking.some((r) => r.left))
      ? ranking.filter((r) => !r.left && r.score === top.score).map((r) => r.uid) : [];
    const meta = { code: room.code, type: room.type, subject: room.subject, difficulty: room.difficulty };

    io.to(room.code).emit('match_end', { ranking });
    cleanupRoom(room); // frees players immediately; persistence continues below

    for (const p of players) {
      try {
        const mine = log.filter((l) => l.uid === p.uid);
        const subjectStats = {};
        mine.forEach((l) => {
          const s = subjectStats[l.subject] || (subjectStats[l.subject] = { correct: 0, total: 0 });
          s.total++; if (l.correct) s.correct++;
        });
        const newBadges = await recordResult(p.uid, {
          subjectStats, score: p.score, multiplayer,
          won: winners.includes(p.uid),
          perfect: !p.left && total >= 3 && mine.filter((l) => l.correct).length === total,
        });
        if (newBadges.length) io.to(p.socketId).emit('badges_earned', newBadges);
      } catch (e) { console.error('recordResult failed', e); }
    }
    try { await db.collection('matches').add({ ...meta, ranking, answers: log, createdAt: new Date() }); }
    catch (e) { console.error('saving match failed', e); }
  }

  // ---------- sockets ----------
  io.on('connection', (socket) => {
    const { uid } = socket.user;

    // Reconnect support: rejoin an in-progress match automatically.
    const existing = rooms.get(userRoom.get(uid));
    const me = existing?.players.get(uid);
    if (existing && me && !me.left) {
      clearTimeout(me.graceTimer);
      me.connected = true;
      me.socketId = socket.id;
      socket.join(existing.code);
      socket.roomCode = existing.code;
      const payload = { ...lobbyPayload(existing), state: existing.state };
      if (existing.state === 'playing' && existing.questionOpen) {
        const q = existing.questions[existing.idx];
        payload.question = {
          index: existing.idx, total: existing.questions.length, text: q.text, options: q.options, subject: q.subject,
          durationMs: Math.max(0, C.QUESTION_MS - (Date.now() - existing.qStart)),
        };
        payload.answered = me.answered;
      }
      socket.emit('resume', payload);
      io.to(existing.code).emit('score_update', { scores: publicPlayers(existing) });
    }

    socket.on('ping_check', (cb) => typeof cb === 'function' && cb());

    socket.on('create_room', (opts, cb) => {
      removeFromRoom(uid, socket);
      const room = makeRoom('room', sanitizeOpts(opts), uid);
      addPlayer(room, socket);
      cb?.({ code: room.code });
      emitLobby(room);
    });

    socket.on('join_room', ({ code } = {}, cb) => {
      const room = rooms.get(String(code));
      if (!/^\d{6}$/.test(String(code)) || !room || room.state !== 'lobby') return cb?.({ error: 'Room not found or already started' });
      if (room.players.size >= C.MAX_PLAYERS) return cb?.({ error: 'Room is full' });
      if (!room.players.has(uid)) { removeFromRoom(uid, socket); addPlayer(room, socket); }
      cb?.({ code: room.code });
      emitLobby(room);
    });

    socket.on('start_room', () => {
      const room = rooms.get(socket.roomCode);
      if (room && room.host === uid && room.state === 'lobby') startMatch(room);
    });

    socket.on('quick_match', (opts) => {
      removeFromRoom(uid, socket);
      const o = sanitizeOpts(opts);
      const key = `${o.subject}|${o.difficulty}`;
      for (const [k, q] of queues) queues.set(k, q.filter((s) => s !== socket && s.connected));
      const queue = queues.get(key) || [];
      const idx = queue.findIndex((s) => s.user.uid !== uid);
      if (idx >= 0) {
        const [opponent] = queue.splice(idx, 1);
        queues.set(key, queue);
        const room = makeRoom('1v1', { ...o, questionCount: C.DEFAULT_QUESTIONS }, opponent.user.uid);
        addPlayer(room, opponent);
        addPlayer(room, socket);
        emitLobby(room);
        startMatch(room);
      } else {
        queue.push(socket);
        queues.set(key, queue);
        socket.emit('searching');
      }
    });

    socket.on('cancel_search', () => {
      for (const [k, q] of queues) queues.set(k, q.filter((s) => s !== socket));
    });

    socket.on('leave_room', () => {
      for (const [k, q] of queues) queues.set(k, q.filter((s) => s !== socket));
      removeFromRoom(uid, socket);
    });

    socket.on('submit_answer', ({ choice } = {}) => {
      const room = rooms.get(socket.roomCode);
      if (!room || room.state !== 'playing' || !room.questionOpen) return;
      const p = room.players.get(uid);
      const q = room.questions[room.idx];
      if (!p || p.left || p.answered) return;
      if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return;
      const elapsed = Date.now() - room.qStart;
      if (elapsed > C.QUESTION_MS + 300) return; // too late
      p.answered = true;
      const correct = choice === q.correctIndex;
      p.score += computeScore(correct, elapsed);
      room.log.push({ uid, questionId: q.id, subject: q.subject, choice, correct, timeMs: elapsed });
      io.to(room.code).emit('score_update', { scores: publicPlayers(room) });
      maybeEndQuestionEarly(room);
    });

    socket.on('disconnect', () => {
      for (const [k, q] of queues) queues.set(k, q.filter((s) => s !== socket));
      const room = rooms.get(socket.roomCode);
      const p = room?.players.get(uid);
      if (!room || !p || p.socketId !== socket.id) return; // replaced by a newer socket
      if (room.state === 'lobby') return removeFromRoom(uid, null);
      p.connected = false;
      p.graceTimer = setTimeout(() => { p.left = true; checkAbandon(room); maybeEndQuestionEarly(room); }, C.RECONNECT_GRACE_MS);
      io.to(room.code).emit('score_update', { scores: publicPlayers(room) });
      maybeEndQuestionEarly(room);
    });
  });
}

module.exports = { registerGame };
