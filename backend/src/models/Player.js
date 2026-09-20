import mongoose from 'mongoose';
import { PLAYER_STATUS } from '../domain/roster.js';

const { Schema } = mongoose;

const playerSchema = new Schema(
  {
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    name: { type: String, required: true, trim: true },
    jerseyNumber: { type: Number, default: null },
    // Academic year, validated against the team's year for eligibility.
    year: { type: Number, min: 1, max: 4, required: true },
    position: {
      type: String,
      enum: ['SETTER', 'OUTSIDE', 'MIDDLE', 'OPPOSITE', 'LIBERO', 'UNSPECIFIED'],
      default: 'UNSPECIFIED',
    },
    status: {
      type: String,
      enum: Object.values(PLAYER_STATUS),
      default: PLAYER_STATUS.ACTIVE,
      index: true,
    },
    isCaptain: { type: Boolean, default: false },
    photoUrl: { type: String, default: null },
  },
  { timestamps: true }
);

playerSchema.index({ team: 1, jerseyNumber: 1 });

export const Player = mongoose.model('Player', playerSchema);
