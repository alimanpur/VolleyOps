import { useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { Scoreboard } from '../../components/match/Scoreboard.jsx';
import { StatusBadge } from '../../components/ui/primitives.jsx';
import { slotName, formatTime, POINT_TYPE_LABELS, STAGE_LABELS } from '../../utils/format.js';

/*
 * The match center. A big scoreboard, the meta line (stage, court, status), and
 * the rally-by-rally timeline grouped by set. Polls every 12s so a live match
 * updates in place. Unresolved slots explain what they're waiting for.
 */
export default function MatchCenterPage() {
  const { matchId } = useParams();
  const query = useApi(() => publicService.match(matchId), [matchId], { poll: 12000 });

  return (
    <div className="space-y-8">
      <AsyncView query={query} label="Loading match">
        {({ match, timeline = [] }) => {
          const waiting = [];
          if (match.teamA?.tbd) waiting.push(slotName(match.teamA));
          if (match.teamB?.tbd) waiting.push(slotName(match.teamB));
          return (
            <div className="space-y-8">
              <header className="rule-b border-rule pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green">
                    {match.label || STAGE_LABELS[match.stage] || 'Match'}
                  </p>
                  <StatusBadge state={match.state} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
                  {match.court?.name && <span>{match.court.name}</span>}
                  {match.scheduledAt && <span>{formatTime(match.scheduledAt)}</span>}
                  {match.state === 'LIVE' && (
                    <span className="font-semibold text-scoreRed">Set {match.currentSet}</span>
                  )}
                </div>
              </header>

              <Scoreboard match={match} />

              {waiting.length > 0 && (
                <p className="text-sm italic text-muted">
                  Waiting for {waiting.join(' and ')}.
                </p>
              )}

              <section>
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-green">Rally timeline</p>
                <Timeline timeline={timeline} match={match} />
              </section>
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}

function Timeline({ timeline, match }) {
  if (!timeline.length) {
    return (
      <EmptyState
        title="No rallies recorded yet"
        hint={
          match.state === 'SCHEDULED' || match.state === 'PRE_MATCH'
            ? 'The play-by-play will fill in once the match starts.'
            : 'Points will appear here as they are scored.'
        }
      />
    );
  }

  const sideName = (side) => slotName(side === 'A' ? match.teamA : match.teamB);

  // Group by set, most recent set first, newest rally first within a set.
  const bySet = new Map();
  timeline.forEach((e) => {
    if (!bySet.has(e.setNumber)) bySet.set(e.setNumber, []);
    bySet.get(e.setNumber).push(e);
  });
  const sets = [...bySet.entries()].sort((a, b) => b[0] - a[0]);

  return (
    <div className="space-y-6">
      {sets.map(([setNumber, events]) => (
        <div key={setNumber}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Set {setNumber}</h4>
          <ol className="border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
            {[...events].sort((a, b) => b.seq - a.seq).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 rule-b border-rule px-4 py-2.5 last:border-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="tnum shrink-0 font-display text-lg text-ink">
                    {e.scoreAfter.a}–{e.scoreAfter.b}
                  </span>
                  <div className="min-w-0 text-sm">
                    <span className="text-graphite">{POINT_TYPE_LABELS[e.pointType] || 'Point'}</span>
                    {e.player?.name && <span className="text-muted"> · {e.player.name}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-green">
                  {sideName(e.winner)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
