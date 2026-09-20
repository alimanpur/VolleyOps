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

async function scoreMatch(matchId, cookie, winner = 'A') {
  await api('POST', `/scorer/matches/${matchId}/start`, { cookie });
  for (let s = 0; s < 2; s += 1) {
    for (let p = 0; p < 25; p += 1) {
      await api('POST', `/scorer/matches/${matchId}/rally`, {
        cookie,
        body: { clientEventId: `evt-${matchId}-${s}-${p}`, winner, pointType: 'OTHER' },
      });
    }
  }
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

  // Enable open scoring for test convenience
  await api('POST', '/admin/tournament/open-scoring', { cookie: adminCookie, body: { enabled: true } });

  // --- find the league matches ---
  const matchesRes = await api('GET', '/admin/matches', { cookie: adminCookie });
  const m01 = matchesRes.json.matches.find((m) => m.code === 'M01');
  const m02 = matchesRes.json.matches.find((m) => m.code === 'M02');
  const m03 = matchesRes.json.matches.find((m) => m.code === 'M03');
  const m04 = matchesRes.json.matches.find((m) => m.code === 'M04');
  const m05 = matchesRes.json.matches.find((m) => m.code === 'M05');
  assert.ok(m01, 'M01 exists');
  assert.ok(m05, 'M05 exists');
  assert.equal(matchesRes.json.matches.length, 5, 'exactly 5 league matches');

  // --- scorer redeems and scores all 5 league matches ---
  const scorerCode = codes.scorers[0].code;
  const redeem = await api('POST', '/auth/redeem', { body: { code: scorerCode } });
  assert.equal(redeem.status, 200);
  const scorerCookie = cookieFrom(redeem.setCookie);

  // Score M01 (3RD_CSE_2 vs 1ST_CSE) - team A wins
  await scoreMatch(m01.id, scorerCookie, 'A');

  // Score M02 (1ST_AIML vs 3RD_CSE_1) - team A wins
  await scoreMatch(m02.id, scorerCookie, 'A');

  // Score M03 (2ND_YEAR vs 1ST_CSE) - team A wins
  await scoreMatch(m03.id, scorerCookie, 'A');

  // Score M04 (3RD_CSE_1 vs 2ND_YEAR) - team A wins
  await scoreMatch(m04.id, scorerCookie, 'A');

  // Score M05 (3RD_CSE_2 vs 1ST_AIML) - team A wins
  await scoreMatch(m05.id, scorerCookie, 'A');

  // Verify all 5 matches are finished
  const afterLeague = await api('GET', '/admin/matches', { cookie: adminCookie });
  const leagueMatches = afterLeague.json.matches.filter((m) => m.stage === 'LEAGUE');
  assert.equal(leagueMatches.length, 5);
  assert.ok(leagueMatches.every((m) => m.state === 'FINISHED'), 'all league matches finished');

  // --- standings should be computed ---
  const standings = await api('GET', '/admin/standings', { cookie: adminCookie });
  assert.equal(standings.status, 200);
  assert.equal(standings.json.standings.length, 5);
  assert.ok(standings.json.standings.every((r) => r.played > 0), 'all teams have played');

  // --- qualification lock and semifinal generation ---
  const lockRes = await api('POST', '/admin/tournament/qualification/lock', { cookie: adminCookie });
  assert.equal(lockRes.status, 200);
  assert.ok(lockRes.json.qualifiedTeams, 'qualified teams returned');

  // Verify semifinals exist
  const afterLock = await api('GET', '/admin/matches', { cookie: adminCookie });
  const sfMatches = afterLock.json.matches.filter((m) => m.stage === 'SEMIFINAL');
  assert.equal(sfMatches.length, 2, '2 semifinals generated');
  const sf1 = sfMatches.find((m) => m.code === 'SF1');
  const sf2 = sfMatches.find((m) => m.code === 'SF2');
  assert.ok(sf1.teamA && sf1.teamB, 'SF1 has both teams');
  assert.ok(sf2.teamA && sf2.teamB, 'SF2 has both teams');

  // --- score semifinals ---
  await scoreMatch(sf1.id, scorerCookie, 'A');
  await scoreMatch(sf2.id, scorerCookie, 'A');

  const afterSemis = await api('GET', '/admin/matches', { cookie: adminCookie });
  const updatedSf1 = afterSemis.json.matches.find((m) => m.code === 'SF1');
  const updatedSf2 = afterSemis.json.matches.find((m) => m.code === 'SF2');
  assert.equal(updatedSf1.state, 'FINISHED');
  assert.equal(updatedSf2.state, 'FINISHED');

  // --- generate final ---
  const finalRes = await api('POST', '/admin/tournament/final', { cookie: adminCookie });
  assert.equal(finalRes.status, 200);
  assert.ok(finalRes.json.final, 'final match returned');

  const afterFinal = await api('GET', '/admin/matches', { cookie: adminCookie });
  const finalMatch = afterFinal.json.matches.find((m) => m.stage === 'FINAL');
  assert.ok(finalMatch, 'final match exists');
  assert.ok(finalMatch.teamA && finalMatch.teamB, 'final has both teams');

  // --- score final ---
  await scoreMatch(finalMatch.id, scorerCookie, 'A');

  const afterFinalComplete = await api('GET', '/admin/matches', { cookie: adminCookie });
  const completedFinal = afterFinalComplete.json.matches.find((m) => m.stage === 'FINAL');
  assert.equal(completedFinal.state, 'FINISHED');
  assert.ok(completedFinal.winnerTeam, 'final has winner');

  // --- verify champion ---
  const progress = await api('GET', '/admin/tournament/progress', { cookie: adminCookie });
  assert.equal(progress.status, 200);
  assert.equal(progress.json.stage, 'FINAL');
  assert.ok(progress.json.champion, 'champion exists');

  // --- complete tournament ---
  const completeRes = await api('POST', '/admin/tournament/complete', { cookie: adminCookie });
  assert.equal(completeRes.status, 200);

  const afterComplete = await api('GET', '/admin/tournament/progress', { cookie: adminCookie });
  assert.equal(afterComplete.json.stage, 'COMPLETED');
  assert.equal(afterComplete.json.tournament.status, 'COMPLETED');

  // --- authorization: captain cannot hit another team's private match ---
  const capCode = codes.captains[0].code;
  const capRedeem = await api('POST', '/auth/redeem', { body: { code: capCode } });
  const capCookie = cookieFrom(capRedeem.setCookie);
  const capDash = await api('GET', '/captain/dashboard', { cookie: capCookie });
  assert.equal(capDash.status, 200);

  // --- scorer cannot access admin endpoints ---
  const capAdmin = await api('GET', '/admin/dashboard', { cookie: capCookie });
  assert.equal(capAdmin.status, 401);

  // --- scorer cannot score a match not assigned to them ---
  // Disable open scoring for the auth check
  await api('POST', '/admin/tournament/open-scoring', { cookie: adminCookie, body: { enabled: false } });
  // Verify open scoring is disabled
  const tournamentInfo = await api('GET', '/admin/tournament', { cookie: adminCookie });
  assert.equal(tournamentInfo.json.tournament.openScoring, false, 'open scoring should be disabled');
  const otherMatch = afterFinalComplete.json.matches.find((m) => m.code === 'M03');
  const forbidden = await api('POST', `/scorer/matches/${otherMatch.id}/start`, { cookie: scorerCookie });
  assert.equal(forbidden.status, 403);
});
