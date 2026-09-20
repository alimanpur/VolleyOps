import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A notification targeted at a role/team/user. Read state is tracked per
 * recipient user in `readBy`. Audience lets a captain see team notices and an
 * admin see admin notices without a separate collection per role.
 */
const notificationSchema = new Schema(
  {
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    type: {
      type: String,
      enum: ['FIXTURE', 'MATCH', 'ROSTER', 'AWARD', 'ADMIN', 'GENERAL'],
      default: 'GENERAL',
    },
    audience: { type: String, enum: ['ADMIN', 'CAPTAIN', 'SCORER', 'ALL'], default: 'ALL', index: true },
    team: { type: Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    title: { type: String, required: true },
    body: { type: String, default: null },
    match: { type: Schema.Types.ObjectId, ref: 'Match', default: null },
    readBy: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
  },
  { timestamps: true }
);

notificationSchema.index({ tournament: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
