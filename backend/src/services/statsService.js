import { Match, RallyEvent, Team, Player } from '../models/index.js';
import { computeStandings } from '../domain/standings.js';
import { derivePlayerStatArray } from '../domain/stats.js';
import { isConcluded } from '../domain/lifecycle.js';

/** Read-side derivations for standings and player statistics. */
export const statsService = {
  /** Standings for a tournament, computed from concluded matches. */
  async standings(tournamentId) {
    const teams = await Team.find({ tournament: tournamentId }).select('_id name code year colorToken');
    const teamIds = teams.map((t) => String(t._id));
    const matches = await Match.find({ tournament: tournamentId }).select('teamA teamB winner setScores state stage');
    const finished = matches
      .filter((m) => isConcluded(m.state) && m.winner)
      .map((m) => ({
        teamA: m.teamA,
        teamB: m.teamB,
        winner: m.winner,
        setScores: m.setScores.filter((s) => s.complete),
      }));
    
    // Get tournament rules for points configuration
    const { Tournament } = await import('../models/index.js');
    const tournament = await Tournament.findById(tournamentId);
    const rules = {
      winPoints: tournament?.rules?.winPoints ?? 2,
      lossPoints: tournament?.rules?.lossPoints ?? 0,
    };
    
    const rows = computeStandings(teamIds, finished, rules, tournament.tiebreakOverrides || []);
    const teamById = Object.fromEntries(teams.map((t) => [String(t._id), t]));
    return rows.map((r) => ({
      ...r,
      team: teamById[r.teamId]
        ? {
            id: r.teamId,
            name: teamById[r.teamId].name,
            code: teamById[r.teamId].code,
            year: teamById[r.teamId].year,
            colorToken: teamById[r.teamId].colorToken,
          }
        : null,
    }));
  },

  /** Player stat leaderboard for a tournament, derived from rally events. */
  async playerStats(tournamentId, { teamId } = {}) {
    const eventQuery = { tournament: tournamentId, voided: false };
    const events = await RallyEvent.find(eventQuery).lean();
    const mapped = events.map((e) => ({
      pointType: e.pointType,
      playerId: e.player,
      assistPlayerId: e.assistPlayer,
      errorType: e.errorType,
      errorPlayerId: e.errorPlayer,
      digPlayerId: e.digPlayer,
      receptionPlayerId: e.receptionPlayer,
    }));
    const lines = derivePlayerStatArray(mapped);

    const playerIds = lines.map((l) => l.playerId);
    const players = await Player.find({ _id: { $in: playerIds } })
      .select('name jerseyNumber team position')
      .populate('team', 'name code');
    const byId = Object.fromEntries(players.map((p) => [String(p._id), p]));

    let enriched = lines
      .map((l) => {
        const p = byId[l.playerId];
        if (!p) return null;
        return {
          ...l,
          player: { id: p._id, name: p.name, jersey: p.jerseyNumber, position: p.position },
          team: p.team ? { id: p.team._id, name: p.team.name, code: p.team.code } : null,
        };
      })
      .filter(Boolean);

    if (teamId) enriched = enriched.filter((l) => l.team && String(l.team.id) === String(teamId));
    return enriched;
  },

  /** Convenience leaders by a metric, honestly empty when no data. */
  async leaders(tournamentId, metric = 'pointsScored', limit = 5) {
    const all = await this.playerStats(tournamentId);
    return [...all]
      .filter((l) => (l[metric] || 0) > 0)
      .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
      .slice(0, limit);
  },
};
