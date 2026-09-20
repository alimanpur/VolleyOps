import { asyncHandler } from '../utils/asyncHandler.js';
import { authService } from '../services/authService.js';
import { recordAudit } from '../services/auditService.js';

export const authController = {
  loginAdmin: asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const { user, session } = await authService.loginAdmin(username, password, req.get('user-agent'));
    const cookie = authService.cookieNameForScope(authService.scopeForRole(user.role));
    res.cookie(cookie, String(session._id), authService.cookieOptions());
    await recordAudit({
      tournament: user.tournament,
      actor: user._id,
      actorLabel: user.displayName,
      action: 'ADMIN_LOGIN',
    });
    res.json({ user: await authService.publicUser(user) });
  }),

  redeem: asyncHandler(async (req, res) => {
    const { code } = req.body || {};
    const { user, session } = await authService.redeemCode(code, req.get('user-agent'));
    const cookie = authService.cookieNameForScope(authService.scopeForRole(user.role));
    res.cookie(cookie, String(session._id), authService.cookieOptions());
    res.json({ user: await authService.publicUser(user) });
  }),

  me: asyncHandler(async (req, res) => {
    if (!req.auth) return res.json({ user: null });
    res.json({ user: await authService.publicUser(req.auth.user) });
  }),

  logout: asyncHandler(async (req, res) => {
    if (req.auth) await authService.logout(req.auth.sessionId);
    // Clear only the cookie for the scope this logout targets, so signing out
    // of one experience leaves the others' sessions intact. Prefer the
    // authenticated role; fall back to the ?scope hint from the client.
    const scope = req.auth
      ? authService.scopeForRole(req.auth.role)
      : String(req.query?.scope || '').toLowerCase();
    if (authService.SCOPES.includes(scope)) {
      res.clearCookie(authService.cookieNameForScope(scope), authService.clearCookieOptions());
    }
    res.json({ ok: true });
  }),
};
