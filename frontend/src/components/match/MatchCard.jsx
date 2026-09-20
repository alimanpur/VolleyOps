import { Link } from 'react-router-dom';
import { StatusBadge } from '../ui/primitives.jsx';
import { slotName, formatTime, STAGE_LABELS } from '../../utils/format.js';

/**
 * The canonical match row used on fixtures, results and team pages. Score column
 * uses tabular numerals; the winner's line is emphasised. TBD slots show their
 * source explanation rather than an empty name.
 */
export function MatchCard({ match, to, compact = false }) {
  const { teamA, teamB, setsWon, state, court, winner } = match;
  const live = state === 'LIVE';
  const done = ['FINISHED', 'LOCKED'].includes(state);

  const row = (slot, side) => {
    const isWinner = done && winner === side;
    const sets = setsWon?.[side] ?? 0;
    return (
      <div className={`flex items-center justify-between gap-3 ${isWinner ? 'text-ink' : 'text-graphite'}`}>
        <span className={`truncate ${isWinner ? 'font-semibold' : ''}`}>{slotName(slot)}</span>
        {(live || done) && (
          <span className={`tnum font-display text-xl ${isWinner ? 'text-green' : ''} ${live ? 'text-scoreRed' : ''}`}>
            {sets}
          </span>
        )}
      </div>
    );
  };

  const body = (
    <div className="border border-rule bg-surface p-4 transition hover:border-ink" style={{ borderRadius: 'var(--radius-sm)' }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          {match.label || STAGE_LABELS[match.stage]}
        </span>
        <StatusBadge state={state} />
      </div>
      <div className="space-y-1.5">
        {row(teamA, 'A')}
        {!compact && <div className="rule-t border-rule" />}
        {row(teamB, 'B')}
      </div>
      {!compact && (
        <div className="mt-3 flex items-center gap-3 rule-t border-rule pt-2 text-xs text-muted">
          {court?.name && <span>{court.name}</span>}
          {match.scheduledAt && <span>{formatTime(match.scheduledAt)}</span>}
          {live && <span className="font-semibold text-scoreRed">Set {match.currentSet}</span>}
        </div>
      )}
    </div>
  );

  return to ? (
    <Link to={to} className="block focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
