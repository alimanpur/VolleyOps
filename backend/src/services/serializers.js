import { Team } from '../models/index.js';
import { bracketService } from './bracketService.js';

/**
 * DTO builders shared across public/captain/admin controllers so the API shape
 * stays consistent. Never leak nulls where the UI expects a label — TBD slots
 * carry a human explanation instead.
 */

export async function serializeMatch(match, { includeTimeline } = {}) {
  const slots = await bracketService.describeSlots(match);
  const court = match.court && match.court.name ? { id: match.court._id, name: match.court.name } : null;
  const winnerTeam = match.winnerTeam
    ? await Team.findById(match.winnerTeam).select('name code')
    : null;

  const setsWon = match.setScores.reduce(
    (acc, s) => {
      if (s.winner === 'A') acc.A += 1;
      else if (s.winner === 'B') acc.B += 1;
      return acc;
    },
    { A: 0, B: 0 }
  );

  return {
    id: match._id,
    code: match.code,
    stage: match.stage,
    label: match.label,
    order: match.order,
    state: match.state,
    court,
    scheduledAt: match.scheduledAt,
    currentSet: match.currentSet,
    serving: match.serving,
    teamA: slots.A,
    teamB: slots.B,
    setScores: match.setScores.map((s) => ({
      setNumber: s.setNumber,
      a: s.a,
      b: s.b,
      winner: s.winner,
      complete: s.complete,
    })),
    setsWon,
    winner: match.winner,
    winnerTeam: winnerTeam ? { id: winnerTeam._id, name: winnerTeam.name, code: winnerTeam.code } : null,
    hasScorer: Boolean(match.scorer),
    startedAt: match.startedAt,
    finishedAt: match.finishedAt,
  };
}

export function serializeTeam(team, extra = {}) {
  return {
    id: team._id,
    code: team.code,
    name: team.name,
    shortName: team.shortName || team.name,
    year: team.year,
    seed: team.seed,
    colorToken: team.colorToken,
    captain: team.captain || null,
    ...extra,
  };
}

export function serializePlayer(player) {
  return {
    id: player._id,
    name: player.name,
    jerseyNumber: player.jerseyNumber,
    year: player.year,
    position: player.position,
    status: player.status,
    isCaptain: player.isCaptain,
    team: player.team?._id ? { id: player.team._id, name: player.team.name, code: player.team.code } : player.team,
  };
}
