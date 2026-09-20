import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Match, Player } from '../models/index.js';
import { matchService } from '../services/matchService.js';
import { tournamentService } from '../services/tournamentService.js';
import { serializeMatch } from '../services/serializers.js';

/**
 * Load a match and assert the requesting scorer is allowed to write to it.
 * Admins always bypass the check. A scorer is allowed when the match is
 * assigned to them OR the tournament has open scoring enabled (any scorer may
 * score any match). 403 when a scorer targets a match they can't write,
 * 404 when it doesn't exist.
 */
async function loadAssignedMatch(req) {
  const match = await Match.findById(req.params.matchId).populate('court', 'name');
  if (!match) throw ApiError.notFound('Match not found');
  if (req.auth.role === 'SCORER') {
    const t = await tournamentService.getActive();
    const open = Boolean(t?.openScoring);
    const assigned = match.scorer && String(match.scorer) === String(req.auth.userId);
    if (!open && !assigned) {
      throw ApiError.forbidden('This match is not assigned to you');
    }
  }
  return match;
}

async function onCourtPlayers(match) {
  // The six players currently on court per side (lineups reflect substitutions).
  const ids = match.lineups.map((l) => l.player);
  const players = await Player.find({ _id: { $in: ids } }).select('name jerseyNumber team position status');
  const byId = Object.fromEntries(players.map((p) => [String(p._id), p]));
  const build = (side) =>
    match.lineups
      .filter((l) => l.side === side)
      .map((l) => byId[String(l.player)])
      .filter(Boolean)
      .map((p) => ({ id: p._id, name: p.name, jersey: p.jerseyNumber, position: p.position }));
  return { A: build('A'), B: build('B') };
}

export const scorerController = {
  assignments: asyncHandler(async (req, res) => {
    const t = await tournamentService.getActive();
    const openScoring = Boolean(t?.openScoring);
    // In open scoring, a scorer sees every match that can still be worked
    // (cancelled matches are dropped). Otherwise only their assigned matches.
    const query = openScoring
      ? { tournament: t?._id, state: { $ne: 'CANCELLED' } }
      : { scorer: req.auth.userId };
    const matches = await Match.find(query).sort({ order: 1 }).populate('court', 'name');
    res.json({
      openScoring,
      assignments: await Promise.all(matches.map((m) => serializeMatch(m))),
    });
  }),

  match: asyncHandler(async (req, res) => {
    const match = await loadAssignedMatch(req);
    const roster = await rosterForMatch(match);
    res.json({
      match: await serializeMatch(match),
      onCourt: await onCourtPlayers(match),
      roster,
      timeline: await matchService.timeline(match),
    });
  }),

  setLineups: asyncHandler(async (req, res) => {
    const match = await loadAssignedMatch(req);
    await matchService.setLineups(match, req.body || {});
    res.json({ match: await serializeMatch(match), onCourt: await onCourtPlayers(match) });
  }),

  start: asyncHandler(async (req, res) => {
    const match = await loadAssignedMatch(req);
    await matchService.startMatch(match);
    res.json({ match: await serializeMatch(match) });
  }),

  rally: asyncHandler(async (req, res) => {
    const match = await loadAssignedMatch(req);
    const t = await tournamentService.getActive();
    const { match: updated, duplicate } = await matchService.recordRally(match, t, req.body || {}, req.auth);
    res.json({
      match: await serializeMatch(updated),
      duplicate,
      timeline: await matchService.timeline(updated),
    });
  }),

  undo: asyncHandler(async (req, res) => {
    const match = await loadAssignedMatch(req);
    const t = await tournamentService.getActive();
    await matchService.undoLastRally(match, t);
    res.json({ match: await serializeMatch(match), timeline: await matchService.timeline(match) });
  }),

  patchRally: asyncHandler(async (req, res) => {
    const match = await loadAssignedMatch(req);
    await matchService.patchLatestRally(match, req.body || {});
    res.json({ match: await serializeMatch(match), timeline: await matchService.timeline(match) });
  }),

  substitute: asyncHandler(async (req, res) => {
    const match = await loadAssignedMatch(req);
    await matchService.substitute(match, req.body || {});
    res.json({ match: await serializeMatch(match), onCourt: await onCourtPlayers(match) });
  }),
};

async function rosterForMatch(match) {
  const roster = { A: [], B: [] };
  for (const side of ['A', 'B']) {
    const teamId = side === 'A' ? match.teamA : match.teamB;
    if (!teamId) continue;
    const players = await Player.find({ team: teamId }).sort({ status: 1, jerseyNumber: 1 });
    roster[side] = players.map((p) => ({
      id: p._id,
      name: p.name,
      jersey: p.jerseyNumber,
      position: p.position,
      status: p.status,
    }));
  }
  return roster;
}
