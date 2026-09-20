import bcrypt from 'bcryptjs';
import { User, Session, Team } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyCode, hashCode, generateAccessCode } from '../utils/codes.js';
import { env } from '../config/env.js';

// One cookie PER ROLE so the four experiences can be signed in simultaneously
// in the same browser without evicting one another. A single shared cookie
// meant logging into the scorer console silently signed the admin out.
const COOKIE_PREFIX = 'vops_sid';
const SCOPES = ['admin', 'captain', 'scorer'];

/** The session scope (cookie suffix) for a role. */
function scopeForRole(role) {
  return String(role || '').toLowerCase();
}

/** The cookie name carrying the session for a given scope/role. */
function cookieNameForScope(scope) {
  return `${COOKIE_PREFIX}_${scope}`;
}

function sessionExpiry() {
  return new Date(Date.now() + env.sessionTtlHours * 3600 * 1000);
}

/** Create a server-side session and return the row (caller sets the cookie). */
async function createSession(user, userAgent) {
  // Enforce one active session per user: drop prior sessions on new login.
  await Session.deleteMany({ user: user._id });
  return Session.create({
    user: user._id,
    role: user.role,
    tournament: user.tournament,
    team: user.team || null,
    userAgent: userAgent || null,
    expiresAt: sessionExpiry(),
  });
}

export const authService = {
  COOKIE_PREFIX,
  SCOPES,
  scopeForRole,
  cookieNameForScope,

  /*
   * Session cookie attributes.
   *
   * In production the frontend (Vercel) and API (Render) live on different
   * registrable domains, so every authenticated XHR is a CROSS-SITE request.
   * Browsers only attach a cookie to a cross-site request when it is
   * SameSite=None, and SameSite=None is only accepted alongside Secure. With
   * the previous SameSite=Lax the browser stored the cookie at login but then
   * withheld it on /auth/me and /admin/* — the verified cause of the 401.
   *
   * In local dev everything is same-origin through the Vite proxy, so Lax
   * (without Secure, to work over plain http) is correct and slightly stricter.
   *
   * No Domain is set: the cookie stays host-only (scoped to the Render API
   * host) and rides along on API requests — it is never shared with Vercel.
   * Requires NODE_ENV=production on Render so `isProd` (hence Secure) is true.
   */
  cookieOptions() {
    return {
      httpOnly: true,
      sameSite: env.isProd ? 'none' : 'lax',
      secure: env.isProd,
      maxAge: env.sessionTtlHours * 3600 * 1000,
      path: '/',
    };
  },

  /** Attributes for clearing the cookie — must match those it was set with
   *  (name/path/secure/sameSite) or the browser won't remove it cross-site. */
  clearCookieOptions() {
    return {
      httpOnly: true,
      sameSite: env.isProd ? 'none' : 'lax',
      secure: env.isProd,
      path: '/',
    };
  },

  /** Admin username/password login. Generic failure message to avoid enumeration. */
  async loginAdmin(username, password, userAgent) {
    const user = await User.findOne({ role: 'ADMIN', username: (username || '').toLowerCase(), isActive: true });
    const ok = user && user.passwordHash && (await bcrypt.compare(password || '', user.passwordHash));
    if (!ok) throw ApiError.unauthenticated('Invalid credentials');
    user.lastLoginAt = new Date();
    await user.save();
    const session = await createSession(user, userAgent);
    return { user, session };
  },

  /**
   * Redeem a captain/scorer invitation code. One-time: sets redeemedAt. Generic
   * failure so a wrong code cannot be distinguished from an unknown one.
   */
  async redeemCode(code, userAgent) {
    if (!code || !code.trim()) throw ApiError.unauthenticated('Invalid code');
    const hash = hashCode(code);
    const user = await User.findOne({ inviteCodeHash: hash, isActive: true });
    if (!user || !verifyCode(code, user.inviteCodeHash)) {
      throw ApiError.unauthenticated('Invalid code');
    }
    if (user.redeemedAt) {
      // Already redeemed once — still allow re-login for the same holder by
      // issuing a fresh session, but the code itself is considered spent for
      // first-time onboarding flows. We simply create a session here.
    } else {
      user.redeemedAt = new Date();
    }
    user.lastLoginAt = new Date();
    await user.save();
    const session = await createSession(user, userAgent);
    return { user, session };
  },

  async logout(sessionId) {
    if (sessionId) await Session.deleteOne({ _id: sessionId });
  },

  /** Resolve a session id to its live session + user, or null if invalid/expired. */
  async resolveSession(sessionId) {
    if (!sessionId) return null;
    const session = await Session.findById(sessionId);
    if (!session) return null;
    if (session.expiresAt.getTime() < Date.now()) {
      await Session.deleteOne({ _id: session._id });
      return null;
    }
    const user = await User.findById(session.user);
    if (!user || !user.isActive) return null;
    return { session, user };
  },

  /**
   * (Re)issue an access code for a captain/scorer user. Returns the plaintext
   * code ONCE. Regeneration bumps codeVersion and clears redeemedAt, which
   * invalidates any previously issued code.
   */
  async issueCode(userId) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.role === 'ADMIN') throw ApiError.badRequest('Admins use password login');
    const code = generateAccessCode();
    user.inviteCodeHash = hashCode(code);
    user.codeVersion += 1;
    user.codeIssuedAt = new Date();
    user.redeemedAt = null;
    await Session.deleteMany({ user: user._id }); // kill old sessions
    await user.save();
    return code; // shown once
  },

  async publicUser(user) {
    let teamInfo = null;
    if (user.team) {
      const team = await Team.findById(user.team).select('name code year');
      if (team) teamInfo = { id: team._id, name: team.name, code: team.code, year: team.year };
    }
    return {
      id: user._id,
      role: user.role,
      displayName: user.displayName,
      team: teamInfo,
      tournament: user.tournament,
    };
  },
};
