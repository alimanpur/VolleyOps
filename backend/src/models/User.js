import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * An access identity. Three roles:
 *   ADMIN   - password login (passwordHash set)
 *   CAPTAIN - scoped to one team, redeems an invitation code
 *   SCORER  - assigned to matches, redeems an access code
 *
 * Invitation/access codes are never stored in plaintext — only inviteCodeHash.
 * Regenerating a code bumps codeVersion and replaces the hash, invalidating the
 * previous code. `redeemedAt` marks a one-time code as spent.
 */
const userSchema = new Schema(
  {
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    role: { type: String, enum: ['ADMIN', 'CAPTAIN', 'SCORER'], required: true, index: true },
    displayName: { type: String, required: true, trim: true },

    // Admin auth
    username: { type: String, trim: true, lowercase: true, default: null },
    passwordHash: { type: String, default: null },

    // Captain scope
    team: { type: Schema.Types.ObjectId, ref: 'Team', default: null },

    // Invitation / access code (captain + scorer)
    inviteCodeHash: { type: String, default: null },
    codeVersion: { type: Number, default: 0 },
    codeIssuedAt: { type: Date, default: null },
    redeemedAt: { type: Date, default: null },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Only admins have a username; captains/scorers store username: null. A plain
// sparse unique index does NOT help because the field is present-but-null on
// every code-based user, so they'd all collide on null. A partial index scopes
// the uniqueness to documents where username is actually a string.
userSchema.index(
  { tournament: 1, username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } }
);

export const User = mongoose.model('User', userSchema);
