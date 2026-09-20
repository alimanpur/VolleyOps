import { Match, Team } from '../models/index.js';
import { advancePatch, reopenPatch, canAdvanceInto } from '../domain/bracket.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Bracket progression service. Turns the pure patch decisions from
 * domain/bracket.js into safe, ordered database writes.
 */
export const bracketService = {
  /**
   * Advance the winner of `match` into its downstream slot. Idempotent: writing
   * the same team again is a no-op. Refuses to clobber a slot already held by a
   * different team (signals stale state needing a reopen first).
   */
  async advanceWinner(match) {
    const patch = advancePatch(match, match.winnerTeam);
    if (!patch) return null; // e.g. the final
    const downstream = await Match.findById(patch.downstreamMatchId);
    if (!downstream) return null;

    if (!canAdvanceInto(downstream, patch.slot, patch.teamId)) {
      throw ApiError.conflict('Downstream slot already resolved by another team; reopen it first');
    }
    if (patch.slot === 'A') downstream.teamA = patch.teamId;
    else downstream.teamB = patch.teamId;
    await downstream.save();
    return downstream;
  },

  /**
   * Reverse the advancement caused by `match` when it is reopened/corrected.
   * Clears the downstream slot only if it is fed by this exact match, and only
   * if that downstream match hasn't itself started (guard against corrupting a
   * live/finished later match). Cascades a warning otherwise.
   */
  async reverseWinner(match) {
    if (!match.nextMatchId) return { cleared: false };
    const downstream = await Match.findById(match.nextMatchId);
    if (!downstream) return { cleared: false };

    const patch = reopenPatch(match, downstream);
    if (!patch) return { cleared: false };

    // Don't silently corrupt a downstream match that has already begun.
    if (['LIVE', 'FINISHED', 'LOCKED', 'MATCH_DECIDED'].includes(downstream.state)) {
      throw ApiError.conflict(
        `Cannot reopen: downstream ${downstream.label} has already started. Reopen it first.`
      );
    }
    if (patch.slot === 'A') downstream.teamA = null;
    else downstream.teamB = null;
    await downstream.save();
    return { cleared: true, downstream };
  },

  /** Resolve human-readable slot labels for a match with TBD slots. */
  async describeSlots(match) {
    const out = { A: null, B: null };
    for (const slot of ['A', 'B']) {
      const teamId = slot === 'A' ? match.teamA : match.teamB;
      if (teamId) {
        const team = await Team.findById(teamId).select('name code');
        out[slot] = team ? { id: team._id, name: team.name, code: team.code, tbd: false } : null;
      } else {
        const src = match.source?.[slot];
        out[slot] = { tbd: true, label: src?.label || 'To be decided' };
      }
    }
    return out;
  },
};
