/**
 * Pure tournament structure logic for the 5-team league format.
 *
 * LEAGUE STAGE: 5 matches, every team plays exactly twice.
 * No team plays itself, no duplicate pairs, 3rd Year CSE 1 vs 3rd Year CSE 2
 * does not meet in the league.
 *
 * After all league matches are completed, top 4 qualify for semifinals:
 *   SF1: #1 vs #2
 *   SF2: #3 vs #4
 * Final: Winner SF1 vs Winner SF2
 *
 * These functions operate on plain match-like objects and return the *patches*
 * to apply, so the service layer stays in control of persistence and ordering.
 */

export const STAGES = Object.freeze({
  LEAGUE: 'LEAGUE',
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
 */
export function reopenPatch(match, downstreamMatch) {
  if (!match.nextMatchId || !match.nextSlot) return null;
  const slot = match.nextSlot;
  const source = downstreamMatch.source?.[slot];
  if (!source || String(source.matchId) !== String(match._id ?? match.id)) {
    return null;
  }
  return { downstreamMatchId: downstreamMatch._id ?? downstreamMatch.id, slot, clear: true };
}

/**
 * Guard: is it safe to write `teamId` into `downstreamMatch[slot]`?
 */
export function canAdvanceInto(downstreamMatch, slot, teamId) {
  const key = slot === 'A' ? 'teamA' : 'teamB';
  const current = downstreamMatch[key];
  if (!current) return true;
  return String(current) === String(teamId);
}

/**
 * The canonical 5-match league fixture for the tournament.
 * Every team plays exactly twice. The order is fixed by competition rules
 * but can be reordered by Admin without changing the underlying rules.
 *
 * M01: 3RD_CSE_2 vs 1ST_CSE
 * M02: 1ST_AIML vs 3RD_CSE_1
 * M03: 2ND_YEAR vs 1ST_CSE
 * M04: 3RD_CSE_1 vs 2ND_YEAR
 * M05: 3RD_CSE_2 vs 1ST_AIML
 */
export function leagueBlueprint() {
  return {
    matches: [
      {
        code: 'M01',
        stage: STAGES.LEAGUE,
        label: 'League Match 1',
        order: 1,
        seeds: { A: '3RD_CSE_2', B: '1ST_CSE' },
      },
      {
        code: 'M02',
        stage: STAGES.LEAGUE,
        label: 'League Match 2',
        order: 2,
        seeds: { A: '1ST_AIML', B: '3RD_CSE_1' },
      },
      {
        code: 'M03',
        stage: STAGES.LEAGUE,
        label: 'League Match 3',
        order: 3,
        seeds: { A: '2ND_YEAR', B: '1ST_CSE' },
      },
      {
        code: 'M04',
        stage: STAGES.LEAGUE,
        label: 'League Match 4',
        order: 4,
        seeds: { A: '3RD_CSE_1', B: '2ND_YEAR' },
      },
      {
        code: 'M05',
        stage: STAGES.LEAGUE,
        label: 'League Match 5',
        order: 5,
        seeds: { A: '3RD_CSE_2', B: '1ST_AIML' },
      },
    ],
  };
}

/**
 * Verify that a set of league matches satisfies all constraints.
 * Throws if any constraint is violated.
 */
export function assertValidLeagueFixtures(matches) {
  if (matches.length !== 5) {
    throw new Error(`Expected 5 league matches, got ${matches.length}`);
  }

  const teamCounts = new Map();
  const pairs = new Set();

  for (const m of matches) {
    if (!m.teamA || !m.teamB) continue; // teams not yet wired, skip pair checks
    const a = String(m.teamA);
    const b = String(m.teamB);
    if (a === b) throw new Error(`Match ${m.code}: ${a} plays itself`);
    const pairKey = [a, b].sort().join('::');
    if (pairs.has(pairKey)) throw new Error(`Duplicate league pair: ${pairKey}`);
    pairs.add(pairKey);
    teamCounts.set(a, (teamCounts.get(a) || 0) + 1);
    teamCounts.set(b, (teamCounts.get(b) || 0) + 1);
  }

  if (teamCounts.size !== 5) throw new Error(`Expected 5 teams, found ${teamCounts.size}`);
  for (const [team, count] of teamCounts) {
    if (count !== 2) throw new Error(`Team ${team} appears ${count} times, expected 2`);
  }

  // Verify 3RD_CSE_1 and 3RD_CSE_2 do not play each other.
  for (const m of matches) {
    if (!m.teamA || !m.teamB) continue;
    const a = String(m.teamA);
    const b = String(m.teamB);
    if ((a === '3RD_CSE_1' && b === '3RD_CSE_2') || (a === '3RD_CSE_2' && b === '3RD_CSE_1')) {
      throw new Error('3rd Year CSE 1 and 3rd Year CSE 2 must not play in league stage');
    }
  }
}

/**
 * Build semifinal match definitions from qualified team IDs.
 * Returns an array of two match definitions (SF1 and SF2).
 *
 * SF1: standings[0] vs standings[1]  (#1 vs #2)
 * SF2: standings[2] vs standings[3]  (#3 vs #4)
 */
export function semifinalBlueprint(qualifiedTeams) {
  if (qualifiedTeams.length !== 4) {
    throw new Error(`Expected 4 qualified teams, got ${qualifiedTeams.length}`);
  }
  const [t1, t2, t3, t4] = qualifiedTeams;
  return [
    {
      code: 'SF1',
      stage: STAGES.SEMIFINAL,
      label: 'Semifinal 1',
      order: 1,
      seeds: { A: t1, B: t2 },
      sources: {
        A: { matchId: null, label: 'League 1st Place' },
        B: { matchId: null, label: 'League 2nd Place' },
      },
    },
    {
      code: 'SF2',
      stage: STAGES.SEMIFINAL,
      label: 'Semifinal 2',
      order: 2,
      seeds: { A: t3, B: t4 },
      sources: {
        A: { matchId: null, label: 'League 3rd Place' },
        B: { matchId: null, label: 'League 4th Place' },
      },
    },
  ];
}

/**
 * Build final match definition from semifinal winner team IDs.
 */
export function finalBlueprint(sf1Winner, sf2Winner) {
  return [
    {
      code: 'F1',
      stage: STAGES.FINAL,
      label: 'Final',
      order: 3,
      seeds: { A: sf1Winner, B: sf2Winner },
      sources: {
        A: { matchId: null, label: 'Winner Semifinal 1' },
        B: { matchId: null, label: 'Winner Semifinal 2' },
      },
    },
  ];
}
