import mongoose from 'mongoose';

const { Schema } = mongoose;

const teamSchema = new Schema(
  {
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    // Stable, human-readable code used to wire the bracket during setup.
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true },
    // Academic year the team represents; players must match it.
    year: { type: Number, min: 1, max: 4, required: true },
    // Denormalised captain pointer for quick lookups; source of truth is the
    // Player.isCaptain flag, kept consistent by the team service.
    captain: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    seed: { type: Number, default: null },
    colorToken: { type: String, default: 'graphite' },
  },
  { timestamps: true }
);

teamSchema.index({ tournament: 1, code: 1 }, { unique: true });

export const Team = mongoose.model('Team', teamSchema);
