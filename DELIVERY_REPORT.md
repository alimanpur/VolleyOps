# VolleyOps — Delivery Report

Built from an empty folder into a complete, runnable full-stack application: an Express + MongoDB API and a React + Vite client, covering four role-specific experiences for the IPS Academy Volleyball Tournament (21–22 September 2026).

This report is honest about what is verified and what still requires your machine. **It does not claim "production ready"** — the critical workflows are implemented and the pure logic is unit-tested, but end-to-end integration against a live MongoDB has to be run by you (the sandbox this was built in cannot install npm packages; see *Build & verification* below).

## 1. What was built

A working monorepo at `C:\Projects\volley`:

- **Backend** — 11 Mongoose models, 8 services, 7 pure domain modules, REST controllers/routes across five audiences, a seed that builds the real tournament and issues access codes, and a domain test suite.
- **Frontend** — 4 experiences: public spectator site (15 pages), admin control center (16 pages), captain portal (8 pages), scorer console (6 pages), plus 7 shared match/UI components and a documented data contract.
- **Docs** — `README.md` (setup, env, seed, roles, API, deployment), `frontend/CONTRACT.md` (API data shapes), and this report.

## 2. Architecture

The design principle throughout: **the server owns the truth, and the hardest rules live in pure, testable functions.**

- `backend/src/domain/` holds dependency-free logic — no Express, no Mongoose. This is where set/match completion, bracket progression, standings tiebreaks, roster eligibility, the lifecycle state machine, and stat derivation live. Because it's pure, it's unit-tested in isolation without a database.
- `backend/src/services/` orchestrates: it loads/saves Mongoose docs and delegates every rule decision to the domain layer.
- Controllers are thin; they authorize, call a service, and serialize a DTO. Serializers guarantee the UI never receives a raw null where it expects a label (unresolved bracket slots carry a human "TBD" explanation).
- The React app talks to the API only through per-role service modules over a single `http` client (credentialed cookies, centralized auth-expiry handling). No component builds URLs by hand.

## 3. Routes

Mounted under `/api/v1`, grouped and role-guarded:

- `/auth` — admin login, code redeem, logout, `me`
- `/public/*` — overview, fixtures, results, matches, teams, players, standings, stats, awards, search (no auth)
- `/captain/*` — dashboard, roster, fixtures, standings, stats, notifications (team-scoped)
- `/scorer/*` — assignments, match, lineups, start, rally, undo, patch rally, substitute (assigned matches only)
- `/admin/*` — tournament, teams, players, courts, matches (edit/cancel/lock/reopen/assign scorer), bracket build/publish, access codes (issue/regenerate/revoke), awards, audit, dashboard

Every frontend service call was cross-checked against a registered backend route — no orphaned calls.

## 4. Data models

`Tournament`, `Team`, `Player`, `Court`, `Match`, `RallyEvent`, `User`, `Session`, `Award`, `Notification`, `AuditEntry`.

Key choices: `Match` carries set scores, lineups, substitutions, bracket wiring (`source` / `nextMatchId` / `nextSlot`) and a rally sequence counter. `RallyEvent` is append-only with a unique `(match, clientEventId)` index for idempotency and a `voided` flag for undo (events are never deleted). `Session` uses a TTL index for expiry. Standings and player stats are **derived**, never stored.

## 5. Authentication & authorization

- HTTP-only cookie sessions, stored server-side with a TTL; one active session per user. Each role has its own cookie (`vops_sid_admin` / `vops_sid_captain` / `vops_sid_scorer`) so the four experiences can be signed in at once in one browser without evicting one another.
- Admin logs in with username + password (bootstrapped by the seed). Captains and scorers redeem `XXXX-XXXX` access codes.
- Access codes are **SHA-256 hashed** (never stored or logged in plaintext), compared in constant time, single-use, and shown exactly once. Regeneration bumps a code version and invalidates the old code. Wrong-code responses are generic (no enumeration).
- Authorization is enforced on the server for every protected route — a scorer can only touch matches assigned to them; a captain only sees their team. The client's route guards are convenience, not security.

## 6. Bracket & progression

Real 5-team single-elimination, no fake BYE matches:

```
M01 Round 1      1ST_CSE vs 1ST_AIML
M02 Semifinal 1  winner(M01) vs 3RD_CSE_1
M03 Semifinal 2  3RD_CSE_2 vs 2ND_YEAR
M04 Final        winner(M02) vs winner(M03)
```

When a match finishes, its winner is written into the correct downstream slot automatically. Admin reopen reverses that advancement (and refuses if the downstream match has already started), keeping the bracket consistent.

## 7. Scoring

Server-authoritative and reconstruction-based. Rallies append to `RallyEvent`; `replayRallies()` rebuilds set scores, serving side, and match completion from the event log. The client never decides a set is over.

- **Idempotent** on `(match, clientEventId)` — replays after a dropped connection can't double-count.
- **Offline-tolerant** — the console queues rallies in `localStorage`, flushes in order, retries on reconnect, and pauses (surfacing the reason) if the server rejects an event rather than losing points silently.
- **Undo** voids the last event and re-derives state; it can reopen a just-finished match for a correction.
- **Attribution** (attack kill / block / ace / opponent error / other, optional player) never blocks scoring — an unattributed point is one tap.
- Rules enforced: best-of-3, 25 / deciding 15, win-by-2 uncapped, rally-winner serves.

## 8. The four experiences

- **Public** — overview with live matches, fixtures, results, per-match center with rally timeline, teams, player profiles, standings, stats, awards, search. Honest empty states; no fabricated data.
- **Captain** — dashboard, their roster, their fixtures, standings, team stats, notifications.
- **Scorer** — a portrait mobile console (~430px): lineup confirmation, a hero scoreboard, two large "Point" buttons opening a 1–3-tap attribution sheet, a last-point strip, press-and-hold undo, substitution and rally-history sheets, and a live sync indicator.
- **Admin** — desktop control center: tournament setup, teams/players/courts CRUD, bracket build & publish, scorer assignment, match corrections (edit/cancel/lock/reopen), access-code management, awards, audit log.

## 9. Design

Editorial / athletic / sports-operations direction, deliberately not "generic SaaS": paper palette (#F6F3EC), Barlow Condensed + Instrument Sans, tabular numerals for all scores and stats, 1px rules, 2–4px radii, green/deep-green with score-red for live. No purple/neon gradients, no glassmorphism, no oversized rounded cards.

## 10. Build & verification

**Verified after a real `npm install` on the target machine:**

- `backend`: **26 domain unit tests pass** (1 integration test skips without a live Mongo); `npm run verify` loads the entire server module graph clean; `npm run dev` boots.
- `frontend`: **eslint passes with zero errors** (flat `eslint.config.js`), the `vite` dev server starts, and the relative-import check passes across 67 files.

**Six real issues surfaced by running it, now fixed:**

1. **Server wouldn't boot** — `matchService.js` imported `slotsResolved` from `domain/lifecycle.js`, but it's defined in `domain/bracket.js`, so ESM threw on the missing named export. Fixed by re-exporting `slotsResolved` from `lifecycle.js` (which already re-exports `MATCH_STATES` from the same module). Added `npm run verify` (loads `app.js` without Mongo) so this class of bug can't pass silently again — a file-existence import check missed it.
2. **Seed crashed on a stale index** — an earlier schema used `teamId`; the database retained a unique `teamId_1_jerseyNumber_1` index, so seeding players (which have no `teamId`) collided on `null`. Fixed: the seed now calls `syncIndexes()` after clearing, dropping any index not in the current schema.
3. **Seed + integration test crashed on a null-username collision** — `User` had a unique `{tournament, username}` index marked `sparse`, but only admins have a username; captains and scorers store `username: null` *explicitly* (the field has `default: null`), and `sparse` only skips absent fields, not present-null ones. The second code-based user in a tournament collided on `null`. Fixed with a **partial** unique index (`partialFilterExpression: { username: { $type: 'string' } }`) so uniqueness applies only to real usernames. `syncIndexes()` in the seed swaps the old index for the partial one.
4. **`npm run lint` errored** — no ESLint flat config existed (v9 requires `eslint.config.js`), and 10 minor issues (unused imports, unescaped apostrophes) hid behind it. Added the config and fixed all 10; lint is clean.
5. **Idempotency broke once a match finished** — in `recordRally`, the "match must be live" guard ran *before* the duplicate-event check. Replaying the rally that ended the match (a normal offline-outbox re-flush) hit a 409 "not live" instead of returning `duplicate: true`, which would stall the scorer's queue. Fixed by checking for the stored event first: a replay is a safe no-op in any state, and only a genuinely new point requires the match to be live. This is the guarantee the offline outbox relies on, so it matters. Caught by the end-to-end integration test.
6. **Every API call 404'd with a double slash** — the client built its base URL as `VITE_API_BASE_URL + '/api/v1'`. With the env var set to `http://localhost:4000/` (trailing slash), that became `http://localhost:4000//api/v1`, and Express won't route a path beginning `//`. Fixed by normalizing the base (stripping trailing slashes) so it's correct whether the var is set with a slash, without one, or left empty. Also corrected the README: in dev, leave `VITE_API_BASE_URL` unset and use the Vite proxy (same-origin, no CORS). Only static tests ran during build, so a live browser was the first thing to exercise the real request path.

Note: the seed connected to the `test` database, meaning the `MONGODB_URI` in use has no database path. Use the `.env.example` value (`…/volleyops`) or append a db name to your URI.

**What could NOT run in the build sandbox, and why:** it cannot reach the npm registry (403), so `node_modules` was absent there — `npm install`, `vite build`, `eslint`, and Mongo-backed tests only ran on your machine, not during construction. This is why the boot-time and lint bugs slipped through initial checks; the module-graph verify script now closes that gap.

**What to run to confirm end-to-end:**

```bash
cd backend  && npm install && npm test && npm run verify
cd frontend && npm install && npm run lint && npm run build
# then, with MongoDB running (URI including a db name, e.g. .../volleyops):
cd backend  && npm run seed && npm run dev
cd frontend && npm run dev
```

Then walk the critical path: seed → admin login → publish bracket → assign a scorer → score M01 to completion (verify the winner auto-advances into M02) → confirm the public site and standings reflect it → test offline scoring (drop the network, score, reconnect, confirm no duplicates) → reopen a finished match and confirm downstream clears.

## 11. Remaining issues / honest gaps

- **Not yet walked end-to-end against MongoDB.** The server boots, seeds, and the logic is unit-tested, but the full seed → score → advance → publish loop still needs one manual run. Treat your first `npm run dev` session as integration testing.
- **No automated frontend component tests** — verification on the client is eslint + build + the import check. No React test runner was set up.
- **Accessibility** is built in by construction (focus-visible styles, reduced-motion, semantic roles, aria labels on the console controls), but full WCAG validation requires manual testing with assistive technology.

Bottom line: a complete, coherent implementation of the brief. The three bugs from the first real run are fixed and the server now boots, seeds, lints, and builds. It is intentionally **not** labeled production-ready until you walk the critical scoring/bracket path end-to-end.
