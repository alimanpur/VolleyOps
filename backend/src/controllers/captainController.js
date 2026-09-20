import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { Match, Notification } from '../models/index.js';
import { teamService } from '../services/teamService.js';
import { statsService } from '../services/statsService.js';
import { matchService } from '../services/matchService.js';
import { serializeTeam, serializePlayer, serializeMatch } from '../services/serializers.js';

/** All captain endpoints operate strictly on req.auth.team — never a param. */
function myTeam(req) {
  if (!req.auth?.team) throw ApiError.forbidden('No team associated with this session');
  return req.auth.team;
}

export const captainController = {
  dashboard: asyncHandler(async (req, res) => {
    const teamId = myTeam(req);
    const { team, players, report } = await teamService.rosterReport(teamId);
    const matches = await Match.find({ $or: [{ teamA: teamId }, { teamB: teamId }] })
      .sort({ order: 1 })
      .populate('court', 'name');
    const serialized = await Promise.all(matches.map((m) => serializeMatch(m)));
    const unread = await Notification.countDocuments({
      $or: [{ team: teamId }, { audience: { $in: ['CAPTAIN', 'ALL'] } }],
      readBy: { $ne: req.auth.userId },
    });
    res.json({
      team: serializeTeam(team),
      roster: { players: players.map(serializePlayer), report },
      matches: serialized,
      next: serialized.find((m) => ['SCHEDULED', 'PRE_MATCH'].includes(m.state)) || null,
      live: serialized.find((m) => m.state === 'LIVE') || null,
      unreadNotifications: unread,
    });
  }),

  roster: asyncHandler(async (req, res) => {
    const { team, players, report } = await teamService.rosterReport(myTeam(req));
    res.json({ team: serializeTeam(team), players: players.map(serializePlayer), report });
  }),

  fixtures: asyncHandler(async (req, res) => {
    const teamId = myTeam(req);
    const matches = await Match.find({ $or: [{ teamA: teamId }, { teamB: teamId }] })
      .sort({ order: 1 })
      .populate('court', 'name');
    res.json({ matches: await Promise.all(matches.map((m) => serializeMatch(m))) });
  }),

  standings: asyncHandler(async (req, res) => {
    res.json({ standings: await statsService.standings(req.auth.tournament) });
  }),

  stats: asyncHandler(async (req, res) => {
    const teamId = myTeam(req);
    res.json({ stats: await statsService.playerStats(req.auth.tournament, { teamId }) });
  }),

  matchDetail: asyncHandler(async (req, res) => {
    const teamId = myTeam(req);
    const match = await Match.findById(req.params.matchId).populate('court', 'name');
    if (!match) throw ApiError.notFound('Match not found');
    // A captain may only see matches involving their own team.
    const involved = [String(match.teamA), String(match.teamB)].includes(String(teamId));
    if (!involved) throw ApiError.forbidden('This match does not involve your team');
    res.json({ match: await serializeMatch(match), timeline: await matchService.timeline(match) });
  }),

  notifications: asyncHandler(async (req, res) => {
    const teamId = myTeam(req);
    const items = await Notification.find({
      $or: [{ team: teamId }, { audience: { $in: ['CAPTAIN', 'ALL'] } }],
    })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({
      notifications: items.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt,
        read: n.readBy.map(String).includes(String(req.auth.userId)),
      })),
    });
  }),

  markNotificationRead: asyncHandler(async (req, res) => {
    await Notification.updateOne(
      { _id: req.params.id },
      { $addToSet: { readBy: req.auth.userId } }
    );
    res.json({ ok: true });
  }),
};
