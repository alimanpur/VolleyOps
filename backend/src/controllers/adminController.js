import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {
  Tournament, Team, Player, Court, Match, Award, Notification, AuditEntry, User,
} from '../models/index.js';
import { tournamentService } from '../services/tournamentService.js';
import { teamService } from '../services/teamService.js';
import { statsService } from '../services/statsService.js';
import { matchService } from '../services/matchService.js';
import { authService } from '../services/authService.js';
import { recordAudit } from '../services/auditService.js';
import { serializeMatch, serializeTeam, serializePlayer } from '../services/serializers.js';
import { STAGES } from '../domain/bracket.js';

async function activeTournament() {
  const t = await tournamentService.getActive();
  if (!t) throw ApiError.notFound('No tournament configured');
  return t;
}

function audit(req, fields) {
  return recordAudit({
    tournament: req.auth.tournament,
    actor: req.auth.userId,
    actorLabel: req.auth.user?.displayName,
    ...fields,
  });
}

export const adminController = {
  // ---- Dashboard: what needs attention right now ----
  dashboard: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const matches = await Match.find({ tournament: t._id }).sort({ order: 1 }).populate('court', 'name');
    const serialized = await Promise.all(matches.map((m) => serializeMatch(m)));

    const teams = await Team.find({ tournament: t._id });
    const incompleteRosters = [];
    for (const team of teams) {
      const { report } = await teamService.rosterReport(team._id);
      if (!report.complete) incompleteRosters.push({ team: serializeTeam(team), issues: report.issues });
    }

    const unassignedUpcoming = serialized.filter(
      (m) => ['SCHEDULED', 'PRE_MATCH'].includes(m.state) && !m.hasScorer && m.teamA && m.teamB && !m.teamA.tbd && !m.teamB.tbd
    );
    const waitingForWinner = serialized.filter(
      (m) => (m.teamA?.tbd || m.teamB?.tbd) && m.state === 'SCHEDULED'
    );
    const unreadNotifications = await Notification.countDocuments({
      tournament: t._id,
      audience: { $in: ['ADMIN', 'ALL'] },
      readBy: { $ne: req.auth.userId },
    });

    res.json({
      tournament: { id: t._id, name: t.name, status: t.status },
      live: serialized.filter((m) => m.state === 'LIVE'),
      next: serialized.find((m) => ['SCHEDULED', 'PRE_MATCH'].includes(m.state) && !m.teamA?.tbd && !m.teamB?.tbd) || null,
      attention: {
        incompleteRosters,
        unassignedUpcoming,
        waitingForWinner,
        unreadNotifications,
      },
      counts: {
        teams: teams.length,
        players: await Player.countDocuments({ tournament: t._id }),
        matches: matches.length,
        courts: await Court.countDocuments({ tournament: t._id }),
      },
    });
  }),

  // ---- Tournament ----
  getTournament: asyncHandler(async (_req, res) => {
    const t = await activeTournament();
    res.json({ tournament: t });
  }),

  upsertTournament: asyncHandler(async (req, res) => {
    const existing = await tournamentService.getActive();
    const writable = ['name', 'subtitle', 'venue', 'startDate', 'endDate', 'startTimeNote', 'timezone', 'rules', 'openScoring'];
    const data = Object.fromEntries(writable.map((k) => [k, req.body?.[k]]).filter(([, v]) => v !== undefined));
    let t;
    if (existing) {
      Object.assign(existing, data);
      t = await existing.save();
    } else {
      t = await Tournament.create({ ...data, isActive: true });
    }
    await audit(req, { action: existing ? 'TOURNAMENT_UPDATED' : 'TOURNAMENT_CREATED', targetType: 'Tournament', targetId: t._id, targetLabel: t.name });
    res.json({ tournament: t });
  }),

  publish: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    await tournamentService.publish(t._id);
    await audit(req, { action: 'TOURNAMENT_PUBLISHED', targetType: 'Tournament', targetId: t._id });
    res.json({ ok: true });
  }),

  setOpenScoring: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    t.openScoring = Boolean(req.body?.enabled);
    await t.save();
    await audit(req, {
      action: t.openScoring ? 'OPEN_SCORING_ENABLED' : 'OPEN_SCORING_DISABLED',
      targetType: 'Tournament',
      targetId: t._id,
      targetLabel: t.name,
    });
    res.json({ openScoring: t.openScoring });
  }),

  buildBracket: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const matches = await tournamentService.buildBracket(t._id);
    await audit(req, { action: 'BRACKET_BUILT', targetType: 'Tournament', targetId: t._id });
    res.json({ matches: await Promise.all(matches.map((m) => serializeMatch(m))) });
  }),

  getProgress: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const progress = await tournamentService.getProgress(t._id);
    res.json(progress);
  }),

  lockQualification: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const result = await tournamentService.lockQualification(t._id, req.auth);
    await audit(req, { action: 'QUALIFICATION_LOCKED', targetType: 'Tournament', targetId: t._id, metadata: { qualifiedTeams: result.qualifiedTeams } });
    res.json(result);
  }),

  generateSemifinals: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const result = await tournamentService.lockQualification(t._id, req.auth);
    await audit(req, { action: 'SEMIFINALS_GENERATED', targetType: 'Tournament', targetId: t._id, metadata: { qualifiedTeams: result.qualifiedTeams } });
    res.json({ qualifiedTeams: result.qualifiedTeams, semifinals: await Promise.all(Object.values(result.semifinals).map((m) => serializeMatch(m))) });
  }),

  generateFinal: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const finalMatch = await tournamentService.generateFinal(t._id, req.auth);
    await audit(req, { action: 'FINAL_GENERATED', targetType: 'Tournament', targetId: t._id, targetLabel: finalMatch.label });
    res.json({ final: await serializeMatch(finalMatch) });
  }),

  completeTournament: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const matches = await Match.find({ tournament: t._id });
    const finalMatch = matches.find((m) => m.stage === STAGES.FINAL);
    if (!finalMatch || !['FINISHED', 'LOCKED'].includes(finalMatch.state)) {
      throw ApiError.conflict('Final must be completed before ending the tournament');
    }
    if (!finalMatch.winnerTeam) {
      throw ApiError.conflict('Final winner must be determined');
    }
    t.status = 'COMPLETED';
    await t.save();
    await audit(req, { action: 'TOURNAMENT_COMPLETED', targetType: 'Tournament', targetId: t._id, targetLabel: t.name });
    res.json({ ok: true, tournament: t });
  }),

  setTiebreakOverride: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const { teamId, rank } = req.body || {};
    if (!teamId || rank === undefined) {
      throw ApiError.validation('teamId and rank are required');
    }
    const team = await Team.findOne({ _id: teamId, tournament: t._id });
    if (!team) throw ApiError.notFound('Team not found');
    
    const overrides = t.tiebreakOverrides || [];
    const existingIndex = overrides.findIndex((o) => String(o.teamId) === String(teamId));
    if (existingIndex >= 0) {
      overrides[existingIndex].rank = rank;
    } else {
      overrides.push({ teamId, rank });
    }
    t.tiebreakOverrides = overrides;
    await t.save();
    await audit(req, { action: 'TIEBREAK_OVERRIDE_SET', targetType: 'Tournament', targetId: t._id, targetLabel: team.name, metadata: { rank } });
    res.json({ tiebreakOverrides: t.tiebreakOverrides });
  }),

  // ---- Teams ----
  listTeams: asyncHandler(async (_req, res) => {
    const t = await activeTournament();
    const teams = await Team.find({ tournament: t._id }).sort({ code: 1 });
    const out = [];
    for (const team of teams) {
      const { report } = await teamService.rosterReport(team._id);
      out.push(serializeTeam(team, { report }));
    }
    res.json({ teams: out });
  }),

  createTeam: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const { code, name, shortName, year, seed, colorToken } = req.body || {};
    const team = await Team.create({ tournament: t._id, code, name, shortName, year, seed, colorToken });
    await audit(req, { action: 'TEAM_CREATED', targetType: 'Team', targetId: team._id, targetLabel: team.name });
    res.status(201).json({ team: serializeTeam(team) });
  }),

  updateTeam: asyncHandler(async (req, res) => {
    const team = await Team.findById(req.params.teamId);
    if (!team) throw ApiError.notFound('Team not found');
    const { code, name, shortName, year, seed, colorToken } = req.body || {};
    Object.assign(team, { code, name, shortName, year, seed, colorToken });
    await team.save();
    await audit(req, { action: 'TEAM_UPDATED', targetType: 'Team', targetId: team._id, targetLabel: team.name });
    res.json({ team: serializeTeam(team) });
  }),

  deleteTeam: asyncHandler(async (req, res) => {
    const team = await Team.findById(req.params.teamId);
    if (!team) throw ApiError.notFound('Team not found');
    await Player.deleteMany({ team: team._id });
    await team.deleteOne();
    await audit(req, { action: 'TEAM_DELETED', targetType: 'Team', targetId: team._id, targetLabel: team.name });
    res.json({ ok: true });
  }),

  teamRoster: asyncHandler(async (req, res) => {
    const { team, players, report } = await teamService.rosterReport(req.params.teamId);
    res.json({ team: serializeTeam(team), players: players.map(serializePlayer), report });
  }),

  // ---- Players ----
  createPlayer: asyncHandler(async (req, res) => {
    const player = await teamService.addPlayer(req.params.teamId, req.body || {});
    await audit(req, { action: 'PLAYER_ADDED', targetType: 'Player', targetId: player._id, targetLabel: player.name });
    res.status(201).json({ player: serializePlayer(player) });
  }),

  updatePlayer: asyncHandler(async (req, res) => {
    const player = await teamService.updatePlayer(req.params.playerId, req.body || {});
    await audit(req, { action: 'PLAYER_UPDATED', targetType: 'Player', targetId: player._id, targetLabel: player.name });
    res.json({ player: serializePlayer(player) });
  }),

  deletePlayer: asyncHandler(async (req, res) => {
    await teamService.removePlayer(req.params.playerId);
    await audit(req, { action: 'PLAYER_REMOVED', targetType: 'Player', targetId: req.params.playerId });
    res.json({ ok: true });
  }),

  setCaptain: asyncHandler(async (req, res) => {
    const { team, player } = await teamService.setCaptain(req.params.teamId, req.body.playerId);
    await audit(req, { action: 'CAPTAIN_ASSIGNED', targetType: 'Team', targetId: team._id, targetLabel: team.name, metadata: { player: player.name } });
    res.json({ team: serializeTeam(team), captain: serializePlayer(player) });
  }),

  // ---- Courts ----
  listCourts: asyncHandler(async (_req, res) => {
    const t = await activeTournament();
    res.json({ courts: await Court.find({ tournament: t._id }).sort({ name: 1 }) });
  }),

  createCourt: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const { name, location, isActive } = req.body || {};
    const court = await Court.create({ tournament: t._id, name, location, isActive });
    await audit(req, { action: 'COURT_CREATED', targetType: 'Court', targetId: court._id, targetLabel: court.name });
    res.status(201).json({ court });
  }),

  deleteCourt: asyncHandler(async (req, res) => {
    await Court.deleteOne({ _id: req.params.courtId });
    res.json({ ok: true });
  }),

  // ---- Matches / fixtures ----
  listMatches: asyncHandler(async (_req, res) => {
    const t = await activeTournament();
    const matches = await Match.find({ tournament: t._id }).sort({ order: 1 }).populate('court', 'name');
    res.json({ matches: await Promise.all(matches.map((m) => serializeMatch(m))) });
  }),

  matchDetail: asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.matchId).populate('court', 'name');
    if (!match) throw ApiError.notFound('Match not found');
    res.json({ match: await serializeMatch(match), timeline: await matchService.timeline(match) });
  }),

  updateMatch: asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.matchId);
    if (!match) throw ApiError.notFound('Match not found');
    const { court, scheduledAt } = req.body || {};
    if (court !== undefined) match.court = court || null;
    if (scheduledAt !== undefined) match.scheduledAt = scheduledAt || null;
    await match.save();
    await audit(req, { action: 'MATCH_UPDATED', targetType: 'Match', targetId: match._id, targetLabel: match.label });
    res.json({ match: await serializeMatch(match) });
  }),

  assignScorer: asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.matchId);
    if (!match) throw ApiError.notFound('Match not found');
    const scorer = await User.findOne({ _id: req.body.scorerId, role: 'SCORER' });
    if (!scorer) throw ApiError.validation('Scorer not found');
    match.scorer = scorer._id;
    await match.save();
    await Notification.create({
      tournament: match.tournament,
      type: 'FIXTURE',
      audience: 'SCORER',
      user: scorer._id,
      title: `You are assigned to score ${match.label}`,
      match: match._id,
    });
    await audit(req, { action: 'SCORER_ASSIGNED', targetType: 'Match', targetId: match._id, targetLabel: match.label, metadata: { scorer: scorer.displayName } });
    res.json({ match: await serializeMatch(match) });
  }),

  reopenMatch: asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.matchId);
    if (!match) throw ApiError.notFound('Match not found');
    await matchService.reopenMatch(match, req.auth);
    res.json({ match: await serializeMatch(match) });
  }),

  lockMatch: asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.matchId);
    if (!match) throw ApiError.notFound('Match not found');
    await matchService.lockMatch(match);
    await audit(req, { action: 'MATCH_LOCKED', targetType: 'Match', targetId: match._id, targetLabel: match.label });
    res.json({ match: await serializeMatch(match) });
  }),

  cancelMatch: asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.matchId);
    if (!match) throw ApiError.notFound('Match not found');
    match.state = 'CANCELLED';
    await match.save();
    await audit(req, { action: 'MATCH_CANCELLED', targetType: 'Match', targetId: match._id, targetLabel: match.label });
    res.json({ match: await serializeMatch(match) });
  }),

  resetMatch: asyncHandler(async (req, res) => {
    const match = await Match.findById(req.params.matchId);
    if (!match) throw ApiError.notFound('Match not found');
    await matchService.resetMatch(match, req.auth);
    res.json({ match: await serializeMatch(match) });
  }),

  // ---- Standings & stats ----
  standings: asyncHandler(async (req, res) => {
    res.json({ standings: await statsService.standings(req.auth.tournament) });
  }),

  stats: asyncHandler(async (req, res) => {
    res.json({ stats: await statsService.playerStats(req.auth.tournament) });
  }),

  // ---- Awards ----
  listAwards: asyncHandler(async (_req, res) => {
    const t = await activeTournament();
    const awards = await Award.find({ tournament: t._id })
      .populate('winner', 'name')
      .populate('candidates.player', 'name')
      .populate('winnerTeam', 'name');
    res.json({ awards });
  }),

  upsertAward: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const { key, title, description } = req.body || {};
    let award = await Award.findOne({ tournament: t._id, key });
    if (award) {
      Object.assign(award, { title: title ?? award.title, description: description ?? award.description });
    } else {
      award = new Award({ tournament: t._id, key, title, description });
    }
    await award.save();
    await audit(req, { action: 'AWARD_UPSERTED', targetType: 'Award', targetId: award._id, targetLabel: award.title });
    res.json({ award });
  }),

  updateAward: asyncHandler(async (req, res) => {
    const award = await Award.findById(req.params.awardId);
    if (!award) throw ApiError.notFound('Award not found');
    const { candidates, winner, winnerTeam, published } = req.body || {};
    if (candidates !== undefined) award.candidates = candidates;
    if (winner !== undefined) award.winner = winner || null;
    if (winnerTeam !== undefined) award.winnerTeam = winnerTeam || null;
    if (published !== undefined) award.published = published;
    await award.save();
    await audit(req, { action: 'AWARD_UPDATED', targetType: 'Award', targetId: award._id, targetLabel: award.title });
    res.json({ award });
  }),

  // ---- Notifications ----
  listNotifications: asyncHandler(async (_req, res) => {
    const t = await activeTournament();
    const items = await Notification.find({ tournament: t._id }).sort({ createdAt: -1 }).limit(100);
    res.json({
      notifications: items.map((n) => ({
        id: n._id,
        type: n.type,
        audience: n.audience,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt,
        read: n.readBy.map(String).includes(String(req.auth.userId)),
      })),
    });
  }),

  createNotification: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const n = await Notification.create({ ...req.body, tournament: t._id });
    await audit(req, { action: 'NOTIFICATION_SENT', targetType: 'Notification', targetId: n._id, targetLabel: n.title });
    res.status(201).json({ notification: n });
  }),

  markNotificationRead: asyncHandler(async (req, res) => {
    await Notification.updateOne({ _id: req.params.id }, { $addToSet: { readBy: req.auth.userId } });
    res.json({ ok: true });
  }),

  // ---- Access (captains & scorers) ----
  listAccess: asyncHandler(async (_req, res) => {
    const t = await activeTournament();
    const users = await User.find({ tournament: t._id, role: { $in: ['CAPTAIN', 'SCORER'] } })
      .populate('team', 'name code')
      .sort({ role: 1, displayName: 1 });
    res.json({
      users: users.map((u) => ({
        id: u._id,
        role: u.role,
        displayName: u.displayName,
        team: u.team ? { id: u.team._id, name: u.team.name, code: u.team.code } : null,
        hasCode: Boolean(u.inviteCodeHash),
        redeemed: Boolean(u.redeemedAt),
        codeVersion: u.codeVersion,
      })),
    });
  }),

  createAccess: asyncHandler(async (req, res) => {
    const t = await activeTournament();
    const { role, displayName, teamId } = req.body || {};
    if (!['CAPTAIN', 'SCORER'].includes(role)) throw ApiError.validation('role must be CAPTAIN or SCORER');
    if (role === 'CAPTAIN' && !teamId) throw ApiError.validation('Captain requires a team');
    const user = await User.create({
      tournament: t._id,
      role,
      displayName,
      team: role === 'CAPTAIN' ? teamId : null,
    });
    const code = await authService.issueCode(user._id);
    await audit(req, { action: 'ACCESS_CREATED', targetType: 'User', targetId: user._id, targetLabel: displayName, metadata: { role } });
    res.status(201).json({ user: { id: user._id, role, displayName }, code });
  }),

  regenerateAccess: asyncHandler(async (req, res) => {
    const code = await authService.issueCode(req.params.userId);
    await audit(req, { action: 'ACCESS_CODE_REGENERATED', targetType: 'User', targetId: req.params.userId });
    res.json({ code });
  }),

  revokeAccess: asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userId);
    if (!user) throw ApiError.notFound('User not found');
    user.isActive = false;
    user.inviteCodeHash = null;
    await user.save();
    await audit(req, { action: 'ACCESS_REVOKED', targetType: 'User', targetId: user._id, targetLabel: user.displayName });
    res.json({ ok: true });
  }),

  // ---- Audit log ----
  audit: asyncHandler(async (_req, res) => {
    const t = await activeTournament();
    const entries = await AuditEntry.find({ tournament: t._id }).sort({ createdAt: -1 }).limit(200);
    res.json({ entries });
  }),
};
