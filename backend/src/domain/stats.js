/**
 * Pure player-statistics derivation from recorded rally events.
 *
 * Every number here traces back to an actual RallyEvent. Nothing is invented:
 * a player with no recorded events yields an all-zero line, and the UI labels
 * the whole set as "based on recorded rally events".
 *
 * Point types and their attribution (see domain/rally.js):
 *   ATTACK_KILL   -> attacker (kill for attacker)
 *   BLOCK         -> blocker  (block for blocker)
 *   ACE           -> server   (ace + service point for server)
 *   OPPONENT_ERROR-> optional losing-side player (error charged), point unowned
 *   OTHER         -> no attribution
 *
 * Service errors and attack errors can also be recorded on a rally the team
 * *lost*, via event.errorType, so efficiency has a denominator.
 */

export const POINT_TYPES = Object.freeze({
  ATTACK_KILL: 'ATTACK_KILL',
  BLOCK: 'BLOCK',
  ACE: 'ACE',
  OPPONENT_ERROR: 'OPPONENT_ERROR',
  OTHER: 'OTHER',
});

export const ERROR_TYPES = Object.freeze({
  ATTACK_ERROR: 'ATTACK_ERROR',
  SERVICE_ERROR: 'SERVICE_ERROR',
  RECEPTION_ERROR: 'RECEPTION_ERROR',
  OTHER_ERROR: 'OTHER_ERROR',
});

function emptyLine(playerId) {
  return {
    playerId: String(playerId),
    kills: 0,
    attackErrors: 0,
    attackAttempts: 0,
    blocks: 0,
    aces: 0,
    serviceErrors: 0,
    assists: 0,
    digs: 0,
    receptions: 0,
    receptionErrors: 0,
    pointsScored: 0,
  };
}

function line(map, playerId) {
  const key = String(playerId);
  if (!map.has(key)) map.set(key, emptyLine(key));
  return map.get(key);
}

/**
 * @param {object[]} events rally events with { pointType, playerId, errorType,
 *   errorPlayerId, assistPlayerId, digPlayerId, receptionPlayerId }
 * @returns {Map<string, line>} keyed by playerId
 */
export function derivePlayerStats(events) {
  const map = new Map();

  for (const e of events) {
    switch (e.pointType) {
      case POINT_TYPES.ATTACK_KILL:
        if (e.playerId) {
          const l = line(map, e.playerId);
          l.kills += 1;
          l.attackAttempts += 1;
          l.pointsScored += 1;
        }
        if (e.assistPlayerId) line(map, e.assistPlayerId).assists += 1;
        break;
      case POINT_TYPES.BLOCK:
        if (e.playerId) {
          const l = line(map, e.playerId);
          l.blocks += 1;
          l.pointsScored += 1;
        }
        break;
      case POINT_TYPES.ACE:
        if (e.playerId) {
          const l = line(map, e.playerId);
          l.aces += 1;
          l.pointsScored += 1;
        }
        break;
      case POINT_TYPES.OPPONENT_ERROR:
      case POINT_TYPES.OTHER:
      default:
        break;
    }

    // Errors can be charged on rallies the team lost (no point awarded to them).
    if (e.errorType && e.errorPlayerId) {
      const l = line(map, e.errorPlayerId);
      if (e.errorType === ERROR_TYPES.ATTACK_ERROR) {
        l.attackErrors += 1;
        l.attackAttempts += 1;
      } else if (e.errorType === ERROR_TYPES.SERVICE_ERROR) {
        l.serviceErrors += 1;
      } else if (e.errorType === ERROR_TYPES.RECEPTION_ERROR) {
        l.receptionErrors += 1;
        l.receptions += 1;
      }
    }

    if (e.digPlayerId) line(map, e.digPlayerId).digs += 1;
    if (e.receptionPlayerId) {
      const l = line(map, e.receptionPlayerId);
      l.receptions += 1;
    }
  }

  return map;
}

/** Attack efficiency = (kills - errors) / attempts, rounded, guarded for 0. */
export function attackEfficiency(l) {
  if (!l.attackAttempts) return 0;
  return Number(((l.kills - l.attackErrors) / l.attackAttempts).toFixed(3));
}

/** Convenience: derive and flatten to sorted array with efficiency computed. */
export function derivePlayerStatArray(events) {
  const map = derivePlayerStats(events);
  return [...map.values()].map((l) => ({ ...l, efficiency: attackEfficiency(l) }));
}
