/**
 * Pure bracket-progression logic for a single-elimination tournament.
 *
 * A match knows where its winner goes via { nextMatchId, nextSlot } where
 * nextSlot is 'A' or 'B'. A downstream match records which upstream match feeds
 * each of its slots via source = { A: { matchId }, B: { matchId } }. That lets
 * us both advance a winner forward and, on reopen, reverse it safely.
 *
 * BYEs are modelled honestly: a team seeded straight into a later match simply
 * occupies that match's slot from the start (source[slot] is null, teamId is
 * set). No placeholder "bye match" is ever created.
 *
 * These functions operate on plain match-like objects and return the *patches*
 * to apply, so the service layer stays in control of persistence and ordering.
 */

export const STAGES = Object.freeze({
  ROUND_1: 'ROUND_1',
  SEMIFINAL: 'SEMIFINAL',
  FINAL: 'FINAL',
});

export const MATCH_STATES = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  PRE_MATCH: 'PRE_MATCH',
  LIVE: 'LIVE',
  SET_COMPLETE: 'SET_COMPLETE',
  MATCH_DECIDED: 'MATCH_DECIDED',
  FINISHED: 'FINISHED',
  LOCKED: 'LOCKED',
  CANCELLED: 'CANCELLED',
});

/** A match can be scored only once both team slots hold a resolved team. */
export function slotsResolved(match) {
  return Boolean(match.teamA && match.teamB);
}

/**
 * Compute the patch to apply to the downstream match when `match` finishes with
 * `winnerTeamId`. Returns null when the match feeds nowhere (e.g. the final).
 *
 * The patch sets the winning team into the recorded slot. Callers should refuse
 * to advance if that downstream slot is already occupied by a *different* team
 * that did not originate from this match (guards against double-advance).
 */
export function advancePatch(match, winnerTeamId) {
  if (!match.nextMatchId || !match.nextSlot) return null;
  return {
    downstreamMatchId: match.nextMatchId,
    slot: match.nextSlot,
    teamId: winnerTeamId,
  };
}

/**
 * Compute the patch to *reverse* an advancement when `match` is reopened.
 * Clears the downstream slot only if it is currently populated by the team that
 * came from this match — never touches a slot resolved by another source or a
 * BYE seed.
 */
export function reopenPatch(match, downstreamMatch) {
  if (!match.nextMatchId || !match.nextSlot) return null;
  const slot = match.nextSlot;
  const source = downstreamMatch.source?.[slot];
  // Only clear if this downstream slot is fed by this exact match.
  if (!source || String(source.matchId) !== String(match._id ?? match.id)) {
    return null;
  }
  return { downstreamMatchId: downstreamMatch._id ?? downstreamMatch.id, slot, clear: true };
}

/**
 * Guard: is it safe to write `teamId` into `downstreamMatch[slot]`?
 * Safe when the slot is empty, or already holds this exact team (idempotent
 * re-advance). Unsafe when a different team occupies it — signals stale state
 * that must be reopened first.
 */
export function canAdvanceInto(downstreamMatch, slot, teamId) {
  const key = slot === 'A' ? 'teamA' : 'teamB';
  const current = downstreamMatch[key];
  if (!current) return true;
  return String(current) === String(teamId);
}

/**
 * The canonical VolleyOps bracket definition for the IPS Academy tournament.
 * Codes are stable, human-readable identifiers used to wire matches together
 * during seeding/setup. `seeds` places teams (by team code) directly into slots;
 * `feeds` wires a winner into a downstream slot.
 *
 * Layout:
 *   M01 Round 1: 1st Year CSE vs 1st Year AIML  -> winner to SF1 (M02) slot B
 *   M02 Semifinal 1: 3rd Year CSE 1 (seed A) vs winner M01 (slot B)
 *   M03 Semifinal 2: 3rd Year CSE 2 (seed A) vs 2nd Year (seed B)
 *   M04 Final: winner M02 (slot A) vs winner M03 (slot B)
 *
 * 3rd Year CSE 1, 3rd Year CSE 2 and 2nd Year receive effective BYEs by being
 * seeded straight into the semifinals — no fake first-round matches.
 */
export function bracketBlueprint() {
  return {
    matches: [
      {
        code: 'M01',
        stage: STAGES.ROUND_1,
        label: 'Round 1',
        order: 1,
        seeds: { A: '1ST_CSE', B: '1ST_AIML' },
        feeds: { winnerTo: { matchCode: 'M02', slot: 'B' } },
      },
      {
        code: 'M02',
        stage: STAGES.SEMIFINAL,
        label: 'Semifinal 1',
        order: 2,
        seeds: { A: '3RD_CSE_1' }, // BYE straight into SF1
        sources: { B: { matchCode: 'M01', label: 'Winner of Round 1' } },
        feeds: { winnerTo: { matchCode: 'M04', slot: 'A' } },
      },
      {
        code: 'M03',
        stage: STAGES.SEMIFINAL,
        label: 'Semifinal 2',
        order: 3,
        seeds: { A: '3RD_CSE_2', B: '2ND_YEAR' }, // both BYE into SF2
        feeds: { winnerTo: { matchCode: 'M04', slot: 'B' } },
      },
      {
        code: 'M04',
        stage: STAGES.FINAL,
        label: 'Final',
        order: 4,
        sources: {
          A: { matchCode: 'M02', label: 'Winner of Semifinal 1' },
          B: { matchCode: 'M03', label: 'Winner of Semifinal 2' },
        },
      },
    ],
  };
}
