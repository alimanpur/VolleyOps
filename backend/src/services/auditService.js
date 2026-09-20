import { AuditEntry } from '../models/index.js';

/** Record a consequential action. Fire-and-forget friendly but awaited by callers. */
export async function recordAudit({ tournament, actor, actorLabel, action, targetType, targetId, targetLabel, metadata }) {
  return AuditEntry.create({
    tournament,
    actor: actor || null,
    actorLabel: actorLabel || null,
    action,
    targetType: targetType || null,
    targetId: targetId || null,
    targetLabel: targetLabel || null,
    metadata: metadata || null,
  });
}
