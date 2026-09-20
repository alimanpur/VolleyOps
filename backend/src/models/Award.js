import mongoose from 'mongoose';

const { Schema } = mongoose;

/** A single candidate considered for an award. */
const candidateSchema = new Schema(
  {
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    team: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    note: { type: String, default: null },
  },
  { _id: false }
);

/**
 * Tournament awards (Best Attacker, Best Defender, Best Setter, Best Player…).
 * Admin manages candidates and the winner; public sees an award only once it is
 * published, so nothing speculative leaks to spectators.
 */
const awardSchema = new Schema(
  {
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    key: { type: String, required: true, trim: true }, // e.g. BEST_ATTACKER
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    candidates: { type: [candidateSchema], default: [] },
    winner: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    winnerTeam: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    published: { type: Boolean, default: false },
  },
  { timestamps: true }
);

awardSchema.index({ tournament: 1, key: 1 }, { unique: true });

export const Award = mongoose.model('Award', awardSchema);
