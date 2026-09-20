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
  const progress = useApi(() => adminService.progress(), []);

  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState({});
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState(null);
  const [actionError, setActionError] = useState(null);

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
      await progress.refetch({ quiet: true });
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
      await progress.refetch({ quiet: true });
    } catch (err) {
      setBuildError(err?.message || 'Could not build the bracket.');
    } finally {
      setBuilding(false);
    }
  }

  async function onLockQualification() {
    if (!window.confirm('Lock qualification and generate semifinals? This cannot be undone.')) return;
    setActionError(null);
    try {
      await adminService.lockQualification();
      await query.refetch({ quiet: true });
      await progress.refetch({ quiet: true });
    } catch (err) {
      setActionError(err?.message || 'Could not lock qualification.');
    }
  }

  async function onGenerateFinal() {
    if (!window.confirm('Generate the final from the completed semifinals?')) return;
    setActionError(null);
    try {
      await adminService.generateFinal();
      await query.refetch({ quiet: true });
      await progress.refetch({ quiet: true });
    } catch (err) {
      setActionError(err?.message || 'Could not generate final.');
    }
  }

  async function onCompleteTournament() {
    if (!window.confirm('Mark tournament as complete? This locks all operations.')) return;
    setActionError(null);
    try {
      await adminService.completeTournament();
      await query.refetch({ quiet: true });
      await progress.refetch({ quiet: true });
    } catch (err) {
      setActionError(err?.message || 'Could not complete tournament.');
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
      {actionError && (
        <p className="border border-scoreRed bg-surface px-3 py-2 text-sm text-scoreRed" style={{ borderRadius: 'var(--radius-sm)' }}>
          {actionError}
        </p>
      )}

      <AsyncView
        query={progress}
        label="Loading tournament progress"
      >
        {(progData) => <ProgressPanel data={progData} onLockQualification={onLockQualification} onGenerateFinal={onGenerateFinal} onCompleteTournament={onCompleteTournament} />}
      </AsyncView>

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

function ProgressPanel({ data, onLockQualification, onGenerateFinal, onCompleteTournament }) {
  if (!data) return null;
  const { stage, league, qualifiedTeams, eliminatedTeam, semifinals, final, champion } = data;

  return (
    <div className="space-y-6 border border-rule bg-surface p-6" style={{ borderRadius: 'var(--radius-sm)' }}>
      <h3 className="font-display text-xl text-ink">Tournament Progress</h3>

      {/* Current Stage */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Current Stage:</span>
        <StageBadge stage={stage} />
      </div>

      {/* League Progress */}
      {league && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">League Progress</p>
          <div className="flex items-center gap-4">
            <div className="h-2 flex-1 overflow-hidden bg-paper" style={{ borderRadius: 'var(--radius-xs)' }}>
              <div
                className="h-full bg-green transition-all"
                style={{ width: `${(league.completed / league.total) * 100}%`, borderRadius: 'var(--radius-xs)' }}
              />
            </div>
            <span className="text-sm font-semibold text-ink tabular-nums">{league.completed} / {league.total}</span>
          </div>
          <p className="text-xs text-muted">{league.completed === league.total ? 'League stage complete' : `${league.total - league.completed} matches remaining`}</p>
        </div>
      )}

      {/* Qualified Teams */}
      {qualifiedTeams && qualifiedTeams.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-green">Qualified Teams</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {qualifiedTeams.map((t) => (
              <div key={t.teamId} className="border border-rule px-3 py-2" style={{ borderRadius: 'var(--radius-xs)' }}>
                <p className="text-xs text-muted">#{t.rank}</p>
                <p className="text-sm font-medium text-ink">{t.name}</p>
                <p className="text-xs text-muted">{t.points} pts</p>
              </div>
            ))}
          </div>
          {eliminatedTeam && (
            <div className="mt-2 border border-scoreRed px-3 py-2" style={{ borderRadius: 'var(--radius-xs)' }}>
              <p className="text-xs text-scoreRed">Eliminated</p>
              <p className="text-sm font-medium text-ink">#{eliminatedTeam.rank} {eliminatedTeam.name}</p>
            </div>
          )}
        </div>
      )}

      {/* Semifinals */}
      {semifinals && semifinals.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">Semifinals</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {semifinals.map((sf) => (
              <div key={sf.id} className="border border-rule px-3 py-2" style={{ borderRadius: 'var(--radius-xs)' }}>
                <p className="text-xs text-muted">{sf.label}</p>
                <p className="text-sm text-ink">{slotName(sf.teamA)} vs {slotName(sf.teamB)}</p>
                <StatusBadge state={sf.state} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final */}
      {final && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">Final</p>
          <div className="border border-rule px-3 py-2" style={{ borderRadius: 'var(--radius-xs)' }}>
            <p className="text-xs text-muted">{final.label}</p>
            <p className="text-sm text-ink">{slotName(final.teamA)} vs {slotName(final.teamB)}</p>
            <StatusBadge state={final.state} />
          </div>
        </div>
      )}

      {/* Champion */}
      {champion && (
        <div className="border border-green px-3 py-2" style={{ borderRadius: 'var(--radius-xs)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-green">Champion</p>
          <p className="text-lg font-display text-ink">{champion.name}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {stage === 'QUALIFICATION_COMPLETE' && (
          <Button variant="primary" onClick={onLockQualification}>Lock Qualification & Generate Semifinals</Button>
        )}
        {stage === 'SEMIFINALS' && semifinals && semifinals.length === 2 && semifinals.every((sf) => sf.winner) && (
          <Button variant="primary" onClick={onGenerateFinal}>Generate Final</Button>
        )}
        {stage === 'FINAL' && final && ['FINISHED', 'LOCKED'].includes(final.state) && (
          <Button variant="primary" onClick={onCompleteTournament}>Complete Tournament</Button>
        )}
      </div>
    </div>
  );
}

function StageBadge({ stage }) {
  const labels = {
    LEAGUE: 'League Stage',
    QUALIFICATION_COMPLETE: 'Qualification Complete',
    SEMIFINALS: 'Semifinals',
    FINAL: 'Final',
    COMPLETED: 'Completed',
  };
  const colors = {
    LEAGUE: 'bg-paper text-ink border-rule',
    QUALIFICATION_COMPLETE: 'bg-green/10 text-green border-green',
    SEMIFINALS: 'bg-amber/10 text-amber border-amber',
    FINAL: 'bg-deepGreen/10 text-deepGreen border-deepGreen',
    COMPLETED: 'bg-scoreRed/10 text-scoreRed border-scoreRed',
  };
  return (
    <span className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${colors[stage] || colors.LEAGUE}`} style={{ borderRadius: 'var(--radius-xs)' }}>
      {labels[stage] || stage}
    </span>
  );
}

function MatchRow({
  match, scorers, courtList, busy, error,
  onSetCourt, onSetTime, onAssignScorer, onReopen, onReset, onLock, onCancel,
}) {
  const { state } = match;
  const finished = ['FINISHED', 'LOCKED'].includes(state);
  const cancelled = state === 'CANCELLED';
  const resettable = ['PRE_MATCH', 'LIVE', 'SET_COMPLETE', 'MATCH_DECIDED', 'FINISHED'].includes(state);
  const [scorerSel, setScorerSel] = useState('');

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
