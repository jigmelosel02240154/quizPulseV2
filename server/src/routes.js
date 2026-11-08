const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { admin, db } = require('./firebase');
const { recordResult } = require('./stats');
const { sampleQuestions } = require('./questions');
const colleges = require('./colleges');
const C = require('./config');

router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Public ----------
router.get('/colleges', (req, res) => {
  res.json({ colleges: colleges.publicList(), requireVerifiedEmail: C.REQUIRE_VERIFIED_EMAIL });
});

router.get('/username-available', wrap(async (req, res) => {
  const u = String(req.query.u || '').toLowerCase();
  if (!USERNAME_RE.test(u)) return res.json({ available: false, reason: 'Use 3-20 letters, numbers or _' });
  const snap = await db.collection('users').where('usernameLower', '==', u).limit(1).get();
  res.json({ available: snap.empty });
}));

// Pre-flight check used by the register screen BEFORE the account is created
router.post('/signup-check', wrap(async (req, res) => {
  const { username, email, campus } = req.body || {};
  if (!USERNAME_RE.test(username || '')) return res.json({ ok: false, error: 'Username must be 3-20 letters, numbers or _' });
  const snap = await db.collection('users').where('usernameLower', '==', username.toLowerCase()).limit(1).get();
  if (!snap.empty) return res.json({ ok: false, error: 'That username is already taken' });
  if (campus) {
    const college = colleges.getCollege(campus);
    if (!college) return res.json({ ok: false, error: 'Unknown college' });
    if (!colleges.emailMatches(email, college)) {
      return res.json({ ok: false, error: `To join ${college.id} you must register with your college email (ending ${colleges.emailHint(college)}). Choose "None" to register without a campus.` });
    }
  }
  res.json({ ok: true });
}));

// ---------- Auth required below ----------
router.use(wrap(async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    req.email = decoded.email || '';
    req.emailVerified = decoded.email_verified === true;
    req.isAdmin = decoded.admin === true;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}));

const campusCheck = (req, campusId) =>
  colleges.checkCampus({ email: req.email, emailVerified: req.emailVerified }, campusId, C.REQUIRE_VERIFIED_EMAIL);

router.post('/profile', wrap(async (req, res) => {
  const { username, campus = null, avatar = C.AVATARS[0] } = req.body || {};
  if (!USERNAME_RE.test(username || '')) return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or _' });
  if (!C.AVATARS.includes(avatar)) return res.status(400).json({ error: 'Invalid avatar' });
  const lower = username.toLowerCase();
  const taken = await db.collection('users').where('usernameLower', '==', lower).limit(1).get();
  if (!taken.empty && taken.docs[0].id !== req.uid) return res.status(409).json({ error: 'Username already taken' });

  const check = campusCheck(req, campus || null);
  let campusPending = false;
  if (!check.ok) {
    if (check.code === 'verify_email') campusPending = true; // create the profile, campus comes after verification
    else return res.status(check.status).json({ error: check.error });
  }

  await db.collection('users').doc(req.uid).set(
    { username, usernameLower: lower, avatar, campus: check.ok ? check.campus : null, createdAt: new Date() },
    { merge: true });
  res.json({ ok: true, campusPending });
}));

// Change avatar, username and/or campus. Only the fields that are sent are changed.
router.patch('/profile', wrap(async (req, res) => {
  const body = req.body || {};
  const update = {};
  const existing = (await db.collection('users').doc(req.uid).get()).data() || {};

  if (body.avatar !== undefined) {
    if (!C.AVATARS.includes(body.avatar)) return res.status(400).json({ error: 'Invalid avatar' });
    update.avatar = body.avatar;
  }

  if (body.username !== undefined) {
    if (!USERNAME_RE.test(body.username)) return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or _' });
    const lower = body.username.toLowerCase();
    const taken = await db.collection('users').where('usernameLower', '==', lower).limit(1).get();
    if (!taken.empty && taken.docs[0].id !== req.uid) return res.status(409).json({ error: 'Username already taken' });
    update.username = body.username;
    update.usernameLower = lower;
    if (!existing.avatar && update.avatar === undefined) update.avatar = C.AVATARS[0]; // repairs incomplete profiles
  }

  if ('campus' in body) {
    const check = campusCheck(req, body.campus || null);
    if (!check.ok) return res.status(check.status).json({ error: check.error, code: check.code });
    update.campus = check.campus; // null = leave campus
  }

  if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update' });
  await db.collection('users').doc(req.uid).set(update, { merge: true });
  res.json({ ok: true });
}));

router.get('/me', wrap(async (req, res) => {
  const ref = db.collection('users').doc(req.uid);
  const data = (await ref.get()).data() || {};

  // Self-heal: drop a campus the user's email does not qualify for (e.g. accounts made before campus rules existed)
  if (data.campus && !colleges.emailMatches(req.email, colleges.getCollege(data.campus))) {
    data.campus = null;
    await ref.set({ campus: null }, { merge: true });
  }

  res.json({
    uid: req.uid, badges: [], subjects: {}, ...data,
    email: req.email,
    campusName: colleges.getCollege(data.campus)?.name || null,
    eligibleColleges: colleges.eligibleColleges(req.email).map((c) => ({ id: c.id, name: c.name })),
    colleges: colleges.publicList(),
    requireVerifiedEmail: C.REQUIRE_VERIFIED_EMAIL,
    isAdmin: req.isAdmin,
  });
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

// Global leaderboard, or one college's leaderboard with ?campus=CST (no Firestore index needed)
router.get('/leaderboard', wrap(async (req, res) => {
  const campus = req.query.campus ? String(req.query.campus) : null;
  let rows;
  if (campus) {
    if (!colleges.getCollege(campus)) return res.status(400).json({ error: 'Unknown college' });
    const snap = await db.collection('users').where('campus', '==', campus).limit(500).get();
    rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
      .slice(0, 25);
  } else {
    const snap = await db.collection('users').orderBy('totalScore', 'desc').limit(25).get();
    rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }
  res.json(rows.map((u) => ({
    uid: u.uid, username: u.username, avatar: u.avatar, campus: u.campus || null,
    totalScore: u.totalScore || 0, wins: u.wins || 0,
  })));
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
