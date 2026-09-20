/**
 * Pure volleyball scoring rules. No database, no side effects.
 *
 * The server is authoritative for set/match completion, so these helpers are
 * the single place where "is this set over?" and "is this match over?" are
 * decided. Everything else (controllers, the scorer UI) defers to this.
 *
 * Tournament defaults: best-of-3, normal set to 25, deciding set to 15,
 * win-by-2 with no cap.
 */

export const DEFAULT_RULES = Object.freeze({
  bestOf: 3,
  pointsPerSet: 25,
  pointsFinalSet: 15,
  winBy: 2,
});

/** Sets a team must win to take the match (2 for best-of-3, 3 for best-of-5). */
export function setsToWin(rules = DEFAULT_RULES) {
  return Math.floor(rules.bestOf / 2) + 1;
}

/** The set currently being played is the deciding set when both teams are one win away. */
export function isDecidingSet(setNumber, rules = DEFAULT_RULES) {
  return setNumber === rules.bestOf;
}

/** Target points for a given set number (deciding set has a lower target). */
export function targetForSet(setNumber, rules = DEFAULT_RULES) {
  return isDecidingSet(setNumber, rules) ? rules.pointsFinalSet : rules.pointsPerSet;
}

/**
 * Decide whether a set with the given running score is complete.
 * Returns { complete, winner: 'A'|'B'|null }.
 */
export function evaluateSet({ a, b, setNumber }, rules = DEFAULT_RULES) {
  const target = targetForSet(setNumber, rules);
  const leader = a >= b ? 'A' : 'B';
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  const complete = high >= target && high - low >= rules.winBy;
  return { complete, winner: complete ? leader : null, target };
}

/**
 * Given the list of completed sets (each { winner: 'A'|'B' }), decide whether
 * the match is over and who won.
 */
export function evaluateMatch(completedSets, rules = DEFAULT_RULES) {
  const need = setsToWin(rules);
  let aWins = 0;
  let bWins = 0;
  for (const set of completedSets) {
    if (set.winner === 'A') aWins += 1;
    else if (set.winner === 'B') bWins += 1;
  }
  const decided = aWins >= need || bWins >= need;
  return {
    decided,
    winner: decided ? (aWins > bWins ? 'A' : 'B') : null,
    setsWon: { A: aWins, B: bWins },
  };
}

/**
 * Apply a single awarded point to the in-progress set and return the resulting
 * state. `side` is 'A' or 'B'. This never mutates its input.
 *
 * Serving rule: the team that wins the rally serves next (side-out scoring).
 */
export function applyPoint(current, side, setNumber, rules = DEFAULT_RULES) {
  if (side !== 'A' && side !== 'B') {
    throw new Error(`applyPoint: invalid side "${side}"`);
  }
  const next = {
    a: current.a + (side === 'A' ? 1 : 0),
    b: current.b + (side === 'B' ? 1 : 0),
    serving: side,
  };
  const setResult = evaluateSet({ a: next.a, b: next.b, setNumber }, rules);
  return { score: next, set: setResult };
}

/**
 * Replay an ordered list of rally winners into full match state. This is the
 * authoritative reconstruction used by the match service — kept pure so the
 * whole scoring progression (points -> set completion -> match completion) is
 * unit-testable without a database.
 *
 * @param {Array<{winner:'A'|'B'}>} events ordered, non-voided rally events
 * @returns {{ sets, serving, decided, matchWinner }}
 *   sets: [{ setNumber, a, b, winner, complete }] including the in-progress set
 */
export function replayRallies(events, rules = DEFAULT_RULES) {
  const sets = [];
  let cur = { setNumber: 1, a: 0, b: 0, winner: null, complete: false };
  let serving = null;
  let decided = false;
  let matchWinner = null;
  const completed = [];

  for (const e of events) {
    if (decided) break;
    if (e.winner === 'A') cur.a += 1;
    else if (e.winner === 'B') cur.b += 1;
    else continue;
    serving = e.winner;

    const res = evaluateSet({ a: cur.a, b: cur.b, setNumber: cur.setNumber }, rules);
    if (res.complete) {
      cur.complete = true;
      cur.winner = res.winner;
      sets.push({ ...cur });
      completed.push({ winner: res.winner });
      const matchRes = evaluateMatch(completed, rules);
      if (matchRes.decided) {
        decided = true;
        matchWinner = matchRes.winner;
      } else {
        cur = { setNumber: cur.setNumber + 1, a: 0, b: 0, winner: null, complete: false };
        serving = null;
      }
    }
  }
  if (!decided && !cur.complete) sets.push({ ...cur });

  return { sets, serving, decided, matchWinner };
}
