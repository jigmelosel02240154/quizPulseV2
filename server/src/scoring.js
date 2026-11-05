const { QUESTION_MS } = require('./config');

// 100 points for a correct answer + up to 50 bonus points for answering quickly.
function computeScore(correct, elapsedMs, limitMs = QUESTION_MS) {
  if (!correct) return 0;
  const remaining = Math.max(0, limitMs - elapsedMs);
  return 100 + Math.round((remaining / limitMs) * 50);
}

module.exports = { computeScore };
