import { Tournament, Team, Match } from '../models/index.js';
import { leagueBlueprint, semifinalBlueprint, finalBlueprint, assertValidLeagueFixtures, STAGES } from '../domain/bracket.js';
import { ApiError } from '../utils/ApiError.js';

/** Tournament lifecycle + bracket construction from the canonical blueprint. */
export const tournamentService = {
  async getActive() {
    return Tournament.findOne({ isActive: true }).sort({ createdAt: -1 });
  },

  async getPublic() {
    // Public pages only ever see a published tournament.
    return Tournament.findOne({ isActive: true, status: { $in: ['PUBLISHED', 'COMPLETED'] } }).sort({
      createdAt: -1,
    });
  },

  /**
   * Build (or rebuild) the bracket for a tournament from the league blueprint.
   * Wires each match's seeds. Idempotent per code: re-running before any match
   * starts is safe. Refuses to rebuild if any match has started.
   */
  async buildBracket(tournamentId) {
    const teams = await Team.find({ tournament: tournamentId });
    const teamByCode = Object.fromEntries(teams.map((t) => [t.code, t]));

    const existing = await Match.find({ tournament: tournamentId });
    if (existing.some((m) => m.state !== 'SCHEDULED')) {
      throw ApiError.conflict('Cannot rebuild bracket: a match has already started');
    }
    await Match.deleteMany({ tournament: tournamentId });

    const bp = leagueBlueprint();

    // First pass: create matches keyed by code (without cross links).
    const created = {};
    for (const def of bp.matches) {
      const doc = await Match.create({
        tournament: tournamentId,
        code: def.code,
        stage: def.stage,
        label: def.label,
        order: def.order,
        teamA: def.seeds?.A ? teamByCode[def.seeds.A]?._id ?? null : null,
        teamB: def.seeds?.B ? teamByCode[def.seeds.B]?._id ?? null : null,
        source: { A: null, B: null },
        state: 'SCHEDULED',
      });
      created[def.code] = doc;
    }

    return Match.find({ tournament: tournamentId }).sort({ order: 1 });
  },

  /**
   * Get tournament progression information.
   * Returns current stage, league progress, qualified teams, etc.
   */
  async getProgress(tournamentId) {
    const t = await Tournament.findById(tournamentId);
    if (!t) throw ApiError.notFound('Tournament not found');

    const matches = await Match.find({ tournament: tournamentId }).sort({ order: 1 });
    const leagueMatches = matches.filter((m) => m.stage === STAGES.LEAGUE);
    const semiMatches = matches.filter((m) => m.stage === STAGES.SEMIFINAL);
    const finalMatch = matches.find((m) => m.stage === STAGES.FINAL);

    const leagueCompleted = leagueMatches.filter((m) =>
      ['FINISHED', 'LOCKED'].includes(m.state)
    ).length;
    const leagueTotal = leagueMatches.length;
    const leagueComplete = leagueCompleted === leagueTotal;

    let qualifiedTeams = null;
    let eliminatedTeam = null;
    let semifinalsReady = false;

    if (leagueComplete) {
      const standings = await this.getStandings(tournamentId);
      const top4 = standings.slice(0, 4);
      qualifiedTeams = top4.map((r) => ({
        rank: r.rank,
        teamId: r.teamId,
        name: r.team?.name,
        code: r.team?.code,
        points: r.points,
      }));
      if (standings.length > 4) {
        eliminatedTeam = {
          rank: standings[4].rank,
          teamId: standings[4].teamId,
          name: standings[4].team?.name,
          code: standings[4].team?.code,
          points: standings[4].points,
        };
      }
      // Semifinals are ready if they exist and both teams are resolved
      const sf1 = semiMatches.find((m) => m.code === 'SF1');
      const sf2 = semiMatches.find((m) => m.code === 'SF2');
      semifinalsReady = Boolean(sf1 && sf2 && sf1.teamA && sf1.teamB && sf2.teamA && sf2.teamB);
    }

    let sfWinners = null;
    let finalReady = false;
    if (semiMatches.length === 2) {
      const sf1 = semiMatches[0];
      const sf2 = semiMatches[1];
      if (sf1.winnerTeam && sf2.winnerTeam) {
        sfWinners = {
          sf1Winner: sf1.winnerTeam,
          sf2Winner: sf2.winnerTeam,
        };
        finalReady = Boolean(finalMatch && finalMatch.teamA && finalMatch.teamB);
      }
    }

    let champion = null;
    if (finalMatch && finalMatch.winnerTeam) {
      const team = await Team.findById(finalMatch.winnerTeam);
      champion = team ? { id: team._id, name: team.name, code: team.code } : null;
    }

    return {
      tournament: { id: t._id, name: t.name, status: t.status, rules: t.rules },
      stage: this.computeStage(leagueComplete, semiMatches, finalMatch, t.status),
      league: {
        total: leagueTotal,
        completed: leagueCompleted,
        complete: leagueComplete,
      },
      qualifiedTeams,
      eliminatedTeam,
      semifinalsReady,
      semifinals: semiMatches.map((m) => ({
        id: m._id,
        code: m.code,
        label: m.label,
        state: m.state,
        teamA: m.teamA,
        teamB: m.teamB,
        winner: m.winner,
        winnerTeam: m.winnerTeam,
      })),
      final: finalMatch
        ? {
            id: finalMatch._id,
            code: finalMatch.code,
            label: finalMatch.label,
            state: finalMatch.state,
            teamA: finalMatch.teamA,
            teamB: finalMatch.teamB,
            winner: finalMatch.winner,
            winnerTeam: finalMatch.winnerTeam,
          }
        : null,
      champion,
    };
  },

  /**
   * Compute the current tournament stage based on match states.
   */
  computeStage(leagueComplete, semiMatches, finalMatch, tournamentStatus) {
    if (tournamentStatus === 'COMPLETED') {
      return 'COMPLETED';
    }
    if (finalMatch && ['FINISHED', 'LOCKED'].includes(finalMatch.state)) {
      return 'FINAL';
    }
    if (finalMatch && finalMatch.teamA && finalMatch.teamB) {
      return 'FINAL';
    }
    if (semiMatches.length === 2 && semiMatches.every((m) => m.teamA && m.teamB)) {
      return 'SEMIFINALS';
    }
    if (leagueComplete) {
      return 'QUALIFICATION_COMPLETE';
    }
    return 'LEAGUE';
  },

  /**
   * Lock qualification after all league matches are completed.
   * Generates semifinals based on final standings.
   */
  async lockQualification(tournamentId, actor) {
    const matches = await Match.find({ tournament: tournamentId });
    const leagueMatches = matches.filter((m) => m.stage === STAGES.LEAGUE);

    const leagueCompleted = leagueMatches.filter((m) =>
      ['FINISHED', 'LOCKED'].includes(m.state)
    ).length;

    if (leagueCompleted !== leagueMatches.length) {
      throw ApiError.conflict('Not all league matches are completed');
    }

    // Compute final standings
    const standings = await this.getStandings(tournamentId);
    const qualifiedTeamIds = standings.slice(0, 4).map((r) => r.teamId);

    // Delete any existing semifinals/finals (should not exist yet)
    await Match.deleteMany({ tournament: tournamentId, stage: { $in: [STAGES.SEMIFINAL, STAGES.FINAL] } });

    // Create semifinals
    const sfDefs = semifinalBlueprint(qualifiedTeamIds);
    const created = {};
    for (const def of sfDefs) {
      const doc = await Match.create({
        tournament: tournamentId,
        code: def.code,
        stage: def.stage,
        label: def.label,
        order: def.order,
        teamA: def.seeds.A,
        teamB: def.seeds.B,
        source: {
          A: def.sources?.A ? { matchId: null, label: def.sources.A.label } : null,
          B: def.sources?.B ? { matchId: null, label: def.sources.B.label } : null,
        },
        state: 'SCHEDULED',
      });
      created[def.code] = doc;
    }

    return { qualifiedTeams: qualifiedTeamIds, semifinals: created };
  },

  /**
   * Generate the final match from completed semifinal results.
   */
  async generateFinal(tournamentId, actor) {
    const matches = await Match.find({ tournament: tournamentId }).sort({ order: 1 });
    const semiMatches = matches.filter((m) => m.stage === STAGES.SEMIFINAL);

    if (semiMatches.length !== 2) {
      throw ApiError.conflict('Both semifinals must be completed before generating the final');
    }

    const sf1 = semiMatches[0];
    const sf2 = semiMatches[1];

    if (!['FINISHED', 'LOCKED'].includes(sf1.state)) {
      throw ApiError.conflict('Semifinal 1 is not completed');
    }
    if (!['FINISHED', 'LOCKED'].includes(sf2.state)) {
      throw ApiError.conflict('Semifinal 2 is not completed');
    }

    if (!sf1.winnerTeam || !sf2.winnerTeam) {
      throw ApiError.conflict('Both semifinal winners must be determined');
    }

    // Delete any existing final
    await Match.deleteMany({ tournament: tournamentId, stage: STAGES.FINAL });

    const finalDef = finalBlueprint(sf1.winnerTeam, sf2.winnerTeam)[0];
    const doc = await Match.create({
      tournament: tournamentId,
      code: finalDef.code,
      stage: finalDef.stage,
      label: finalDef.label,
      order: finalDef.order,
      teamA: finalDef.seeds.A,
      teamB: finalDef.seeds.B,
      source: {
        A: finalDef.sources?.A ? { matchId: null, label: finalDef.sources.A.label } : null,
        B: finalDef.sources?.B ? { matchId: null, label: finalDef.sources.B.label } : null,
      },
      state: 'SCHEDULED',
    });

    return doc;
  },

  /**
   * Get standings for a tournament.
   */
  async getStandings(tournamentId) {
    const { statsService } = await import('./statsService.js');
    return statsService.standings(tournamentId);
  },

  async publish(tournamentId) {
    const t = await Tournament.findById(tournamentId);
    if (!t) throw ApiError.notFound('Tournament not found');
    t.status = 'PUBLISHED';
    await t.save();
    return t;
  },
};
