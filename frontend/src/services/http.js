import { ApiError } from './apiError.js';

/*
 * Single HTTP entry point. Pages never call fetch directly — they call a
 * service, which calls request(). Cookies ride along via credentials:'include'
 * so the HTTP-only session cookie authenticates every request.
 *
 * VITE_API_BASE_URL lets the frontend point at a deployed API; in dev it is
 * empty and Vite proxies /api to the backend (same-origin cookies).
 */
// Normalize: strip any trailing slash(es) from the configured base so we never
// emit a double slash (e.g. VITE_API_BASE_URL='http://host:4000/' would produce
// '//api/v1', which Express won't route). Works whether the var is set with or
// without a trailing slash, or left empty (dev proxy, same-origin).
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '') + '/api/v1';

// Listeners for global auth expiry, so the app can redirect to login once.
const authExpiredListeners = new Set();
export function onAuthExpired(fn) {
  authExpiredListeners.add(fn);
  return () => authExpiredListeners.delete(fn);
}

async function request(method, path, { body, signal } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const envelope = payload?.error || {};
    const error = new ApiError(res.status, envelope.code, envelope.message, envelope.details);
    if (res.status === 401) authExpiredListeners.forEach((fn) => fn());
    throw error;
  }
  return payload;
}

export const http = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  del: (path, opts) => request('DELETE', path, opts),
};
