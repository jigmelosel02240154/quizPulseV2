import { io } from 'socket.io-client';
import { auth } from './firebase';
import { SERVER_URL } from './config';

let socket = null;

// One shared, auto-reconnecting socket. A fresh ID token is sent on every (re)connect.
export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      auth: (cb) => {
        auth.currentUser?.getIdToken().then((token) => cb({ token })).catch(() => cb({}));
      },
    });
  }
  if (socket.connected) return Promise.resolve(socket);
  return new Promise((resolve, reject) => {
    const cleanup = () => { socket.off('connect', ok); socket.off('connect_error', fail); };
    const ok = () => { cleanup(); resolve(socket); };
    const fail = (e) => { cleanup(); reject(e); };
    socket.on('connect', ok);
    socket.on('connect_error', fail);
    socket.connect();
  });
}

export function closeSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

// Round-trip time in ms (used for the latency badge and your 200 ms test).
export function measureLatency(s) {
  return new Promise((resolve) => {
    const t = Date.now();
    s.emit('ping_check', () => resolve(Date.now() - t));
  });
}
