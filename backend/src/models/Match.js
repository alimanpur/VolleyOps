import mongoose from 'mongoose';
import { MATCH_STATES, STAGES } from '../domain/bracket.js';

const { Schema } = mongoose;

/** One completed/in-progress set's running and final score. */
const setScoreSchema = new Schema(
  {
    setNumber: { type: Number, required: true },
    a: { type: Number, default: 0 },
    b: { type: Number, default: 0 },
    winner: { type: String, enum: ['A', 'B', null], default: null },
    complete: { type: Boolean, default: false },
  },
  { _id: false }
);

/** A player on court for a team at the start of a set (starting lineup). */
const lineupEntrySchema = new Schema(
  {
    side: { type: String, enum: ['A', 'B'], required: true },
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  },
  { _id: false }
);

/** A substitution recorded during a set. */
const substitutionSchema = new Schema(
  {
    side: { type: String, enum: ['A', 'B'], required: true },
    playerOut: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    playerIn: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    setNumber: { type: Number, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** Which upstream match (if any) feeds each slot, for progression + reopen. */
const sourceSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', default: null },
    label: { type: String, default: null }, // "Winner of Round 1"
  },
  { _id: false }
);

const matchSchema = new Schema(
  {
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    // Stable bracket code (M01..M04) used to wire progression during setup.
    code: { type: String, required: true, trim: true, uppercase: true },
    stage: { type: String, enum: Object.values(STAGES), required: true },
    label: { type: String, required: true }, // "Semifinal 1"
    order: { type: Number, default: 0 }, // display + scheduling order

    teamA: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    teamB: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    // Where each slot's team comes from (null = seeded/BYE directly).
    source: {
      A: { type: sourceSchema, default: null },
      B: { type: sourceSchema, default: null },
    },
    // Where this match's winner advances.
    nextMatchId: { type: Schema.Types.ObjectId, ref: 'Match', default: null },
    nextSlot: { type: String, enum: ['A', 'B', null], default: null },

    court: { type: Schema.Types.ObjectId, ref: 'Court', default: null },
    scheduledAt: { type: Date, default: null },
    scorer: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    state: {
      type: String,
      enum: Object.values(MATCH_STATES),
      default: MATCH_STATES.SCHEDULED,
      index: true,
    },
    currentSet: { type: Number, default: 1 },
    setScores: { type: [setScoreSchema], default: [] },
    serving: { type: String, enum: ['A', 'B', null], default: null },

    winner: { type: String, enum: ['A', 'B', null], default: null },
    winnerTeam: { type: Schema.Types.ObjectId, ref: 'Team', default: null },

    lineups: { type: [lineupEntrySchema], default: [] },
    substitutions: { type: [substitutionSchema], default: [] },

    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    // Monotonic rally sequence, so events order deterministically and undo is safe.
    rallySeq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

matchSchema.index({ tournament: 1, code: 1 }, { unique: true });
matchSchema.index({ tournament: 1, state: 1 });
matchSchema.index({ scorer: 1, state: 1 });

/** Sets won per side, computed from completed sets. */
matchSchema.methods.setsWon = function setsWon() {
  return this.setScores.reduce(
    (acc, s) => {
      if (s.winner === 'A') acc.A += 1;
      else if (s.winner === 'B') acc.B += 1;
      return acc;
    },
    { A: 0, B: 0 }
  );
};

export const Match = mongoose.model('Match', matchSchema);
