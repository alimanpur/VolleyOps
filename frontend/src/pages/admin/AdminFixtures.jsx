import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { Bracket } from '../../components/match/Bracket.jsx';
import { SectionHead, Button, StatusBadge } from '../../components/ui/primitives.jsx';
import { slotName, STAGE_LABELS } from '../../utils/format.js';

/*
 * The operational fixtures desk. A live bracket up top, then one dense table of
 * every match with inline controls: set court + kick-off, assign a scorer,
 * reopen / lock a finished match, or cancel. Destructive or state-changing
 * actions confirm first; conflicts from the server surface inline on the row.
 */
export default function AdminFixtures() {
  const query = useApi(() => adminService.matches(), []);
  const access = useApi(() => adminService.access(), []);
  const courts = useApi(() => adminService.courts(), []);

  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState({});
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState(null);

  const scorers = (access.data?.users || []).filter((u) => u.role === 'SCORER');
  const courtList = courts.data?.courts || [];

  function setError(id, message) {
    setRowError((prev) => ({ ...prev, [id]: message }));
  }

  async function run(id, fn) {
    setBusyId(id);
    setError(id, null);
    try {
      await fn();
      await query.refetch({ quiet: true });
    } catch (err) {
      setError(id, err?.message || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function onBuildBracket() {
    if (!window.confirm('Build the bracket from the current teams and seeds? This regenerates fixtures.')) return;
    setBuilding(true);
    setBuildError(null);
    try {
      await adminService.buildBracket();
      await query.refetch({ quiet: true });
    } catch (err) {
      setBuildError(err?.message || 'Could not build the bracket.');
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="space-y-8">
      <SectionHead
        kicker="Schedule"
        title="Fixtures"
        action={
          <Button variant="outline" onClick={onBuildBracket} disabled={building}>
            {building ? 'Building…' : 'Build bracket'}
          </Button>
        }
      />
      {buildError && (
        <p className="border border-scoreRed bg-surface px-3 py-2 text-sm text-scoreRed" style={{ borderRadius: 'var(--radius-sm)' }}>
          {buildError}
        </p>
      )}

      <AsyncView
        query={query}
        label="Loading fixtures"
        emptyWhen={(d) => !d.matches?.length}
        empty={
          <EmptyState
            title="No fixtures yet"
            hint="Build the bracket once teams and seeds are in place."
            action={<Button variant="primary" onClick={onBuildBracket} disabled={building}>Build bracket</Button>}
          />
        }
      >
        {({ matches }) => (
          <div className="space-y-10">
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green">Bracket</p>
              <Bracket matches={matches} />
            </section>

            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green">All matches</p>
              <div className="scroll-x border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
                <table className="w-full min-w-[64rem] text-sm">
                  <thead>
                    <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                      <th scope="col" className="px-3 py-2.5 font-semibold">Code</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Match</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Teams</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Court</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Kick-off</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">Scorer</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m) => (
                      <MatchRow
                        key={m.id}
                        match={m}
                        scorers={scorers}
                        courtList={courtList}
                        busy={busyId === m.id}
                        error={rowError[m.id]}
                        onSetCourt={(court) => run(m.id, () => adminService.updateMatch(m.id, { court }))}
                        onSetTime={(scheduledAt) => run(m.id, () => adminService.updateMatch(m.id, { scheduledAt }))}
                        onAssignScorer={(scorerId) => run(m.id, () => adminService.assignScorer(m.id, scorerId))}
                        onReopen={() =>
                          window.confirm(`Reopen ${m.label}? This reverts it to a scorable state.`) &&
                          run(m.id, () => adminService.reopenMatch(m.id))
                        }
                        onReset={() =>
                          window.confirm(
                            `Reset ${m.label}? This erases every point, set, and lineup and returns the match to Scheduled. This cannot be undone.`
                          ) && run(m.id, () => adminService.resetMatch(m.id))
                        }
                        onLock={() =>
                          window.confirm(`Lock ${m.label}? The result becomes final.`) &&
                          run(m.id, () => adminService.lockMatch(m.id))
                        }
                        onCancel={() =>
                          window.confirm(`Cancel ${m.label}? This marks the match cancelled.`) &&
                          run(m.id, () => adminService.cancelMatch(m.id))
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </AsyncView>
    </div>
  );
}

function MatchRow({
  match, scorers, courtList, busy, error,
  onSetCourt, onSetTime, onAssignScorer, onReopen, onReset, onLock, onCancel,
}) {
  const { state } = match;
  const finished = ['FINISHED', 'LOCKED'].includes(state);
  const cancelled = state === 'CANCELLED';
  // A match that has begun but isn't locked can be hard-reset to Scheduled —
  // the escape hatch for a match started by mistake. LOCKED must be reopened first.
  const resettable = ['PRE_MATCH', 'LIVE', 'SET_COMPLETE', 'MATCH_DECIDED', 'FINISHED'].includes(state);
  const [scorerSel, setScorerSel] = useState('');

  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const dtValue = match.scheduledAt ? toLocalInput(match.scheduledAt) : '';

  return (
    <>
      <tr className="rule-b border-rule align-top last:border-0">
        <td className="px-3 py-3 font-mono text-xs text-muted">{match.code}</td>
        <td className="px-3 py-3">
          <span className="font-medium text-ink">{match.label || STAGE_LABELS[match.stage]}</span>
        </td>
        <td className="px-3 py-3 text-graphite">
          <div className="truncate">{slotName(match.teamA)}</div>
          <div className="truncate text-muted">{slotName(match.teamB)}</div>
        </td>
        <td className="px-3 py-3">
          <label className="sr-only" htmlFor={`court-${match.id}`}>Court for {match.label}</label>
          <select
            id={`court-${match.id}`}
            value={match.court?.id || ''}
            disabled={busy || cancelled}
            onChange={(e) => onSetCourt(e.target.value)}
            className="w-32 border border-rule bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-ink disabled:opacity-50"
            style={{ borderRadius: 'var(--radius-xs)' }}
          >
            <option value="">— Unassigned —</option>
            {courtList.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </td>
        <td className="px-3 py-3">
          <label className="sr-only" htmlFor={`time-${match.id}`}>Kick-off for {match.label}</label>
          <input
            id={`time-${match.id}`}
            type="datetime-local"
            defaultValue={dtValue}
            disabled={busy || cancelled}
            onBlur={(e) => {
              const v = e.target.value;
              const iso = v ? new Date(v).toISOString() : '';
              const current = match.scheduledAt ? new Date(match.scheduledAt).toISOString() : '';
              if (iso !== current) onSetTime(iso);
            }}
            className="tnum w-44 border border-rule bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-ink disabled:opacity-50"
            style={{ borderRadius: 'var(--radius-xs)' }}
          />
        </td>
        <td className="px-3 py-3"><StatusBadge state={state} /></td>
        <td className="px-3 py-3">
          {match.hasScorer ? (
            <span className="text-xs font-semibold text-green">Assigned</span>
          ) : cancelled ? (
            <span className="text-xs text-muted">—</span>
          ) : (
            <div className="flex items-center gap-1">
              <label className="sr-only" htmlFor={`scorer-${match.id}`}>Assign scorer to {match.label}</label>
              <select
                id={`scorer-${match.id}`}
                value={scorerSel}
                disabled={busy || scorers.length === 0}
                onChange={(e) => setScorerSel(e.target.value)}
                className="w-32 border border-rule bg-paper px-2 py-1 text-xs text-ink outline-none focus:border-ink disabled:opacity-50"
                style={{ borderRadius: 'var(--radius-xs)' }}
              >
                <option value="">{scorers.length ? 'Pick scorer' : 'No scorers'}</option>
                {scorers.map((s) => (
                  <option key={s.id} value={s.id}>{s.displayName}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !scorerSel}
                onClick={() => onAssignScorer(scorerSel)}
                className="border border-ink px-2 py-1 text-xs font-medium text-ink transition hover:bg-ink hover:text-paper disabled:opacity-40"
                style={{ borderRadius: 'var(--radius-xs)' }}
              >
                Assign
              </button>
            </div>
          )}
        </td>
        <td className="px-3 py-3">
          <div className="flex justify-end gap-1.5">
            {finished && (
              <>
                <ActionBtn onClick={onReopen} disabled={busy}>Reopen</ActionBtn>
                {state === 'FINISHED' && <ActionBtn onClick={onLock} disabled={busy}>Lock</ActionBtn>}
              </>
            )}
            {resettable && <ActionBtn onClick={onReset} disabled={busy} danger>Reset</ActionBtn>}
            {!finished && !cancelled && (
              <ActionBtn onClick={onCancel} disabled={busy} danger>Cancel</ActionBtn>
            )}
          </div>
        </td>
      </tr>
      {error && (
        <tr className="rule-b border-rule">
          <td colSpan={8} className="px-3 pb-3">
            <p className="text-xs font-medium text-scoreRed">{error}</p>
          </td>
        </tr>
      )}
    </>
  );
}

function ActionBtn({ onClick, disabled, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border px-2 py-1 text-xs font-medium transition disabled:opacity-40 ${
        danger
          ? 'border-scoreRed text-scoreRed hover:bg-scoreRed hover:text-white'
          : 'border-rule text-graphite hover:border-ink hover:text-ink'
      }`}
      style={{ borderRadius: 'var(--radius-xs)' }}
    >
      {children}
    </button>
  );
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
