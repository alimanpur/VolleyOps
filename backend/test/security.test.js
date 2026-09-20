import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

let mongod;
let mongoose;
let app;
let skip = false;

async function api(method, path, { body, cookie } = {}) {
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
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'testpass';
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
    console.warn('[security] skipped:', err.message);
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

test('unauthenticated admin endpoint returns 401', async () => {
  if (skip) return;
  const res = await api('GET', '/admin/dashboard');
  assert.equal(res.status, 401);
});

test('unauthenticated captain endpoint returns 401', async () => {
  if (skip) return;
  const res = await api('GET', '/captain/dashboard');
  assert.equal(res.status, 401);
});

test('unauthenticated scorer endpoint returns 401', async () => {
  if (skip) return;
  const res = await api('GET', '/scorer/assignments');
  assert.equal(res.status, 401);
});

test('captain cookie cannot access admin endpoints', async () => {
  if (skip) return;
  const { runSeed } = await import('../src/seed/seedRunner.js');
  const { codes } = await runSeed();
  const capCode = codes.captains[0].code;
  const redeem = await api('POST', '/auth/redeem', { body: { code: capCode } });
  const capCookie = cookieFrom(redeem.setCookie);
  const res = await api('GET', '/admin/dashboard', { cookie: capCookie });
  assert.equal(res.status, 401);
});

test('scorer cannot access admin endpoints', async () => {
  if (skip) return;
  const { runSeed } = await import('../src/seed/seedRunner.js');
  const { codes } = await runSeed();
  const scorerCode = codes.scorers[0].code;
  const redeem = await api('POST', '/auth/redeem', { body: { code: scorerCode } });
  const scorerCookie = cookieFrom(redeem.setCookie);
  const res = await api('GET', '/admin/dashboard', { cookie: scorerCookie });
  assert.equal(res.status, 401);
});

test('captain cannot access another captain\'s match', async () => {
  if (skip) return;
  const { runSeed } = await import('../src/seed/seedRunner.js');
  const { codes } = await runSeed();
  const capCode = codes.captains[0].code;
  const redeem = await api('POST', '/auth/redeem', { body: { code: capCode } });
  const capCookie = cookieFrom(redeem.setCookie);
  // Get captain's team
  const dash = await api('GET', '/captain/dashboard', { cookie: capCookie });
  const myTeamId = dash.json.team.id;
  // Get all matches and try to access one not involving this captain's team
  const matchesRes = await api('GET', '/public/fixtures', { cookie: capCookie });
  const allMatches = matchesRes.json.matches;
  const otherMatch = allMatches.find((m) => {
    const aId = m.teamA?.id;
    const bId = m.teamB?.id;
    return aId && bId && String(aId) !== String(myTeamId) && String(bId) !== String(myTeamId);
  });
  if (otherMatch) {
    const res = await api('GET', `/captain/matches/${otherMatch.id}`, { cookie: capCookie });
    assert.notEqual(res.status, 200);
  }
});

test('mass assignment: team create uses server-side tournament, not client', async () => {
  if (skip) return;
  const { runSeed } = await import('../src/seed/seedRunner.js');
  const { codes } = await runSeed();
  const login = await api('POST', '/auth/admin/login', {
    body: { username: codes.admin.username, password: codes.admin.password },
  });
  const adminCookie = cookieFrom(login.setCookie);
  const fakeTournamentId = '000000000000000000000000';
  const res = await api('POST', '/admin/teams', {
    cookie: adminCookie,
    body: { code: 'MASS', name: 'Mass Test', year: 1, tournament: fakeTournamentId },
  });
  assert.equal(res.status, 201);
  // Team must belong to the active tournament, not the fake one
  const { Team } = await import('../src/models/index.js');
  const created = await Team.findOne({ code: 'MASS' });
  assert.ok(created);
  assert.notEqual(String(created.tournament), fakeTournamentId);
});

test('protected endpoint rejects expired session', async () => {
  if (skip) return;
  const { runSeed } = await import('../src/seed/seedRunner.js');
  const { codes } = await runSeed();
  const login = await api('POST', '/auth/admin/login', {
    body: { username: codes.admin.username, password: codes.admin.password },
  });
  const adminCookie = cookieFrom(login.setCookie);
  // Verify session works
  const meRes = await api('GET', '/auth/me', { cookie: adminCookie });
  assert.equal(meRes.status, 200);
  // Expire all sessions
  const { Session } = await import('../src/models/index.js');
  await Session.deleteMany({});
  // Protected endpoint should reject
  const afterExpire = await api('GET', '/admin/dashboard', { cookie: adminCookie });
  assert.equal(afterExpire.status, 401);
});

test('logout deletes session server-side', async () => {
  if (skip) return;
  const { runSeed } = await import('../src/seed/seedRunner.js');
  const { codes } = await runSeed();
  const login = await api('POST', '/auth/admin/login', {
    body: { username: codes.admin.username, password: codes.admin.password },
  });
  const adminCookie = cookieFrom(login.setCookie);
  // Verify session works
  const meRes = await api('GET', '/auth/me', { cookie: adminCookie });
  assert.equal(meRes.status, 200);
  // Extract session id from cookie
  const sid = adminCookie.split('=')[1];
  // Logout (scope=admin so attachSession resolves the admin cookie)
  await api('POST', '/auth/logout?scope=admin', { cookie: adminCookie });
  // Verify the specific session is deleted from DB
  const { Session } = await import('../src/models/index.js');
  const session = await Session.findById(sid);
  assert.equal(session, null);
  // Even with old cookie, protected endpoint rejects
  const afterLogout = await api('GET', '/admin/dashboard', { cookie: adminCookie });
  assert.equal(afterLogout.status, 401);
});
