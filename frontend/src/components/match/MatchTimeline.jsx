import { slotName, POINT_TYPE_LABELS } from '../../utils/format.js';

/*
 * Rally-by-rally timeline, grouped by set. Reused by the public match center,
 * captain match view and scorer history sheet. Honest empty state when nothing
 * has been recorded, and a clear explanation when a team slot is unresolved.
 */
export function MatchTimeline({ timeline = [], match }) {
  if (match) {
    for (const slot of [match.teamA, match.teamB]) {
      if (slot?.tbd) {
        return (
          <div className="border border-rule bg-surface p-5 text-sm text-muted" style={{ borderRadius: 'var(--radius-sm)' }}>
            Waiting for {slot.label}. The rally timeline appears once both teams are set.
          </div>
        );
      }
    }
  }

  if (timeline.length === 0) {
    return (
      <div className="border border-rule bg-surface p-5 text-sm text-muted" style={{ borderRadius: 'var(--radius-sm)' }}>
        No rallies recorded yet.
      </div>
    );
  }

  // Group by set, newest set last.
  const bySet = new Map();
  for (const e of timeline) {
    if (!bySet.has(e.setNumber)) bySet.set(e.setNumber, []);
    bySet.get(e.setNumber).push(e);
  }
  const sets = [...bySet.keys()].sort((a, b) => a - b);

  const nameA = match ? slotName(match.teamA) : 'Team A';
  const nameB = match ? slotName(match.teamB) : 'Team B';

  return (
    <div className="space-y-5">
      {sets.map((setNumber) => (
        <div key={setNumber}>
          <h3 className="mb-2 rule-b border-rule pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Set {setNumber}
          </h3>
          <ul>
            {[...bySet.get(setNumber)].reverse().map((e) => (
              <li key={e.id} className="flex items-center gap-3 rule-b border-rule py-2 text-sm last:border-0">
                <span className="tnum w-14 shrink-0 font-display text-base text-ink">
                  {e.scoreAfter.a}–{e.scoreAfter.b}
                </span>
                <span className={`shrink-0 text-xs font-semibold uppercase ${e.winner === 'A' ? 'text-green' : 'text-amber'}`}>
                  {e.winner === 'A' ? nameA : nameB}
                </span>
                <span className="flex-1 truncate text-muted">
                  {POINT_TYPE_LABELS[e.pointType] || 'Point'}
                  {e.player ? ` · ${e.player.name}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
