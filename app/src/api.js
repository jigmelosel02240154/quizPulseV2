import { auth } from './firebase';
import { SERVER_URL } from './config';

async function request(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Cannot reach the server at ${SERVER_URL}. Check Wi-Fi and that the server is running.`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Calls that need a logged-in user
export async function api(path, options = {}) {
  const token = await auth.currentUser.getIdToken();
  return request(`${SERVER_URL}/api${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

// Public calls (used before the account exists)
export const getColleges = () => request(`${SERVER_URL}/api/colleges`);

export const signupCheck = (body) =>
  request(`${SERVER_URL}/api/signup-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const usernameAvailable = (name) =>
  request(`${SERVER_URL}/api/username-available?u=${encodeURIComponent(name)}`);
