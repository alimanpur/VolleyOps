/**
 * Match lifecycle state machine. Pure: given a state and a transition, decide
 * whether it is allowed. The service layer enforces these; no controller pokes
 * at match.state directly.
 */

import { MATCH_STATES, slotsResolved } from './bracket.js';

// Re-exported so the service layer can import lifecycle concerns from one place.
export { MATCH_STATES, slotsResolved };

/** Allowed transitions. Keys are current state, values are permitted next. */
const TRANSITIONS = {
  [MATCH_STATES.SCHEDULED]: [MATCH_STATES.PRE_MATCH, MATCH_STATES.CANCELLED],
  [MATCH_STATES.PRE_MATCH]: [MATCH_STATES.LIVE, MATCH_STATES.SCHEDULED, MATCH_STATES.CANCELLED],
  // LIVE can bounce to SET_COMPLETE between sets, MATCH_DECIDED when won.
  [MATCH_STATES.LIVE]: [MATCH_STATES.SET_COMPLETE, MATCH_STATES.MATCH_DECIDED, MATCH_STATES.CANCELLED],
  [MATCH_STATES.SET_COMPLETE]: [MATCH_STATES.LIVE, MATCH_STATES.MATCH_DECIDED],
  [MATCH_STATES.MATCH_DECIDED]: [MATCH_STATES.FINISHED],
  // FINISHED can be reopened (admin correction) back to LIVE, or locked.
  [MATCH_STATES.FINISHED]: [MATCH_STATES.LOCKED, MATCH_STATES.LIVE],
  [MATCH_STATES.LOCKED]: [MATCH_STATES.LIVE], // unlock for correction
  [MATCH_STATES.CANCELLED]: [MATCH_STATES.SCHEDULED],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    const err = new Error(`Illegal match transition ${from} -> ${to}`);
    err.code = 'ILLEGAL_TRANSITION';
    err.status = 409;
    return err;
  }
  return null;
}

/** A match accepts rally scoring only while actively being played. */
export function isScorable(state) {
  return state === MATCH_STATES.LIVE;
}

/** Terminal states that count toward standings / progression. */
export function isConcluded(state) {
  return state === MATCH_STATES.FINISHED || state === MATCH_STATES.LOCKED;
}
