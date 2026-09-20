import { Tournament, Team, Match } from '../models/index.js';
import { bracketBlueprint } from '../domain/bracket.js';
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
   * Build (or rebuild) the bracket for a tournament from the blueprint. Wires
   * each match's seeds, sources, nextMatchId/nextSlot. Idempotent per code:
   * re-running before any match starts is safe. Refuses to rebuild if any match
   * has started, to avoid corrupting a live event.
   */
  async buildBracket(tournamentId) {
    const teams = await Team.find({ tournament: tournamentId });
    const teamByCode = Object.fromEntries(teams.map((t) => [t.code, t]));

    const existing = await Match.find({ tournament: tournamentId });
    if (existing.some((m) => m.state !== 'SCHEDULED')) {
      throw ApiError.conflict('Cannot rebuild bracket: a match has already started');
    }
    await Match.deleteMany({ tournament: tournamentId });

    const bp = bracketBlueprint();

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
        source: {
          A: def.sources?.A ? { matchId: null, label: def.sources.A.label } : null,
          B: def.sources?.B ? { matchId: null, label: def.sources.B.label } : null,
        },
        state: 'SCHEDULED',
      });
      created[def.code] = doc;
    }

    // Second pass: wire nextMatchId/nextSlot and source.matchId now that ids exist.
    for (const def of bp.matches) {
      const doc = created[def.code];
      if (def.feeds?.winnerTo) {
        const target = created[def.feeds.winnerTo.matchCode];
        doc.nextMatchId = target._id;
        doc.nextSlot = def.feeds.winnerTo.slot;
        await doc.save();
      }
      // Resolve source match ids on downstream matches.
      for (const slot of ['A', 'B']) {
        const src = def.sources?.[slot];
        if (src?.matchCode) {
          doc.source[slot] = { matchId: created[src.matchCode]._id, label: src.label };
        }
      }
      await doc.save();
    }

    return Match.find({ tournament: tournamentId }).sort({ order: 1 });
  },

  async publish(tournamentId) {
    const t = await Tournament.findById(tournamentId);
    if (!t) throw ApiError.notFound('Tournament not found');
    t.status = 'PUBLISHED';
    await t.save();
    return t;
  },
};
