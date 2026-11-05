require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { admin, db } = require('./firebase');
const routes = require('./routes');
const { registerGame } = require('./game');
const C = require('./config');

const app = express();
app.use(cors());
app.use((req, res, next) => { console.log(req.method, req.url); next(); });
app.use(express.json({ limit: '50kb' }));
app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));
app.use('/api', routes);
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingInterval: 10000, pingTimeout: 8000 });

// Every socket must present a valid Firebase ID token.
io.use(async (socket, next) => {
  try {
    const decoded = await admin.auth().verifyIdToken(socket.handshake.auth?.token);
    const snap = await db.collection('users').doc(decoded.uid).get();
    const u = snap.data();
    if (!u?.username) return next(new Error('profile_missing'));
    socket.user = { uid: decoded.uid, name: u.username, avatar: u.avatar || C.AVATARS[0] };
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

registerGame(io);
server.listen(C.PORT, () => console.log(`QuizPulse server listening on :${C.PORT}`));
