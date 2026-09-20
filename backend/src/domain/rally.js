/**
 * Rally attribution rules. Given a point type and the raw attribution a scorer
 * provided, normalise it into the fields RallyEvent stores, and decide whether
 * the attribution is well-formed.
 *
 * Rules (see spec §9):
 *   ATTACK_KILL   -> attacker (playerId) required-ish; assist optional
 *   BLOCK         -> blocker  (playerId)
 *   ACE           -> server   (playerId), prefilled where possible
 *   OPPONENT_ERROR-> error charged to a losing-side player (errorPlayerId) +
 *                    errorType; the scoring team gets the point with no scorer
 *   OTHER         -> no forced attribution
 *
 * Attribution is never *forced*: a scorer can always record an unattributed
 * point (playerId null). We validate shape, not completeness, so scoring stays
 * fast during a live match.
 */

import { POINT_TYPES, ERROR_TYPES } from './stats.js';

export { POINT_TYPES, ERROR_TYPES };

export const POINT_TYPE_LIST = Object.values(POINT_TYPES);

/**
 * Normalise a scorer-provided attribution payload for a won rally.
 * `winner` is 'A'|'B' (the team awarded the point).
 * Returns the event fields, stripping attribution that doesn't apply to the type.
 */
export function normalizeAttribution({ pointType, winner, playerId, assistPlayerId, errorType, errorPlayerId, digPlayerId, receptionPlayerId, note }) {
  if (!POINT_TYPE_LIST.includes(pointType)) {
    const err = new Error(`Unknown point type "${pointType}"`);
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  const base = {
    pointType,
    winner,
    playerId: null,
    assistPlayerId: null,
    errorType: null,
    errorPlayerId: null,
    digPlayerId: digPlayerId || null,
    receptionPlayerId: receptionPlayerId || null,
    note: note || null,
  };

  switch (pointType) {
    case POINT_TYPES.ATTACK_KILL:
      base.playerId = playerId || null; // attacker
      base.assistPlayerId = assistPlayerId || null; // setter
      break;
    case POINT_TYPES.BLOCK:
      base.playerId = playerId || null; // blocker
      break;
    case POINT_TYPES.ACE:
      base.playerId = playerId || null; // server
      break;
    case POINT_TYPES.OPPONENT_ERROR:
      // Point goes to `winner`; the error belongs to the *other* team's player.
      base.errorType = ERROR_TYPES[errorType] ? errorType : ERROR_TYPES.OTHER_ERROR;
      base.errorPlayerId = errorPlayerId || null;
      break;
    case POINT_TYPES.OTHER:
    default:
      break;
  }
  return base;
}
