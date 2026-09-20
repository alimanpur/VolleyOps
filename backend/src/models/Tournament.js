import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * The tournament itself. A single active tournament drives the app, but the
 * model supports more than one so admins can archive past events. All event
 * metadata (name, dates, venue) lives here — never hardcoded in the frontend.
 */
const tournamentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    venue: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startTimeNote: { type: String, trim: true }, // e.g. "Matches begin after 3:00 PM"
    timezone: { type: String, default: 'Asia/Kolkata' },
    rules: {
      bestOf: { type: Number, default: 3 },
      pointsPerSet: { type: Number, default: 25 },
      pointsFinalSet: { type: Number, default: 15 },
      winBy: { type: Number, default: 2 },
    },
    // Open scoring: when true, ANY user with the SCORER role may open and score
    // ANY match, ignoring per-match assignment. Reversible at any time. Suits a
    // single-scorer event where assigning every fixture by hand is friction.
    // When false (default), scorers are restricted to matches assigned to them.
    openScoring: { type: Boolean, default: false },
    // Publishing gate: public pages only surface a published tournament.
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'COMPLETED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Tournament = mongoose.model('Tournament', tournamentSchema);
