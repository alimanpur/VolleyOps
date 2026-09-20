import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Tournament, Team, Player, Match, Award } from '../models/index.js';
import { tournamentService } from '../services/tournamentService.js';
import { statsService } from '../services/statsService.js';
import { matchService } from '../services/matchService.js';
import { serializeMatch, serializeTeam, serializePlayer } from '../services/serializers.js';
import { STAGES } from '../domain/bracket.js';

/** Resolve the published tournament or 404 with an honest message. */
async function requirePublicTournament() {
  const t = await tournamentService.getPublic();
  if (!t) throw ApiError.notFound('No published tournament yet');
  return t;
}

async function loadMatches(tournamentId, filter = {}) {
  const matches = await Match.find({ tournament: tournamentId, ...filter })
    .sort({ order: 1 })
    .populate('court', 'name');
  return Promise.all(matches.map((m) => serializeMatch(m)));
}

export const publicController = {
  tournament: asyncHandler(async (_req, res) => {
    const t = await requirePublicTournament();
    res.json({
      tournament: {
        id: t._id,
        name: t.name,
        subtitle: t.subtitle,
        venue: t.venue,
        startDate: t.startDate,
        endDate: t.endDate,
        startTimeNote: t.startTimeNote,
        timezone: t.timezone,
        rules: t.rules,
        status: t.status,
      },
    });
  }),

  // Homepage payload: live, next, today, recent results, standings snapshot.
  overview: asyncHandler(async (_req, res) => {
    const t = await requirePublicTournament();
    const all = await loadMatches(t._id);
    const live = all.filter((m) => m.state === 'LIVE');
    const finished = all.filter((m) => ['FINISHED', 'LOCKED'].includes(m.state));
    const upcoming = all.filter((m) => ['SCHEDULED', 'PRE_MATCH'].includes(m.state));
    const standings = await statsService.standings(t._id);
    res.json({
      live,
      next: upcoming[0] || null,
      upcoming: upcoming.slice(0, 6),
      recentResults: finished.slice(-4).reverse(),
      standings: standings.slice(0, 5),
    });
  }),

  fixtures: asyncHandler(async (_req, res) => {
    const t = await requirePublicTournament();
    res.json({ matches: await loadMatches(t._id) });
  }),

  results: asyncHandler(async (_req, res) => {
    const t = await requirePublicTournament();
    const matches = await loadMatches(t._id, { state: { $in: ['FINISHED', 'LOCKED'] } });
    res.json({ matches });
  }),

  standings: asyncHandler(async (_req, res) => {
    const t = await requirePublicTournament();
    res.json({ standings: await statsService.standings(t._id) });
  }),

  tournamentProgress: asyncHandler(async (_req, res) => {
    const t = await requirePublicTournament();
    const progress = await tournamentService.getProgress(t._id);
    res.json(progress);
  }),

  teams: asyncHandler(async (_req, res) => {
    const t = await requirePublicTournament();
    const teams = await Team.find({ tournament: t._id }).sort({ code: 1 });
    const withCounts = await Promise.all(
      teams.map(async (team) => {
        const players = await Player.countDocuments({ team: team._id });
        return serializeTeam(team, { playerCount: players });
      })
    );
    res.json({ teams: withCounts });
  }),

  teamDetail: asyncHandler(async (req, res) => {
    const t = await requirePublicTournament();
    const team = await Team.findOne({ _id: req.params.teamId, tournament: t._id });
    if (!team) throw ApiError.notFound('Team not found');
    const players = await Player.find({ team: team._id }).sort({ status: 1, jerseyNumber: 1 });
    const matches = await Match.find({
      tournament: t._id,
      $or: [{ teamA: team._id }, { teamB: team._id }],
    })
      .sort({ order: 1 })
      .populate('court', 'name');
    res.json({
      team: serializeTeam(team),
      players: players.map(serializePlayer),
      matches: await Promise.all(matches.map((m) => serializeMatch(m))),
    });
  }),

  players: asyncHandler(async (_req, res) => {
    const t = await requirePublicTournament();
    const players = await Player.find({ tournament: t._id })
      .sort({ name: 1 })
      .populate('team', 'name code');
    res.json({ players: players.map(serializePlayer) });
  }),

  playerDetail: asyncHandler(async (req, res) => {
    const t = await requirePublicTournament();
    const player = await Player.findOne({ _id: req.params.playerId, tournament: t._id }).populate(
      'team',
      'name code year'
    );
    if (!player) throw ApiError.notFound('Player not found');
    const stats = await statsService.playerStats(t._id);
    const line = stats.find((s) => String(s.player.id) === String(player._id)) || null;
    res.json({ player: serializePlayer(player), stats: line });
  }),

  stats: asyncHandler(async (req, res) => {
    const t = await requirePublicTournament();
    const stats = await statsService.playerStats(t._id, { teamId: req.query.teamId });
    res.json({ stats });
  }),

  awards: asyncHandler(async (_req, res) => {
    const t = await requirePublicTournament();
    const awards = await Award.find({ tournament: t._id, published: true })
      .populate('winner', 'name jerseyNumber')
      .populate('winnerTeam', 'name code');
    res.json({
      awards: awards.map((a) => ({
        id: a._id,
        key: a.key,
        title: a.title,
        description: a.description,
        winner: a.winner ? { id: a.winner._id, name: a.winner.name } : null,
        winnerTeam: a.winnerTeam ? { id: a.winnerTeam._id, name: a.winnerTeam.name } : null,
      })),
    });
  }),

  matchDetail: asyncHandler(async (req, res) => {
    const t = await requirePublicTournament();
    const match = await Match.findOne({ _id: req.params.matchId, tournament: t._id }).populate(
      'court',
      'name'
    );
    if (!match) throw ApiError.notFound('Match not found');
    res.json({
      match: await serializeMatch(match),
      timeline: await matchService.timeline(match),
    });
  }),

  search: asyncHandler(async (req, res) => {
    const t = await requirePublicTournament();
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ results: [] });
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [teams, players] = await Promise.all([
      Team.find({ tournament: t._id, name: rx }).limit(10),
      Player.find({ tournament: t._id, name: rx }).populate('team', 'name code').limit(20),
    ]);
    res.json({
      results: [
        ...teams.map((tm) => ({ type: 'team', id: tm._id, label: tm.name, sub: `Year ${tm.year}` })),
        ...players.map((p) => ({
          type: 'player',
          id: p._id,
          label: p.name,
          sub: p.team ? p.team.name : null,
        })),
      ],
    });
  }),
};
