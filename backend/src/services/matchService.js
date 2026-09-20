import { Match, RallyEvent, Team, Player } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { DEFAULT_RULES, replayRallies } from '../domain/scoring.js';
import { MATCH_STATES, isScorable, assertTransition, slotsResolved } from '../domain/lifecycle.js';
import { normalizeAttribution } from '../domain/rally.js';
import { bracketService } from './bracketService.js';
import { recordAudit } from './auditService.js';

/**
 * Match orchestration: lifecycle transitions plus the authoritative scoring
 * engine. The frontend never decides set/match completion — this does, from
 * recorded rally events.
 */

function rulesFor(match, tournament) {
  return tournament?.rules || DEFAULT_RULES;
}

/** Recompute a match's set scores + serving from its non-voided rally events. */
async function rebuildFromEvents(match, rules) {
  const events = await RallyEvent.find({ match: match._id, voided: false })
    .sort({ seq: 1 })
    .select('winner');
  // replayRallies is the pure authority for set/match completion.
  return replayRallies(events.map((e) => ({ winner: e.winner })), rules);
}

export const matchService = {
  /** Confirm starting lineups (6 per side) before a match goes live. */
  async setLineups(match, { a = [], b = [] }) {
    const check = async (ids, side) => {
      const teamId = side === 'A' ? match.teamA : match.teamB;
      if (!teamId) throw ApiError.conflict('Both teams must be resolved before lineups');
      const players = await Player.find({ _id: { $in: ids }, team: teamId });
      if (players.length !== ids.length) {
        throw ApiError.validation(`Lineup for side ${side} contains players not on that team`);
      }
      return ids.map((player) => ({ side, player }));
    };
    const entries = [...(await check(a, 'A')), ...(await check(b, 'B'))];
    match.lineups = entries;
    await match.save();
    return match;
  },

  /** Move SCHEDULED/PRE_MATCH -> LIVE. Requires resolved slots. */
  async startMatch(match) {
    if (!slotsResolved(match)) {
      throw ApiError.conflict('Cannot start: one or both teams are not yet resolved');
    }
    if (match.state === MATCH_STATES.SCHEDULED) {
      match.state = MATCH_STATES.PRE_MATCH;
    }
    const err = assertTransition(match.state, MATCH_STATES.LIVE);
    if (err) throw err;
    match.state = MATCH_STATES.LIVE;
    match.currentSet = match.currentSet || 1;
    if (!match.setScores.length) {
      match.setScores = [{ setNumber: 1, a: 0, b: 0, winner: null, complete: false }];
    }
    match.startedAt = match.startedAt || new Date();
    await match.save();
    return match;
  },

  /**
   * Record a rally. Idempotent on (match, clientEventId). Returns the updated
   * match plus a flag indicating whether this was a duplicate replay.
   */
  async recordRally(match, tournament, payload, actor) {
    const rules = rulesFor(match, tournament);
    const { clientEventId, winner, pointType } = payload;
    if (!clientEventId) throw ApiError.validation('clientEventId is required');

    // Idempotency FIRST, before the scorable guard. A replayed event (e.g. the
    // offline outbox re-flushing the point that finished the match) must be a
    // safe no-op whatever the current state — otherwise the final rally, once
    // the match is FINISHED, would be rejected and stall the queue.
    const existing = await RallyEvent.findOne({ match: match._id, clientEventId });
    if (existing) {
      const fresh = await Match.findById(match._id);
      return { match: fresh, duplicate: true };
    }

    // Only a genuinely new point requires the match to be live.
    if (!isScorable(match.state)) {
      throw ApiError.conflict('Match is not live; cannot score');
    }
    if (winner !== 'A' && winner !== 'B') throw ApiError.validation('winner must be A or B');

    const attribution = normalizeAttribution({ pointType, winner, ...payload });

    // Determine current set + running score from the live set.
    const setNumber = match.currentSet;
    const liveSet = match.setScores.find((s) => s.setNumber === setNumber) || { a: 0, b: 0 };
    const scoreAfter = {
      a: liveSet.a + (winner === 'A' ? 1 : 0),
      b: liveSet.b + (winner === 'B' ? 1 : 0),
    };

    const nextSeq = await Match.findByIdAndUpdate(match._id, { $inc: { rallySeq: 1 } }, { new: true }).then(m => m.rallySeq);
    await RallyEvent.create({
      match: match._id,
      tournament: match.tournament,
      clientEventId,
      seq: nextSeq,
      setNumber,
      winner,
      pointType: attribution.pointType,
      player: attribution.playerId,
      assistPlayer: attribution.assistPlayerId,
      errorType: attribution.errorType,
      errorPlayer: attribution.errorPlayerId,
      digPlayer: attribution.digPlayerId,
      receptionPlayer: attribution.receptionPlayerId,
      note: attribution.note,
      scoreAfter,
      createdBy: actor?.userId || null,
    });

    await this._applyRebuild(match, rules);
    return { match, duplicate: false };
  },

  /** Undo the most recent non-voided rally in the current match. */
  async undoLastRally(match, tournament) {
    const rules = rulesFor(match, tournament);
    const last = await RallyEvent.findOne({ match: match._id, voided: false }).sort({ seq: -1 });
    if (!last) throw ApiError.conflict('Nothing to undo');
    last.voided = true;
    await last.save();
    // Undo can bring a decided match back to life.
    if (match.state === MATCH_STATES.FINISHED || match.state === MATCH_STATES.MATCH_DECIDED) {
      match.state = MATCH_STATES.LIVE;
      match.winner = null;
      match.winnerTeam = null;
      match.finishedAt = null;
    }
    await this._applyRebuild(match, rules);
    return match;
  },

  /** Patch the attribution of the latest non-voided rally (add detail). */
  async patchLatestRally(match, payload) {
    const last = await RallyEvent.findOne({ match: match._id, voided: false }).sort({ seq: -1 });
    if (!last) throw ApiError.conflict('No rally to patch');
    const attribution = normalizeAttribution({
      pointType: payload.pointType || last.pointType,
      winner: last.winner,
      ...payload,
    });
    last.pointType = attribution.pointType;
    last.player = attribution.playerId;
    last.assistPlayer = attribution.assistPlayerId;
    last.errorType = attribution.errorType;
    last.errorPlayer = attribution.errorPlayerId;
    last.digPlayer = attribution.digPlayerId;
    last.receptionPlayer = attribution.receptionPlayerId;
    if (attribution.note != null) last.note = attribution.note;
    await last.save();
    return last;
  },

  /** Record a substitution for the current set. */
  async substitute(match, { side, playerOut, playerIn, setNumber }) {
    if (!isScorable(match.state)) throw ApiError.conflict('Match is not live');
    if (side !== 'A' && side !== 'B') throw ApiError.validation('side must be A or B');
    const teamId = side === 'A' ? match.teamA : match.teamB;
    const inPlayer = await Player.findOne({ _id: playerIn, team: teamId });
    if (!inPlayer) throw ApiError.validation('Incoming player is not on that team');
    match.substitutions.push({
      side,
      playerOut,
      playerIn,
      setNumber: setNumber || match.currentSet,
    });
    // Reflect on the active lineup so the scorer sees the right six.
    match.lineups = match.lineups.map((l) =>
      l.side === side && String(l.player) === String(playerOut) ? { side, player: playerIn } : l
    );
    await match.save();
    return match;
  },

  /**
   * Recompute set/match state from events and persist. Central authority for
   * set completion, match completion, and winner advancement.
   */
  async _applyRebuild(match, rules) {
    const { sets, serving, decided, matchWinner } = await rebuildFromEvents(match, rules);
    match.setScores = sets;
    match.serving = serving;

    const liveSet = sets[sets.length - 1];
    match.currentSet = liveSet ? liveSet.setNumber : 1;

    if (decided) {
      match.state = MATCH_STATES.FINISHED;
      match.winner = matchWinner;
      match.winnerTeam = matchWinner === 'A' ? match.teamA : match.teamB;
      match.finishedAt = match.finishedAt || new Date();
      await match.save();
      // Advance downstream after the match doc is saved.
      await bracketService.advanceWinner(match);
    } else {
      if (match.state !== MATCH_STATES.LIVE) match.state = MATCH_STATES.LIVE;
      await match.save();
    }
    return match;
  },

  /**
   * Admin reopen: bring a finished match back to LIVE for correction and clear
   * any downstream advancement it produced.
   */
  async reopenMatch(match, actor) {
    if (![MATCH_STATES.FINISHED, MATCH_STATES.LOCKED, MATCH_STATES.MATCH_DECIDED].includes(match.state)) {
      throw ApiError.conflict('Only a finished/locked match can be reopened');
    }
    // Reverse downstream first (throws if downstream already started).
    await bracketService.reverseWinner(match);
    match.state = MATCH_STATES.LIVE;
    match.winner = null;
    match.winnerTeam = null;
    match.finishedAt = null;
    await match.save();
    await recordAudit({
      tournament: match.tournament,
      actor: actor?.userId,
      actorLabel: actor?.user?.displayName,
      action: 'MATCH_REOPENED',
      targetType: 'Match',
      targetId: match._id,
      targetLabel: match.label,
    });
    return match;
  },

  /**
   * Admin reset: wipe a match back to SCHEDULED as if it never started. Unlike
   * undo (which voids events one at a time) or reopen (which brings a finished
   * match back to LIVE), this is a hard reset for a match started by mistake:
   * it deletes every rally event and clears all scoring/lineup state. Reverses
   * any downstream advancement first (refuses if the downstream match has
   * already started, to avoid corrupting a later live/finished match). A locked
   * match must be reopened before it can be reset.
   */
  async resetMatch(match, actor) {
    if (match.state === MATCH_STATES.LOCKED) {
      throw ApiError.conflict('Unlock or reopen the match before resetting it');
    }
    // If this match had produced a winner downstream, pull it back out first.
    if (match.winnerTeam) {
      await bracketService.reverseWinner(match);
    }
    // Hard delete the event log — a reset is not an audit-preserving undo.
    await RallyEvent.deleteMany({ match: match._id });
    match.state = MATCH_STATES.SCHEDULED;
    match.currentSet = 1;
    match.setScores = [];
    match.serving = null;
    match.winner = null;
    match.winnerTeam = null;
    match.lineups = [];
    match.substitutions = [];
    match.startedAt = null;
    match.finishedAt = null;
    match.rallySeq = 0;
    await match.save();
    await recordAudit({
      tournament: match.tournament,
      actor: actor?.userId,
      actorLabel: actor?.user?.displayName,
      action: 'MATCH_RESET',
      targetType: 'Match',
      targetId: match._id,
      targetLabel: match.label,
    });
    return match;
  },

  /** Admin lock: freeze a finished match against further edits. */
  async lockMatch(match) {
    if (match.state !== MATCH_STATES.FINISHED) {
      throw ApiError.conflict('Only a finished match can be locked');
    }
    match.state = MATCH_STATES.LOCKED;
    await match.save();
    return match;
  },

  /** Build the public/ scorer timeline for a match. */
  async timeline(match) {
    const events = await RallyEvent.find({ match: match._id, voided: false })
      .sort({ seq: 1 })
      .populate('player assistPlayer errorPlayer', 'name jerseyNumber');
    return events.map((e) => ({
      id: e._id,
      seq: e.seq,
      setNumber: e.setNumber,
      winner: e.winner,
      pointType: e.pointType,
      player: e.player ? { id: e.player._id, name: e.player.name, jersey: e.player.jerseyNumber } : null,
      assistPlayer: e.assistPlayer ? { id: e.assistPlayer._id, name: e.assistPlayer.name } : null,
      errorType: e.errorType,
      scoreAfter: e.scoreAfter,
      at: e.createdAt,
    }));
  },
};
