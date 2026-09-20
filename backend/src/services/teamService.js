import { Team, Player } from '../models/index.js';
import { evaluateRoster, isPlayerEligible, PLAYER_STATUS } from '../domain/roster.js';
import { ApiError } from '../utils/ApiError.js';

/** Team + roster orchestration with eligibility and completeness enforcement. */
export const teamService = {
  async rosterReport(teamId) {
    const team = await Team.findById(teamId);
    if (!team) throw ApiError.notFound('Team not found');
    const players = await Player.find({ team: teamId });
    return { team, players, report: evaluateRoster(team, players) };
  },

  /** Add a player, enforcing year eligibility. */
  async addPlayer(teamId, data) {
    const team = await Team.findById(teamId);
    if (!team) throw ApiError.notFound('Team not found');
    if (!isPlayerEligible(team, { year: data.year })) {
      throw ApiError.validation(
        `Player year ${data.year} does not match team year ${team.year}`,
        { field: 'year' }
      );
    }
    const player = await Player.create({
      tournament: team.tournament,
      team: team._id,
      name: data.name,
      jerseyNumber: data.jerseyNumber ?? null,
      year: data.year,
      position: data.position || 'UNSPECIFIED',
      status: data.status || PLAYER_STATUS.ACTIVE,
      isCaptain: false,
    });
    return player;
  },

  async updatePlayer(playerId, data) {
    const player = await Player.findById(playerId);
    if (!player) throw ApiError.notFound('Player not found');
    const team = await Team.findById(player.team);
    if (data.year != null && !isPlayerEligible(team, { year: data.year })) {
      throw ApiError.validation(`Player year ${data.year} does not match team year ${team.year}`);
    }
    Object.assign(player, {
      name: data.name ?? player.name,
      jerseyNumber: data.jerseyNumber ?? player.jerseyNumber,
      year: data.year ?? player.year,
      position: data.position ?? player.position,
      status: data.status ?? player.status,
    });
    await player.save();
    return player;
  },

  /** Assign captain: exactly one active captain per team. */
  async setCaptain(teamId, playerId) {
    const team = await Team.findById(teamId);
    if (!team) throw ApiError.notFound('Team not found');
    const player = await Player.findOne({ _id: playerId, team: teamId });
    if (!player) throw ApiError.validation('Player is not on this team');
    if (player.status !== PLAYER_STATUS.ACTIVE) {
      throw ApiError.validation('Captain must be an active player');
    }
    await Player.updateMany({ team: teamId }, { isCaptain: false });
    player.isCaptain = true;
    await player.save();
    team.captain = player._id;
    await team.save();
    return { team, player };
  },

  async removePlayer(playerId) {
    const player = await Player.findById(playerId);
    if (!player) throw ApiError.notFound('Player not found');
    if (player.isCaptain) {
      await Team.updateOne({ _id: player.team }, { captain: null });
    }
    await player.deleteOne();
    return true;
  },
};
