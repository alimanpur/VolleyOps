import { http } from './http.js';

/*
 * The four experiences share one origin but each holds its OWN session cookie
 * (per role) so they don't evict one another. The shared /auth/* routes can't
 * tell which experience is calling from the path alone, so we tag them with the
 * scope derived from the current URL. Role API routes (/admin, /captain,
 * /scorer) don't need this — the server reads scope from their path.
 */
export function currentScope() {
  const p = typeof window !== 'undefined' ? window.location.pathname : '';
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/captain')) return 'captain';
  if (p.startsWith('/scorer')) return 'scorer';
  return '';
}

function scoped(path) {
  const s = currentScope();
  return s ? `${path}${path.includes('?') ? '&' : '?'}scope=${s}` : path;
}

export const authService = {
  me: () => http.get(scoped('/auth/me')),
  loginAdmin: (username, password) => http.post('/auth/admin/login', { username, password }),
  redeem: (code) => http.post('/auth/redeem', { code }),
  logout: () => http.post(scoped('/auth/logout')),
};
