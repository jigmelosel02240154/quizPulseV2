// Measures real-time round-trip latency for your report (objective: under 200 ms).
// Usage (server must be running):
//   FIREBASE_API_KEY=xxx TEST_EMAIL=you@x.com TEST_PASSWORD=secret SERVER_URL=http://localhost:3000 npm run latency
// Run it against your deployed server URL too, and from a phone hotspot, for realistic numbers.
const { io } = require('socket.io-client');

const { FIREBASE_API_KEY, TEST_EMAIL, TEST_PASSWORD } = process.env;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const SAMPLES = Number(process.env.SAMPLES || 100);

(async () => {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) { console.error('Sign-in failed:', data.error?.message); process.exit(1); }

  const socket = io(SERVER_URL, { auth: { token: data.idToken }, transports: ['websocket'] });
  socket.on('connect_error', (e) => { console.error('Connect error:', e.message); process.exit(1); });
  socket.on('connect', async () => {
    const times = [];
    for (let i = 0; i < SAMPLES; i++) {
      times.push(await new Promise((r) => { const t = performance.now(); socket.emit('ping_check', () => r(performance.now() - t)); }));
      await new Promise((r) => setTimeout(r, 50));
    }
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95) - 1];
    console.log(`Samples: ${SAMPLES}`);
    console.log(`min ${times[0].toFixed(1)} ms | avg ${avg.toFixed(1)} ms | p95 ${p95.toFixed(1)} ms | max ${times[times.length - 1].toFixed(1)} ms`);
    console.log(avg < 200 ? 'PASS: average latency under 200 ms' : 'FAIL: average latency over 200 ms');
    process.exit(0);
  });
})();
