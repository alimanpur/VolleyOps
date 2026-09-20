# VolleyOps

Tournament management and live scoring for the **IPS Academy Volleyball Tournament** (21–22 September 2026, matches from 3:00 PM IST). One codebase, four purpose-built experiences: a public spectator site, a captain portal, a mobile scoring console, and an admin control center. MongoDB is the single source of truth — nothing about the tournament is hardcoded in the UI.

## Stack

- **Backend:** Node + Express + MongoDB (Mongoose), ESM. HTTP-only cookie sessions.
- **Frontend:** Vite + React 18 + React Router v6 + Tailwind CSS v4 (JavaScript/JSX).
- **No build-time secrets in the client.** The API base URL is the only frontend env var.

## Repository layout

```
volley/
  backend/     Express API, Mongoose models, pure domain logic, seed
  frontend/    React app: public / captain / scorer / admin
```

## Prerequisites

- Node 18+ (Node 20/22 recommended)
- A running MongoDB (local `mongodb://127.0.0.1:27017` or Atlas)

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env          # then edit values (Mongo URI, session secret, admin login)
npm install
npm run seed                  # wipes + rebuilds the tournament, PRINTS ACCESS CODES
npm run dev                   # http://localhost:4000
```

`npm run seed` prints the admin login plus one-time captain and scorer access codes. **Copy them** — codes are shown once and stored only as hashes.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

**In dev, leave `VITE_API_BASE_URL` unset.** The client then calls same-origin `/api/v1`, and Vite's dev proxy (see `vite.config.js`) forwards `/api` to the backend on port 4000 — so session cookies are same-origin and no CORS is involved. This is the simplest path and avoids cross-origin cookie friction.

Only set `VITE_API_BASE_URL` when the API lives on a different origin (e.g. a deployed backend): `VITE_API_BASE_URL=https://api.yourhost.com`. A trailing slash is tolerated (the client normalizes it), but the value must be the API origin **without** the `/api/v1` suffix — the client appends that. If you set it for local two-port dev instead of using the proxy, also list the frontend origin in the backend's `CORS_ORIGIN`. Restart `npm run dev` after changing any `.env` value.

## Environment (backend `.env`)

| Key | Purpose |
| --- | --- |
| `PORT` | API port (default 4000) |
| `NODE_ENV` | `development` / `production` |
| `MONGODB_URI` | Mongo connection string (source of truth) |
| `SESSION_SECRET` | Long random string signing session cookies |
| `SESSION_TTL_HOURS` | Session lifetime (default 12) |
| `CORS_ORIGIN` | Comma-separated allowed origins for credentialed requests |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin bootstrap, used by the seed only |
| `TRUST_PROXY` | `true` behind a reverse proxy so secure cookies work |

## Roles & access

| Role | Enters via | Scope |
| --- | --- | --- |
| **Public** | no login | Read-only: fixtures, live scores, standings, stats, awards |
| **Captain** | `/captain` → redeem access code | Their team's roster, fixtures, stats, notifications |
| **Scorer** | `/scorer` → redeem access code | Only matches assigned to them; the scoring console |
| **Admin** | `/admin/login` → username + password | Everything: teams, players, courts, bracket, assignments, corrections, awards |

Access codes are `XXXX-XXXX`, SHA-256 hashed, single-use, and shown once. Regenerating a code invalidates the old one. Authorization is enforced **server-side** on every route — the UI never gates data it shouldn't have.

## Tournament format

Five teams, single-elimination with real progression (no filler BYE matches):

```
M01  Round 1     1ST_CSE  vs  1ST_AIML
M02  Semifinal 1 winner(M01) vs 3RD_CSE_1
M03  Semifinal 2 3RD_CSE_2  vs 2ND_YEAR
M04  Final        winner(M02) vs winner(M03)
```

The winner of each match auto-advances into the correct downstream slot. Reopening a finished match (admin) clears whatever it fed downstream, as long as that downstream match hasn't started.

**Rules:** best-of-3; sets to 25, deciding set to 15; win by 2 with no cap; rally winner serves next. **Set and match completion are decided by the server**, never the client — the console just reports rally winners.

## Live scoring model

Scoring is an append-only log. Each rally is a `RallyEvent`; the authoritative match state is *reconstructed* from those events (`domain/scoring.js → replayRallies`). Consequences:

- **Idempotent:** every rally carries a client-generated `clientEventId`, unique per match. Replaying it (after a flaky connection) never double-counts.
- **Offline-tolerant:** the scorer console queues rallies in `localStorage` and flushes them in order when back online. A server rejection pauses the queue and surfaces the reason rather than silently dropping points.
- **Undo** voids the last event (it isn't deleted) and the state is re-derived; it can even bring a "finished" match back to live for a correction.
- **Attribution** (attack kill / block / ace / opponent error / other, with an optional player) is optional — scoring stays fast and a point is never blocked on picking a name.

## API overview

All routes are under `/api/v1`, grouped by audience and guarded by role:

- `/auth` — admin login, code redeem, logout, `me`
- `/public/*` — overview, fixtures, results, matches, teams, players, standings, stats, awards, search (no auth)
- `/captain/*` — dashboard, roster, fixtures, standings, stats, notifications (captain-scoped)
- `/scorer/*` — assignments, match detail, lineups, start, rally, undo, patch rally, substitute (assigned matches only)
- `/admin/*` — tournament, teams, players, courts, matches (edit/cancel/lock/reopen/assign scorer), bracket build/publish, access codes, awards, audit, dashboard

Responses use a consistent envelope; errors carry a safe message and status. See `frontend/CONTRACT.md` for the exact data shapes each endpoint returns.

## Testing

```bash
cd backend && npm test        # pure-domain unit tests (scoring, bracket, standings, stats, roster, lifecycle)
cd backend && npm run verify   # loads the whole server module graph — catches bad imports/named exports
```

The domain logic is deliberately extracted into dependency-free modules under `backend/src/domain/` so the rules that matter most — set/match completion, bracket progression, standings tiebreaks, stat derivation — are unit-tested in isolation. `npm run verify` imports `app.js` (without connecting to Mongo or listening), so any broken import across the graph fails loudly.

```bash
cd frontend && npm run lint             # eslint (flat config, eslint.config.js)
cd frontend && node scripts/verify-imports.mjs   # static relative-import path check (no deps needed)
```

## Deployment notes

### Backend (Render)

1. Connect the `backend/` directory to Render as a Web Service.
2. Set the build command to `npm install` and the start command to `npm start`.
3. Add environment variables:
   - `NODE_ENV=production`
   - `PORT=10000` (Render default)
   - `MONGODB_URI` — your MongoDB Atlas connection string
   - `SESSION_SECRET` — a long random string
   - `SESSION_TTL_HOURS=12`
   - `CORS_ORIGIN` — your Vercel frontend origin (e.g. `https://volleyops.vercel.app`)
   - `ADMIN_USERNAME` — your admin login username
   - `ADMIN_PASSWORD` — your admin login password
   - `TRUST_PROXY=true`
4. Render automatically sets `PORT` and provides HTTPS; `TRUST_PROXY=true` ensures secure cookies work behind the proxy.
5. Do NOT enable auto-deploy on the production database until you have run `npm run seed` once with real data.

### Frontend (Vercel)

1. Connect the `frontend/` directory to Vercel.
2. Set the environment variable:
   - `VITE_API_BASE_URL` — your Render backend URL (e.g. `https://volleyops-api.onrender.com`)
3. Vercel automatically runs `npm run build` and serves `dist/`.
4. SPA routing is configured via `vercel.json` so all routes serve `index.html`.

### Production checklist

- Run `npm run seed` **once** against the production database to create the tournament and issue access codes, then distribute codes to captains and scorers.
- Set `NODE_ENV=production` on the backend.
- Set a strong, unique `SESSION_SECRET` (minimum 32 random characters).
- Set `TRUST_PROXY=true` when behind Render/nginx.
- Set `CORS_ORIGIN` to the exact Vercel frontend origin.
- Verify the MongoDB Atlas IP whitelist allows Render's outbound IPs.
- Confirm `npm test` passes and `npm run verify` succeeds before deploying.
- Never commit `.env` to Git.
#   V o l l e y O p s  
 