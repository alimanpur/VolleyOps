/** Presentation helpers. Dates render in the tournament timezone (IST). */

const IST = 'Asia/Kolkata';

export function formatDate(value, opts = {}) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    ...opts,
  });
}

export function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', {
    timeZone: IST,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateRange(start, end) {
  if (!start) return '';
  const s = formatDate(start, { day: 'numeric', month: 'long' });
  const e = end ? formatDate(end, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return e && e !== s ? `${s} – ${e}` : s;
}

/** A slot's display name, honouring TBD with its explanation (never null). */
export function slotName(slot) {
  if (!slot) return 'TBD';
  if (slot.tbd) return slot.label || 'To be decided';
  return slot.name;
}

export function slotShort(slot) {
  if (!slot) return 'TBD';
  if (slot.tbd) return 'TBD';
  return slot.code || slot.name;
}

export const POINT_TYPE_LABELS = {
  ATTACK_KILL: 'Attack kill',
  BLOCK: 'Block',
  ACE: 'Ace',
  OPPONENT_ERROR: 'Opponent error',
  OTHER: 'Point',
};

export const STAGE_LABELS = {
  ROUND_1: 'Round 1',
  SEMIFINAL: 'Semifinal',
  FINAL: 'Final',
};
