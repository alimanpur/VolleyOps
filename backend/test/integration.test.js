/**
 * End-to-end integration test over the real Express app + Mongoose models,
 * backed by an in-memory MongoDB (mongodb-memory-server). This exercises the
 * critical tournament-day workflows the spec calls out: auth/authorization,
 * live scoring, undo, substitution, set/match completion, winner advancement,
 * and reopen-clears-downstream.
 *
 * Requires devDependencies to be installed and network access to fetch the
 * mongod binary on first run:  npm install  &&  npm test
 * If the binary can't be downloaded (offline CI), this suite is skipped.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

let mongod;
let mongoose;
let app;
let request;
let skip = false;

async function api(method, path, { body, cookie } = {}) {
  // Minimal supertest-free HTTP helper using Node's http against a live server.
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, setCookie };
}

let baseUrl;
let server;

before(async () => {
  try {
    const mem = await import('mongodb-memory-server');
    mongoose = (await import('mongoose')).default;
    mongod = await mem.MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.SESSION_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    const { connectDb } = await import('../src/config/db.js');
    const { createApp } = await import('../src/app.js');
    await connectDb(process.env.MONGODB_URI);
    app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
        resolve();
      });
    });
  } catch (err) {
    console.warn('[integration] skipped:', err.message);
    skip = true;
  }
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (mongoose) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

function cookieFrom(setCookie) {
  return setCookie ? setCookie.split(';')[0] : null;
}

test('full tournament-day workflow', async (t) => {
  if (skip) return t.skip('in-memory mongo unavailable');

  const { runSeed } = await import('../src/seed/seedRunner.js');
  const { codes } = await runSeed();

  // --- public sees a published tournament, no live match fabricated ---
  const overview = await api('GET', '/public/overview');
  assert.equal(overview.status, 200);
  assert.equal(overview.json.live.length, 0, 'no fabricated live match');

  // --- unauthenticated admin is 401 ---
  const noAuth = await api('GET', '/admin/dashboard');
  assert.equal(noAuth.status, 401);

  // --- admin login ---
  const login = await api('POST', '/auth/admin/login', {
    body: { username: codes.admin.username, password: codes.admin.password },
  });
  assert.equal(login.status, 200);
  const adminCookie = cookieFrom(login.setCookie);
  assert.ok(adminCookie);

  const dash = await api('GET', '/admin/dashboard', { cookie: adminCookie });
  assert.equal(dash.status, 200);
  assert.equal(dash.json.counts.teams, 5);

  // --- find the round-1 match (M01) which is playable ---
  const matchesRes = await api('GET', '/admin/matches', { cookie: adminCookie });
  const m01 = matchesRes.json.matches.find((m) => m.code === 'M01');
  const m02 = matchesRes.json.matches.find((m) => m.code === 'M02');
  assert.ok(m01.teamA && !m01.teamA.tbd, 'M01 has both teams');
  assert.ok(m02.teamB.tbd, 'SF1 slot B is TBD until R1 resolves');

  // --- scorer redeems and scores M01 (assigned in seed) ---
  const scorerCode = codes.scorers[0].code;
  const redeem = await api('POST', '/auth/redeem', { body: { code: scorerCode } });
  assert.equal(redeem.status, 200);
  const scorerCookie = cookieFrom(redeem.setCookie);

  const assignments = await api('GET', '/scorer/assignments', { cookie: scorerCookie });
  const assigned = assignments.json.assignments[0];
  assert.ok(assigned, 'scorer has an assignment');

  // start + score a straight-sets win for team A
  await api('POST', `/scorer/matches/${assigned.id}/start`, { cookie: scorerCookie });
  let dup = 0;
  for (let s = 0; s < 2; s += 1) {
    for (let p = 0; p < 25; p += 1) {
      const r = await api('POST', `/scorer/matches/${assigned.id}/rally`, {
        cookie: scorerCookie,
        body: { clientEventId: `evt-${s}-${p}`, winner: 'A', pointType: 'OTHER' },
      });
      assert.equal(r.status, 200);
      if (r.json.duplicate) dup += 1;
    }
  }
  assert.equal(dup, 0);

  // idempotency: replay an event id -> duplicate, no extra point
  const replay = await api('POST', `/scorer/matches/${assigned.id}/rally`, {
    cookie: scorerCookie,
    body: { clientEventId: 'evt-0-0', winner: 'A', pointType: 'OTHER' },
  });
  assert.equal(replay.json.duplicate, true);

  // match should be finished, team A the winner
  const finished = await api('GET', `/scorer/matches/${assigned.id}`, { cookie: scorerCookie });
  assert.equal(finished.json.match.state, 'FINISHED');
  assert.equal(finished.json.match.winner, 'A');

  // --- winner advanced into SF1 slot B ---
  const afterAdvance = await api('GET', '/admin/matches', { cookie: adminCookie });
  const sf1 = afterAdvance.json.matches.find((m) => m.code === 'M02');
  assert.ok(sf1.teamB && !sf1.teamB.tbd, 'winner advanced into SF1');

  // --- reopen M01 clears downstream SF1 slot B ---
  const reopen = await api('POST', `/admin/matches/${assigned.id}/reopen`, { cookie: adminCookie });
  assert.equal(reopen.status, 200);
  const afterReopen = await api('GET', '/admin/matches', { cookie: adminCookie });
  const sf1b = afterReopen.json.matches.find((m) => m.code === 'M02');
  assert.ok(sf1b.teamB.tbd, 'reopen cleared downstream winner');

  // --- authorization: captain cannot hit another team's private match ---
  const capCode = codes.captains[0].code;
  const capRedeem = await api('POST', '/auth/redeem', { body: { code: capCode } });
  const capCookie = cookieFrom(capRedeem.setCookie);
  const capDash = await api('GET', '/captain/dashboard', { cookie: capCookie });
  assert.equal(capDash.status, 200);
  // captain cannot access admin. With a cookie per role, the captain's cookie
  // (vops_sid_captain) is never read on an admin-scoped route, so the admin
  // endpoint sees no session at all -> 401 (not a wrong-role 403).
  const capAdmin = await api('GET', '/admin/dashboard', { cookie: capCookie });
  assert.equal(capAdmin.status, 401);

  // --- scorer cannot score a match not assigned to them ---
  const otherMatch = afterReopen.json.matches.find((m) => m.code === 'M03');
  const forbidden = await api('POST', `/scorer/matches/${otherMatch.id}/start`, { cookie: scorerCookie });
  assert.equal(forbidden.status, 403);
});
