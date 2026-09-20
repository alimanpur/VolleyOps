/**
 * Pure roster + eligibility rules.
 *
 * Each team fields 6 active players and 1 standby. Exactly one active player is
 * the captain. Every team is tied to an academic year and players must match it.
 */

export const ROSTER = Object.freeze({
  ACTIVE_REQUIRED: 6,
  STANDBY_REQUIRED: 1,
});

export const PLAYER_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  STANDBY: 'STANDBY',
});

/** Academic year eligibility per team, keyed by stable team code. */
export const TEAM_YEAR = Object.freeze({
  '1ST_CSE': 1,
  '1ST_AIML': 1,
  '2ND_YEAR': 2,
  '3RD_CSE_1': 3,
  '3RD_CSE_2': 3,
});

/**
 * Validate a roster. Returns a structured completeness report rather than
 * throwing, so both the API and the admin UI can show the same truth.
 *
 * @param {object} team    { year }
 * @param {object[]} players  [{ status, year, isCaptain }]
 */
export function evaluateRoster(team, players) {
  const active = players.filter((p) => p.status === PLAYER_STATUS.ACTIVE);
  const standby = players.filter((p) => p.status === PLAYER_STATUS.STANDBY);
  const captains = active.filter((p) => p.isCaptain);
  const ineligible = players.filter((p) => team.year != null && p.year != null && p.year !== team.year);

  const issues = [];
  if (active.length !== ROSTER.ACTIVE_REQUIRED) {
    issues.push({
      code: 'ACTIVE_COUNT',
      message: `${active.length}/${ROSTER.ACTIVE_REQUIRED} active players`,
    });
  }
  if (standby.length !== ROSTER.STANDBY_REQUIRED) {
    issues.push({
      code: 'STANDBY_COUNT',
      message: `${standby.length}/${ROSTER.STANDBY_REQUIRED} standby player`,
    });
  }
  if (captains.length === 0) {
    issues.push({ code: 'NO_CAPTAIN', message: 'No captain assigned' });
  } else if (captains.length > 1) {
    issues.push({ code: 'MULTIPLE_CAPTAINS', message: 'More than one captain' });
  }
  if (ineligible.length > 0) {
    issues.push({
      code: 'YEAR_INELIGIBLE',
      message: `${ineligible.length} player(s) do not match team year ${team.year}`,
      playerIds: ineligible.map((p) => String(p._id ?? p.id)),
    });
  }

  return {
    complete: issues.length === 0,
    activeCount: active.length,
    standbyCount: standby.length,
    activeRequired: ROSTER.ACTIVE_REQUIRED,
    standbyRequired: ROSTER.STANDBY_REQUIRED,
    hasCaptain: captains.length === 1,
    issues,
  };
}

/** Whether a single player is eligible for a team, by academic year. */
export function isPlayerEligible(team, player) {
  if (team.year == null || player.year == null) return true;
  return team.year === player.year;
}
