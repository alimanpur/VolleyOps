import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { scorerService } from '../../services/scorerService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { StatusBadge } from '../../components/ui/primitives.jsx';
import { slotName, STAGE_LABELS } from '../../utils/format.js';

export default function ScorerAssignments() {
  const query = useApi(() => scorerService.assignments(), [], { poll: 15000 });
  const navigate = useNavigate();
  const open = query.data?.openScoring;
  return (
    <div className="p-4">
      <h1 className="mb-1 font-display text-3xl text-ink">{open ? 'All matches' : 'Your matches'}</h1>
      {open && (
        <p className="mb-4 text-sm text-muted">
          Open scoring is on — you can score any match.
        </p>
      )}
      {!open && <div className="mb-4" />}
      <AsyncView
        query={query}
        label="Loading assignments"
        emptyWhen={(d) => d.assignments.length === 0}
        empty={
          <EmptyState
            title={open ? 'No matches yet' : 'No matches assigned'}
            hint={open ? 'Matches appear here once the bracket is built.' : 'When an admin assigns you a match, it appears here.'}
          />
        }
      >
        {(data) => (
          <ul className="space-y-3">
            {data.assignments.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => navigate(`matches/${m.id}`)}
                  className="flex w-full items-center justify-between gap-3 border border-rule bg-surface px-4 py-4 text-left transition hover:border-ink"
                  style={{ borderRadius: 'var(--radius-sm)', minHeight: 64 }}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      {m.label || STAGE_LABELS[m.stage]}
                      {m.court?.name ? ` · ${m.court.name}` : ''}
                    </span>
                    <span className="mt-0.5 block truncate font-display text-lg text-ink">
                      {slotName(m.teamA)} v {slotName(m.teamB)}
                    </span>
                  </span>
                  <StatusBadge state={m.state} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </div>
  );
}
