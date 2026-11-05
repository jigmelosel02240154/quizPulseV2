const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

module.exports = {
  PORT: num(process.env.PORT, 3000),
  QUESTION_MS: num(process.env.QUESTION_MS, 15000),
  REVEAL_MS: num(process.env.REVEAL_MS, 2500),
  START_DELAY_MS: num(process.env.START_DELAY_MS, 1500),
  RECONNECT_GRACE_MS: num(process.env.RECONNECT_GRACE_MS, 20000),
  DEFAULT_QUESTIONS: 5,
  MIN_QUESTIONS: 3,
  MAX_QUESTIONS: 15,
  MAX_PLAYERS: 8,
  TZ_OFFSET_HOURS: num(process.env.TZ_OFFSET_HOURS, 6),
  // true  = a campus is only granted after the user verifies their college email (secure)
  // false = the email format alone is enough (easier for demos and testing)
  REQUIRE_VERIFIED_EMAIL: process.env.REQUIRE_VERIFIED_EMAIL === 'true',
  SUBJECTS: ['IT', 'Math', 'General Knowledge'],
  DIFFICULTIES: ['easy', 'medium', 'hard'],
  AVATARS: ['🦊', '🐼', '🦁', '🐯', '🐸', '🐙', '🦉', '🐧', '🦄', '🐲'],
};
