// Integration test of the multiplayer engine using a fake Socket.io server and stubbed Firebase.
process.env.QUESTION_MS = '300';
process.env.REVEAL_MS = '40';
process.env.START_DELAY_MS = '20';
process.env.RECONNECT_GRACE_MS = '150';

const test = require('node:test');
const assert = require('node:assert');

const stub = (path, exports) => {
  const file = require.resolve(path);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
const recorded = [];
stub('../src/firebase', { db: { collection: () => ({ add: async () => {} }) }, admin: {}, FieldValue: {} });
stub('../src/stats', { recordResult: async (uid, r) => { recorded.push({ uid, ...r }); return []; } });
stub('../src/questions', {
  sampleQuestions: async ({ count }) =>
    [1, 2, 3].map((n) => ({ id: 'q' + n, subject: 'IT', text: 'Question ' + n, options: ['A', 'B', 'C', 'D'], correctIndex: 0 })).slice(0, count),
});
const { registerGame } = require('../src/game');

class FakeSocket {
  constructor(uid) {
    this.id = 's_' + uid + Math.random().toString(36).slice(2);
    this.user = { uid, name: uid, avatar: '🦊' };
    this.handlers = {}; this.events = []; this.rooms = new Set(); this.connected = true;
  }
  on(e, f) { this.handlers[e] = f; }
  emit(e, ...a) { this.events.push([e, ...a]); }
  join(r) { this.rooms.add(r); }
  leave(r) { this.rooms.delete(r); }
  trigger(e, ...a) { return this.handlers[e]?.(...a); }
  count(e) { return this.events.filter((x) => x[0] === e).length; }
  last(e) { return [...this.events].reverse().find((x) => x[0] === e)?.[1]; }
}
class FakeIO {
  constructor() { this.sockets = new Map(); }
  on(ev, f) { if (ev === 'connection') this.onConn = f; }
  to(room) { return { emit: (e, ...a) => this.sockets.forEach((s) => (s.rooms.has(room) || s.id === room) && s.emit(e, ...a)) }; }
  connect(uid) { const s = new FakeSocket(uid); this.sockets.set(s.id, s); this.onConn(s); return s; }
  drop(s) { s.connected = false; this.sockets.delete(s.id); s.trigger('disconnect'); }
}
const waitFor = async (fn, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return; await new Promise((r) => setTimeout(r, 10)); }
  throw new Error('timeout waiting for condition');
};

const io = new FakeIO();
registerGame(io);

test('quick match: pairs players, scores answers, ranks and records stats', async () => {
  recorded.length = 0;
  const a = io.connect('a1'), b = io.connect('b1');
  a.trigger('quick_match', { subject: 'IT' });
  assert.strictEqual(a.count('searching'), 1);
  b.trigger('quick_match', { subject: 'IT' });
  for (let i = 0; i < 3; i++) {
    await waitFor(() => a.count('question_start') === i + 1 && b.count('question_start') === i + 1);
    assert.strictEqual(a.last('question_start').correctIndex, undefined, 'correct answer must not leak');
    a.trigger('submit_answer', { choice: 0 });
    b.trigger('submit_answer', { choice: 1 });
  }
  await waitFor(() => a.count('match_end') === 1);
  const { ranking } = a.last('match_end');
  assert.strictEqual(ranking[0].uid, 'a1');
  assert.ok(ranking[0].score >= 300 && ranking[1].score === 0);
  await waitFor(() => recorded.length === 2);
  assert.strictEqual(recorded.find((r) => r.uid === 'a1').won, true);
  assert.strictEqual(recorded.find((r) => r.uid === 'a1').perfect, true);
  assert.strictEqual(recorded.find((r) => r.uid === 'b1').won, false);
});

test('room: duplicate answers are ignored and invalid choices rejected', async () => {
  const host = io.connect('h2');
  let code;
  host.trigger('create_room', { subject: 'IT', questionCount: 3 }, (r) => { code = r.code; });
  assert.match(code, /^\d{6}$/);
  host.trigger('start_room');
  await waitFor(() => host.count('question_start') === 1);
  host.trigger('submit_answer', { choice: 99 });   // invalid
  host.trigger('submit_answer', { choice: 0 });    // valid
  const score = host.last('score_update').scores[0].score;
  host.trigger('submit_answer', { choice: 0 });    // duplicate
  assert.strictEqual(host.last('score_update').scores[0].score, score);
  host.trigger('leave_room');
});

test('disconnect with no reconnect forfeits: opponent wins', async () => {
  recorded.length = 0;
  const a = io.connect('a3'), b = io.connect('b3');
  let code;
  a.trigger('create_room', { subject: 'IT', questionCount: 3 }, (r) => { code = r.code; });
  b.trigger('join_room', { code }, () => {});
  a.trigger('start_room');
  await waitFor(() => a.count('question_start') === 1);
  io.drop(b);
  await waitFor(() => a.count('match_end') === 1);
  const { ranking } = a.last('match_end');
  assert.strictEqual(ranking[0].uid, 'a3');
  assert.strictEqual(ranking[1].left, true);
});

test('reconnect within the grace period resumes the match', async () => {
  const a = io.connect('a4'), b = io.connect('b4');
  let code;
  a.trigger('create_room', { subject: 'IT', questionCount: 3 }, (r) => { code = r.code; });
  b.trigger('join_room', { code }, () => {});
  a.trigger('start_room');
  await waitFor(() => b.count('question_start') === 1);
  io.drop(b);
  const b2 = io.connect('b4');
  assert.strictEqual(b2.count('resume'), 1);
  const r = b2.last('resume');
  assert.strictEqual(r.state, 'playing');
  assert.ok(r.question && r.question.durationMs > 0);
  await waitFor(() => a.count('match_end') === 1);          // match still completes normally
  assert.strictEqual(a.last('match_end').ranking.every((p) => !p.left), true);
});
