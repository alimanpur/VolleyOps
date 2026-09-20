import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_RULES, setsToWin, isDecidingSet, targetForSet,
  evaluateSet, evaluateMatch, applyPoint, replayRallies,
} from '../src/domain/scoring.js';
import {
  slotsResolved, advancePatch, reopenPatch, canAdvanceInto, bracketBlueprint, STAGES,
} from '../src/domain/bracket.js';
import { computeStandings } from '../src/domain/standings.js';
import { derivePlayerStatArray, POINT_TYPES, ERROR_TYPES } from '../src/domain/stats.js';
import { evaluateRoster, isPlayerEligible, PLAYER_STATUS } from '../src/domain/roster.js';
import { canTransition, assertTransition, isScorable, MATCH_STATES } from '../src/domain/lifecycle.js';
import { normalizeAttribution } from '../src/domain/rally.js';

// ---------- scoring ----------
test('setsToWin / targets', () => {
  assert.equal(setsToWin(DEFAULT_RULES), 2);
  assert.equal(targetForSet(1), 25);
  assert.equal(targetForSet(3), 15);
  assert.ok(isDecidingSet(3));
  assert.ok(!isDecidingSet(2));
});

test('set not complete below target', () => {
  assert.deepEqual(evaluateSet({ a: 24, b: 20, setNumber: 1 }).complete, false);
});

test('set complete at 25 with 2-point margin', () => {
  const r = evaluateSet({ a: 25, b: 20, setNumber: 1 });
  assert.equal(r.complete, true);
  assert.equal(r.winner, 'A');
});

test('win-by-2 forces deuce past target, no cap', () => {
  assert.equal(evaluateSet({ a: 25, b: 24, setNumber: 1 }).complete, false);
  assert.equal(evaluateSet({ a: 26, b: 24, setNumber: 1 }).complete, true);
  assert.equal(evaluateSet({ a: 30, b: 29, setNumber: 1 }).complete, false);
  assert.equal(evaluateSet({ a: 31, b: 29, setNumber: 1 }).complete, true);
});

test('deciding set targets 15', () => {
  assert.equal(evaluateSet({ a: 15, b: 10, setNumber: 3 }).complete, true);
  assert.equal(evaluateSet({ a: 14, b: 10, setNumber: 3 }).complete, false);
});

test('applyPoint increments and sets serve to rally winner', () => {
  const r = applyPoint({ a: 5, b: 5, serving: 'A' }, 'B', 1);
  assert.deepEqual(r.score, { a: 5, b: 6, serving: 'B' });
});

test('applyPoint rejects bad side', () => {
  assert.throws(() => applyPoint({ a: 0, b: 0 }, 'C', 1));
});

test('evaluateMatch best-of-3', () => {
  assert.equal(evaluateMatch([{ winner: 'A' }]).decided, false);
  const done = evaluateMatch([{ winner: 'A' }, { winner: 'B' }, { winner: 'A' }]);
  assert.equal(done.decided, true);
  assert.equal(done.winner, 'A');
  assert.deepEqual(done.setsWon, { A: 2, B: 1 });
});

function rallies(seq) {
  // "AAB" -> [{winner:'A'},{winner:'A'},{winner:'B'}]
  return [...seq].map((c) => ({ winner: c }));
}

test('replayRallies: in-progress single set', () => {
  const r = replayRallies(rallies('AABBA'));
  assert.equal(r.decided, false);
  const live = r.sets[r.sets.length - 1];
  assert.deepEqual([live.a, live.b], [3, 2]);
  assert.equal(r.serving, 'A');
});

test('replayRallies: completes a set at 25 and starts the next', () => {
  const seq = 'A'.repeat(25) + 'B'; // A wins set 1 25-0, then B scores set 2
  const r = replayRallies(rallies(seq));
  assert.equal(r.sets[0].complete, true);
  assert.equal(r.sets[0].winner, 'A');
  assert.equal(r.sets[1].setNumber, 2);
  assert.deepEqual([r.sets[1].a, r.sets[1].b], [0, 1]);
  assert.equal(r.decided, false);
});

test('replayRallies: decides match 2-0 and ignores trailing rallies', () => {
  const seq = 'A'.repeat(25) + 'A'.repeat(25) + 'B'.repeat(10); // A takes 2 straight
  const r = replayRallies(rallies(seq));
  assert.equal(r.decided, true);
  assert.equal(r.matchWinner, 'A');
  assert.equal(r.sets.length, 2); // trailing B rallies after match point ignored
});

test('replayRallies: deciding third set to 15', () => {
  // A wins set1 (25), B wins set2 (25), then A wins deciding set 15-0
  const seq = 'A'.repeat(25) + 'B'.repeat(25) + 'A'.repeat(15);
  const r = replayRallies(rallies(seq));
  assert.equal(r.decided, true);
  assert.equal(r.matchWinner, 'A');
  assert.equal(r.sets.length, 3);
  assert.equal(r.sets[2].a, 15);
});

// ---------- bracket ----------
test('slotsResolved needs both teams', () => {
  assert.equal(slotsResolved({ teamA: 'x', teamB: null }), false);
  assert.equal(slotsResolved({ teamA: 'x', teamB: 'y' }), true);
});

test('advancePatch routes winner downstream', () => {
  const p = advancePatch({ nextMatchId: 'M02', nextSlot: 'B' }, 'teamWin');
  assert.deepEqual(p, { downstreamMatchId: 'M02', slot: 'B', teamId: 'teamWin' });
  assert.equal(advancePatch({ nextMatchId: null }, 'x'), null);
});

test('canAdvanceInto blocks a different team, allows same/empty', () => {
  assert.equal(canAdvanceInto({ teamB: null }, 'B', 't1'), true);
  assert.equal(canAdvanceInto({ teamB: 't1' }, 'B', 't1'), true);
  assert.equal(canAdvanceInto({ teamB: 't2' }, 'B', 't1'), false);
});

test('reopenPatch clears only slot fed by this match', () => {
  const match = { _id: 'M01', nextMatchId: 'M02', nextSlot: 'B' };
  const downOk = { _id: 'M02', source: { B: { matchId: 'M01' } } };
  assert.deepEqual(reopenPatch(match, downOk), { downstreamMatchId: 'M02', slot: 'B', clear: true });
  const downOther = { _id: 'M02', source: { B: { matchId: 'MXX' } } };
  assert.equal(reopenPatch(match, downOther), null); // don't clobber unrelated seed
});

test('bracket blueprint matches the IPS layout with honest BYEs', () => {
  const bp = bracketBlueprint();
  const byCode = Object.fromEntries(bp.matches.map((m) => [m.code, m]));
  assert.equal(bp.matches.length, 4); // no fake bye matches
  assert.equal(byCode.M01.stage, STAGES.ROUND_1);
  assert.deepEqual(byCode.M01.seeds, { A: '1ST_CSE', B: '1ST_AIML' });
  assert.equal(byCode.M01.feeds.winnerTo.matchCode, 'M02');
  // 3rd Year CSE 1 byes straight into SF1 slot A
  assert.equal(byCode.M02.seeds.A, '3RD_CSE_1');
  assert.equal(byCode.M02.sources.B.matchCode, 'M01');
  // SF2 has both teams seeded (byes), final fed by both semis
  assert.deepEqual(byCode.M03.seeds, { A: '3RD_CSE_2', B: '2ND_YEAR' });
  assert.equal(byCode.M04.sources.A.matchCode, 'M02');
  assert.equal(byCode.M04.sources.B.matchCode, 'M03');
});

// ---------- standings ----------
test('standings: win=2, tiebreak by set then point ratio', () => {
  const teams = ['t1', 't2', 't3'];
  const matches = [
    { teamA: 't1', teamB: 't2', winner: 'A', setScores: [{ a: 25, b: 20 }, { a: 25, b: 22 }] },
    { teamA: 't3', teamB: 't2', winner: 'A', setScores: [{ a: 25, b: 10 }, { a: 25, b: 10 }] },
  ];
  const s = computeStandings(teams, matches);
  assert.equal(s[0].points, 2);
  // t1 and t3 both 1 win / 2 pts; t3 has better set+point ratio -> ranks first
  assert.equal(s[0].teamId, 't3');
  assert.equal(s[1].teamId, 't1');
  assert.equal(s[2].teamId, 't2');
  assert.equal(s[2].wins, 0);
  assert.equal(s[2].points, 0);
});

test('standings: teams with no matches show zero rows, not omitted', () => {
  const s = computeStandings(['a', 'b'], []);
  assert.equal(s.length, 2);
  assert.equal(s[0].played, 0);
});

// ---------- stats ----------
test('stats derive only from events', () => {
  const events = [
    { pointType: POINT_TYPES.ATTACK_KILL, playerId: 'p1', assistPlayerId: 'p2' },
    { pointType: POINT_TYPES.ATTACK_KILL, playerId: 'p1' },
    { pointType: POINT_TYPES.ACE, playerId: 'p3' },
    { pointType: POINT_TYPES.BLOCK, playerId: 'p2' },
    { pointType: POINT_TYPES.OPPONENT_ERROR, errorType: ERROR_TYPES.ATTACK_ERROR, errorPlayerId: 'p1' },
    { pointType: POINT_TYPES.OTHER },
  ];
  const arr = derivePlayerStatArray(events);
  const p1 = arr.find((x) => x.playerId === 'p1');
  assert.equal(p1.kills, 2);
  assert.equal(p1.attackErrors, 1);
  assert.equal(p1.attackAttempts, 3);
  assert.equal(p1.efficiency, Number(((2 - 1) / 3).toFixed(3)));
  assert.equal(arr.find((x) => x.playerId === 'p2').assists, 1);
  assert.equal(arr.find((x) => x.playerId === 'p2').blocks, 1);
  assert.equal(arr.find((x) => x.playerId === 'p3').aces, 1);
});

test('stats empty for no events', () => {
  assert.deepEqual(derivePlayerStatArray([]), []);
});

// ---------- roster ----------
test('roster complete at 6 active + 1 standby + 1 captain, eligible', () => {
  const team = { year: 1 };
  const players = [
    ...Array.from({ length: 6 }, (_, i) => ({ status: PLAYER_STATUS.ACTIVE, year: 1, isCaptain: i === 0 })),
    { status: PLAYER_STATUS.STANDBY, year: 1, isCaptain: false },
  ];
  const r = evaluateRoster(team, players);
  assert.equal(r.complete, true);
  assert.equal(r.activeCount, 6);
  assert.equal(r.standbyCount, 1);
  assert.equal(r.hasCaptain, true);
});

test('roster flags shortfalls and year ineligibility', () => {
  const team = { year: 2 };
  const players = [
    { status: PLAYER_STATUS.ACTIVE, year: 2, isCaptain: false },
    { status: PLAYER_STATUS.ACTIVE, year: 3, isCaptain: false, _id: 'bad' },
  ];
  const r = evaluateRoster(team, players);
  assert.equal(r.complete, false);
  const codes = r.issues.map((i) => i.code);
  assert.ok(codes.includes('ACTIVE_COUNT'));
  assert.ok(codes.includes('STANDBY_COUNT'));
  assert.ok(codes.includes('NO_CAPTAIN'));
  assert.ok(codes.includes('YEAR_INELIGIBLE'));
});

test('player eligibility by year', () => {
  assert.equal(isPlayerEligible({ year: 1 }, { year: 1 }), true);
  assert.equal(isPlayerEligible({ year: 1 }, { year: 2 }), false);
});

// ---------- lifecycle ----------
test('lifecycle transitions', () => {
  assert.ok(canTransition(MATCH_STATES.SCHEDULED, MATCH_STATES.PRE_MATCH));
  assert.ok(canTransition(MATCH_STATES.PRE_MATCH, MATCH_STATES.LIVE));
  assert.ok(canTransition(MATCH_STATES.FINISHED, MATCH_STATES.LIVE)); // reopen
  assert.ok(!canTransition(MATCH_STATES.SCHEDULED, MATCH_STATES.LIVE)); // must go through pre-match
  assert.equal(assertTransition(MATCH_STATES.SCHEDULED, MATCH_STATES.PRE_MATCH), null);
  assert.ok(assertTransition(MATCH_STATES.SCHEDULED, MATCH_STATES.FINISHED));
  assert.ok(isScorable(MATCH_STATES.LIVE));
  assert.ok(!isScorable(MATCH_STATES.PRE_MATCH));
});

// ---------- rally ----------
test('normalizeAttribution strips fields per type', () => {
  const kill = normalizeAttribution({ pointType: 'ATTACK_KILL', winner: 'A', playerId: 'p1', assistPlayerId: 'p2', errorPlayerId: 'ignored' });
  assert.equal(kill.playerId, 'p1');
  assert.equal(kill.assistPlayerId, 'p2');
  assert.equal(kill.errorPlayerId, null);

  const oppErr = normalizeAttribution({ pointType: 'OPPONENT_ERROR', winner: 'B', errorType: 'SERVICE_ERROR', errorPlayerId: 'p9', playerId: 'ignored' });
  assert.equal(oppErr.playerId, null);
  assert.equal(oppErr.errorType, 'SERVICE_ERROR');
  assert.equal(oppErr.errorPlayerId, 'p9');

  const other = normalizeAttribution({ pointType: 'OTHER', winner: 'A' });
  assert.equal(other.playerId, null);

  assert.throws(() => normalizeAttribution({ pointType: 'NOPE', winner: 'A' }));
});
