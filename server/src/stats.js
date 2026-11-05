const { db, FieldValue } = require('./firebase');
const { TZ_OFFSET_HOURS } = require('./config');

// Calendar day in the campus timezone (default Bhutan, UTC+6)
const dayStr = (daysBack = 0) =>
  new Date(Date.now() + TZ_OFFSET_HOURS * 3600e3 - daysBack * 864e5).toISOString().slice(0, 10);

/**
 * Applies the result of a quiz (single-player or multiplayer) to a user's profile.
 * Returns the list of badge ids that were newly earned.
 */
async function recordResult(uid, { subjectStats = {}, score = 0, won = false, multiplayer = false, perfect = false }) {
  const ref = db.collection('users').doc(uid);
  let newBadges = [];

  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const d = snap.data() || {};

    let streak = d.streak || 0;
    if (d.lastActive !== dayStr()) streak = d.lastActive === dayStr(1) ? streak + 1 : 1;

    const matches = (d.matches || 0) + (multiplayer ? 1 : 0);
    const wins = (d.wins || 0) + (won ? 1 : 0);
    const totalScore = (d.totalScore || 0) + score;

    let answered = 0, correct = 0;
    const subjects = {};
    for (const [name, v] of Object.entries(subjectStats)) {
      answered += v.total; correct += v.correct;
      subjects[name] = { correct: FieldValue.increment(v.correct), total: FieldValue.increment(v.total) };
    }

    const had = new Set(d.badges || []);
    const badges = new Set(had);
    if (multiplayer) badges.add('first_battle');
    if (wins >= 5) badges.add('champion');
    if (streak >= 7) badges.add('week_warrior');
    if (totalScore >= 1000) badges.add('score_1000');
    if (perfect) badges.add('sharpshooter');
    newBadges = [...badges].filter((b) => !had.has(b));

    t.set(ref, {
      streak,
      bestStreak: Math.max(d.bestStreak || 0, streak),
      lastActive: dayStr(),
      matches, wins, totalScore,
      totalAnswered: FieldValue.increment(answered),
      totalCorrect: FieldValue.increment(correct),
      badges: [...badges],
      subjects,
    }, { merge: true });
  });

  return newBadges;
}

module.exports = { recordResult, dayStr };
