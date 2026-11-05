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

export async function api(path, options = {}) {
  const token = await auth.currentUser.getIdToken();
  return request(`${SERVER_URL}/api${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

export const usernameAvailable = (name) =>
  request(`${SERVER_URL}/api/username-available?u=${encodeURIComponent(name)}`);