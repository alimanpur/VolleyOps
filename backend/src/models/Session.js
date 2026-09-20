import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Server-side session. The client only holds an opaque, HTTP-only cookie
 * carrying the session id; all authority lives here. A TTL index expires
 * sessions automatically. Keeping sessions server-side lets us invalidate on
 * logout, code regeneration, or "one active session" enforcement.
 */
const sessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['ADMIN', 'CAPTAIN', 'SCORER'], required: true },
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
    team: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    userAgent: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index — Mongo removes the document once expiresAt passes.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model('Session', sessionSchema);
