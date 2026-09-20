import { authService } from '../services/authService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Determine which role scope a request is acting under, so we read the right
 * per-role session cookie. Role routes carry it in the path (/api/v1/admin/…);
 * the shared /auth/* routes pass ?scope=admin|captain|scorer. Returns null when
 * the scope can't be determined (e.g. public traffic).
 */
function scopeForRequest(req) {
  const path = req.path || '';
  if (/^\/api\/v1\/admin(\/|$)/.test(path) || /^\/admin(\/|$)/.test(path)) return 'admin';
  if (/^\/api\/v1\/captain(\/|$)/.test(path) || /^\/captain(\/|$)/.test(path)) return 'captain';
  if (/^\/api\/v1\/scorer(\/|$)/.test(path) || /^\/scorer(\/|$)/.test(path)) return 'scorer';
  const q = String(req.query?.scope || '').toLowerCase();
  if (authService.SCOPES.includes(q)) return q;
  return null;
}

/**
 * Populate req.auth from the per-role session cookie when present. Never throws
 * — public routes simply see req.auth === null. With a cookie per role, an
 * admin request only ever reads the admin cookie, so signing into the scorer
 * console can't clobber an admin session. The resolved session's role must
 * match the request scope, or it's ignored.
 */
export const attachSession = asyncHandler(async (req, _res, next) => {
  req.auth = null;
  const scope = scopeForRequest(req);
  if (!scope) return next();
  const sid = req.cookies?.[authService.cookieNameForScope(scope)];
  if (!sid) return next();
  const resolved = await authService.resolveSession(sid);
  if (resolved && authService.scopeForRole(resolved.user.role) === scope) {
    req.auth = {
      sessionId: resolved.session._id,
      userId: resolved.user._id,
      role: resolved.user.role,
      team: resolved.user.team || null,
      tournament: resolved.user.tournament,
      user: resolved.user,
    };
  }
  next();
});

/** Require any authenticated session. 401 when absent. */
export function requireAuth(req, _res, next) {
  if (!req.auth) return next(ApiError.unauthenticated('Session expired or missing'));
  next();
}

/** Require one of the given roles. 401 if unauthenticated, 403 if wrong role. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.auth) return next(ApiError.unauthenticated());
    if (!roles.includes(req.auth.role)) return next(ApiError.forbidden());
    next();
  };
}

/**
 * Captain scope guard: the authenticated captain may only act on their own
 * team. Reads the team id from params/body and compares to the session team.
 */
export function requireOwnTeam(paramKey = 'teamId') {
  return (req, _res, next) => {
    if (!req.auth) return next(ApiError.unauthenticated());
    if (req.auth.role === 'ADMIN') return next(); // admins are unrestricted
    if (req.auth.role !== 'CAPTAIN') return next(ApiError.forbidden());
    const requested = req.params[paramKey] || req.body?.[paramKey];
    if (requested && String(requested) !== String(req.auth.team)) {
      return next(ApiError.forbidden('You can only access your own team'));
    }
    next();
  };
}
