import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Append-only audit log for consequential admin/access operations: who did
 * what, when, to which target, with relevant metadata. Never updated in place.
 */
const auditEntrySchema = new Schema(
  {
    tournament: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorLabel: { type: String, default: null }, // snapshot of who, for readability
    action: { type: String, required: true }, // e.g. MATCH_REOPENED, SCORER_ASSIGNED
    targetType: { type: String, default: null }, // Match, Team, Player, User…
    targetId: { type: Schema.Types.ObjectId, default: null },
    targetLabel: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditEntrySchema.index({ tournament: 1, createdAt: -1 });

export const AuditEntry = mongoose.model('AuditEntry', auditEntrySchema);
