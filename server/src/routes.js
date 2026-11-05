const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { admin, db } = require('./firebase');
const { recordResult } = require('./stats');
const { sampleQuestions } = require('./questions');
const C = require('./config');

router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Public ----------
router.get('/username-available', wrap(async (req, res) => {
  const u = String(req.query.u || '').toLowerCase();
  if (!USERNAME_RE.test(u)) return res.json({ available: false, reason: 'Use 3-20 letters, numbers or _' });
  const snap = await db.collection('users').where('usernameLower', '==', u).limit(1).get();
  res.json({ available: snap.empty });
}));

// ---------- Auth required below ----------
router.use(wrap(async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    req.isAdmin = decoded.admin === true;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}));

router.post('/profile', wrap(async (req, res) => {
  const { username, campus = 'CST', avatar = C.AVATARS[0] } = req.body || {};
  if (!USERNAME_RE.test(username || '')) return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or _' });
  if (!C.AVATARS.includes(avatar)) return res.status(400).json({ error: 'Invalid avatar' });
  const lower = username.toLowerCase();
  const taken = await db.collection('users').where('usernameLower', '==', lower).limit(1).get();
  if (!taken.empty && taken.docs[0].id !== req.uid) return res.status(409).json({ error: 'Username already taken' });
  await db.collection('users').doc(req.uid).set(
    { username, usernameLower: lower, campus: String(campus).slice(0, 20), avatar, createdAt: new Date() },
    { merge: true });
  res.json({ ok: true });
}));

router.patch('/profile', wrap(async (req, res) => {
  const { avatar } = req.body || {};
  if (!C.AVATARS.includes(avatar)) return res.status(400).json({ error: 'Invalid avatar' });
  await db.collection('users').doc(req.uid).set({ avatar }, { merge: true });
  res.json({ ok: true });
}));

router.get('/me', wrap(async (req, res) => {
  const snap = await db.collection('users').doc(req.uid).get();
  res.json({ uid: req.uid, badges: [], subjects: {}, ...(snap.data() || {}) });
}));

// Single-player questions. (Answers are included: practice mode isn't competitive.)
router.get('/questions', wrap(async (req, res) => {
  const { subject = 'Mixed', difficulty = 'any' } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 20);
  res.json(await sampleQuestions({ subject, difficulty, count: limit }));
}));

router.post('/singleplayer/result', wrap(async (req, res) => {
  const { subjectStats, score } = req.body || {};
  if (!subjectStats || typeof subjectStats !== 'object') return res.status(400).json({ error: 'Bad payload' });
  const clean = {};
  let totalCorrect = 0, totalAnswered = 0;
  for (const [name, v] of Object.entries(subjectStats)) {
    if (!C.SUBJECTS.includes(name)) continue;
    const total = Math.min(Math.max(parseInt(v.total) || 0, 0), 50);
    const correct = Math.min(Math.max(parseInt(v.correct) || 0, 0), total);
    clean[name] = { total, correct };
    totalCorrect += correct; totalAnswered += total;
  }
  // The server can't verify practice answers, so cap the score at the theoretical maximum.
  const safeScore = Math.min(Math.max(parseInt(score) || 0, 0), totalCorrect * 150);
  const newBadges = await recordResult(req.uid, {
    subjectStats: clean, score: safeScore, multiplayer: false,
    perfect: totalAnswered >= 5 && totalCorrect === totalAnswered,
  });
  res.json({ ok: true, newBadges });
}));

router.get('/leaderboard', wrap(async (req, res) => {
  let q = db.collection('users');
  if (req.query.campus) q = q.where('campus', '==', String(req.query.campus));
  const snap = await q.orderBy('totalScore', 'desc').limit(25).get();
  res.json(snap.docs.map((d) => {
    const u = d.data();
    return { uid: d.id, username: u.username, avatar: u.avatar, totalScore: u.totalScore || 0, wins: u.wins || 0 };
  }));
}));

// ---------- Admin (custom claim admin=true; see scripts/make-admin.js) ----------
const adminOnly = (req, res, next) => (req.isAdmin ? next() : res.status(403).json({ error: 'Admins only' }));

function validateQuestion(b = {}) {
  const { subject, difficulty, text, options, correctIndex } = b;
  if (!C.SUBJECTS.includes(subject)) return 'Invalid subject';
  if (!C.DIFFICULTIES.includes(difficulty)) return 'Invalid difficulty';
  if (typeof text !== 'string' || text.trim().length < 5) return 'Question text too short';
  if (!Array.isArray(options) || options.length < 2 || options.length > 6 || options.some((o) => typeof o !== 'string' || !o.trim())) return 'Need 2-6 non-empty options';
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return 'Invalid correctIndex';
  return null;
}

router.get('/admin/questions', adminOnly, wrap(async (req, res) => {
  const snap = await db.collection('questions').limit(200).get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}));

router.post('/admin/questions', adminOnly, wrap(async (req, res) => {
  const err = validateQuestion(req.body);
  if (err) return res.status(400).json({ error: err });
  const { subject, difficulty, text, options, correctIndex } = req.body;
  const ref = await db.collection('questions').add({ subject, difficulty, text: text.trim(), options, correctIndex });
  res.json({ id: ref.id });
}));

router.put('/admin/questions/:id', adminOnly, wrap(async (req, res) => {
  const err = validateQuestion(req.body);
  if (err) return res.status(400).json({ error: err });
  const { subject, difficulty, text, options, correctIndex } = req.body;
  await db.collection('questions').doc(req.params.id).set({ subject, difficulty, text: text.trim(), options, correctIndex });
  res.json({ ok: true });
}));

router.delete('/admin/questions/:id', adminOnly, wrap(async (req, res) => {
  await db.collection('questions').doc(req.params.id).delete();
  res.json({ ok: true });
}));

module.exports = router;
