import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { scorerService } from '../../services/scorerService.js';
import { useScoringOutbox } from '../../hooks/useScoringOutbox.js';
import { AsyncView } from '../../components/ui/states.jsx';
import { MatchTimeline } from '../../components/match/MatchTimeline.jsx';
import { slotName, STAGE_LABELS } from '../../utils/format.js';
import LineupScreen from './LineupScreen.jsx';
import AttributionSheet from './AttributionSheet.jsx';
import SubstitutionSheet from './SubstitutionSheet.jsx';

/*
 * THE SCORING CONSOLE — mobile portrait, one-thumb operation.
 *
 * The server is the single source of truth for set/match completion. The console
 * never decides a set is over; it enqueues rallies and reconciles to whatever the
 * server returns (via the outbox onSynced hook). Points survive going offline.
 */
export default function ScorerConsole() {
  const { matchId } = useParams();
  const query = useApi(() => scorerService.match(matchId), [matchId]);
  return (
    <AsyncView query={query} label="Loading match">
      {(data) => <Console matchId={matchId} initial={data} />}
    </AsyncView>
  );
}

const NEEDS_LINEUP = ['SCHEDULED', 'PRE_MATCH'];

function Console({ matchId, initial }) {
  const navigate = useNavigate();
  const [match, setMatch] = useState(initial.match);
  const [onCourt, setOnCourt] = useState(initial.onCourt);
  const [roster] = useState(initial.roster);
  const [timeline, setTimeline] = useState(initial.timeline || []);
  const [sheet, setSheet] = useState(null); // 'attr:A' | 'attr:B' | 'sub' | 'history'
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Reconcile to server truth whenever a rally / undo response comes back.
  const onSynced = useCallback((res) => {
    if (res.match) setMatch(res.match);
    if (res.timeline) setTimeline(res.timeline);
    if (res.onCourt) setOnCourt(res.onCourt);
  }, []);

  const { enqueue, undo, pending, syncing, error: syncError, online, clearError } = useScoringOutbox(matchId, {
    onSynced,
  });

  const scorable = match.state === 'LIVE';
  const decided = ['MATCH_DECIDED', 'FINISHED', 'LOCKED'].includes(match.state);

  // ---- lineup + start ----
  const startMatch = async (sel) => {
    setBusy(true);
    setActionError(null);
    try {
      await scorerService.setLineups(matchId, { a: sel.A, b: sel.B });
      const res = await scorerService.start(matchId);
      setMatch(res.match);
      const fresh = await scorerService.match(matchId);
      setOnCourt(fresh.onCourt);
      setTimeline(fresh.timeline || []);
    } catch (err) {
      setActionError(err.message || 'Could not start the match');
    } finally {
      setBusy(false);
    }
  };

  if (NEEDS_LINEUP.includes(match.state)) {
    return <LineupScreen match={match} roster={roster} onStart={startMatch} busy={busy} error={actionError} />;
  }

  // ---- scoring ----
  const confirmPoint = (payload) => {
    setSheet(null);
    enqueue(payload);
  };

  const doSub = async (payload) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await scorerService.substitute(matchId, payload);
      if (res.match) setMatch(res.match);
      if (res.onCourt) setOnCourt(res.onCourt);
      setSheet(null);
    } catch (err) {
      setActionError(err.message || 'Substitution failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <TopBar match={match} pending={pending} syncing={syncing} online={online} onBack={() => navigate('/scorer')} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <LiveScoreboard match={match} />

        {syncError && (
          <SyncBanner message={syncError} online={online} onDismiss={clearError} />
        )}

        {decided ? (
          <DecidedNotice match={match} />
        ) : (
          <PointControls match={match} disabled={!scorable} onPoint={(side) => setSheet(`attr:${side}`)} />
        )}

        <RallyStrip timeline={timeline} match={match} onAddDetail={() => setSheet('history')} />
      </div>

      <BottomDock
        disabled={!scorable}
        onUndo={undo}
        onHistory={() => setSheet('history')}
        onSub={() => setSheet('sub')}
        busy={syncing || busy}
        online={online}
      />

      {sheet?.startsWith('attr:') && (
        <AttributionSheet
          winner={sheet.split(':')[1]}
          match={match}
          onCourt={onCourt}
          onConfirm={confirmPoint}
          onCancel={() => setSheet(null)}
        />
      )}
      {sheet === 'sub' && (
        <SubstitutionSheet
          match={match}
          onCourt={onCourt}
          roster={roster}
          setNumber={match.currentSet}
          onConfirm={doSub}
          onCancel={() => setSheet(null)}
          busy={busy}
          error={actionError}
        />
      )}
      {sheet === 'history' && (
        <HistorySheet timeline={timeline} match={match} onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

/* ---------- top bar ---------- */
function TopBar({ match, pending, syncing, online, onBack }) {
  const label = match.label || STAGE_LABELS[match.stage] || 'Match';
  return (
    <div className="flex items-center justify-between rule-b border-rule bg-surface px-4 py-2">
      <button type="button" onClick={onBack} className="text-sm text-muted hover:text-ink" aria-label="Back to matches">
        ‹ Matches
      </button>
      <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
        {match.court?.name ? ` · ${match.court.name}` : ''}
      </span>
      <SyncPill pending={pending} syncing={syncing} online={online} />
    </div>
  );
}

function SyncPill({ pending, syncing, online }) {
  let text = 'Synced';
  let tone = 'text-green';
  if (!online) {
    text = pending > 0 ? `Offline · ${pending}` : 'Offline';
    tone = 'text-amber';
  } else if (pending > 0 || syncing) {
    text = `Syncing ${pending || ''}`.trim();
    tone = 'text-amber';
  }
  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${online ? 'bg-green' : 'bg-amber'} ${syncing ? 'live-dot' : ''}`} />
      {text}
    </span>
  );
}

/* ---------- live scoreboard (current set is the hero) ---------- */
function LiveScoreboard({ match }) {
  const { teamA, teamB, setsWon = { A: 0, B: 0 }, serving, currentSet, setScores = [] } = match;
  const live = setScores.find((s) => s.setNumber === currentSet && !s.complete)
    || setScores[setScores.length - 1]
    || { a: 0, b: 0, setNumber: currentSet || 1 };

  const row = (slot, side) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {serving === side && match.state === 'LIVE' && (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-scoreRed live-dot" aria-label="serving" />
        )}
        <span className="truncate font-display text-xl text-ink">{slotName(slot)}</span>
        <span className="tnum shrink-0 text-xs text-muted">({setsWon[side] ?? 0})</span>
      </div>
      <span className="tnum font-display text-5xl leading-none text-ink">{side === 'A' ? live.a : live.b}</span>
    </div>
  );

  return (
    <div className="border border-rule bg-surface px-4 py-1" style={{ borderRadius: 'var(--radius-sm)' }}>
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Set {live.setNumber}</span>
        <SetChips setScores={setScores} />
      </div>
      {row(teamA, 'A')}
      <div className="rule-t border-rule" />
      {row(teamB, 'B')}
    </div>
  );
}

function SetChips({ setScores }) {
  const done = setScores.filter((s) => s.complete);
  if (done.length === 0) return null;
  return (
    <div className="flex gap-2">
      {done.map((s) => (
        <span key={s.setNumber} className="tnum text-xs text-muted">
          {s.a}–{s.b}
        </span>
      ))}
    </div>
  );
}

/* ---------- point controls ---------- */
function PointControls({ match, disabled, onPoint }) {
  const btn = (slot, side) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPoint(side)}
      className="flex w-full items-center justify-between gap-2 bg-scoreRed px-5 text-surface transition active:brightness-95 disabled:opacity-40"
      style={{ borderRadius: 'var(--radius-sm)', minHeight: 72 }}
    >
      <span className="truncate text-left font-display text-xl">{slotName(slot)}</span>
      <span className="shrink-0 text-sm font-semibold uppercase tracking-wide">Point ▸</span>
    </button>
  );
  return (
    <div className="flex flex-col gap-2">
      {btn(match.teamA, 'A')}
      {btn(match.teamB, 'B')}
    </div>
  );
}

/* ---------- rally strip ---------- */
function RallyStrip({ timeline, match, onAddDetail }) {
  const last = timeline[timeline.length - 1];
  if (!last) {
    return (
      <div className="rule-t border-rule pt-3 text-center text-sm text-muted">
        No points recorded yet. Tap a team to score the first rally.
      </div>
    );
  }
  const teamName = last.winner === 'A' ? slotName(match.teamA) : slotName(match.teamB);
  const type = { ATTACK_KILL: 'Attack kill', BLOCK: 'Block', ACE: 'Ace', OPPONENT_ERROR: 'Opponent error', OTHER: 'Point' }[last.pointType] || 'Point';
  return (
    <div className="rule-t flex items-center justify-between border-rule pt-3">
      <div className="min-w-0">
        <span className="block text-xs uppercase tracking-wider text-muted">Last point</span>
        <span className="block truncate text-sm text-ink">
          <span className="tnum font-display">{last.scoreAfter.a}–{last.scoreAfter.b}</span>
          {' · '}{teamName} · {type}{last.player ? ` · ${last.player.name}` : ''}
        </span>
      </div>
      <button type="button" onClick={onAddDetail} className="shrink-0 text-xs font-medium text-green hover:underline">
        Add detail
      </button>
    </div>
  );
}

/* ---------- bottom dock ---------- */
function BottomDock({ disabled, onUndo, onHistory, onSub, busy, online }) {
  return (
    <div className="sticky bottom-0 grid grid-cols-3 gap-px rule-t border-rule bg-rule">
      <UndoButton disabled={disabled || busy || !online} onUndo={onUndo} />
      <DockButton onClick={onHistory} label="History" />
      <DockButton onClick={onSub} label="Sub" disabled={disabled} />
    </div>
  );
}

// Press-and-hold to undo, so a stray tap can't erase a point mid-rally.
function UndoButton({ disabled, onUndo }) {
  const [progress, setProgress] = useState(0);
  const timer = useRef(null);
  const start = () => {
    if (disabled) return;
    const began = Date.now();
    timer.current = setInterval(() => {
      const pct = Math.min(1, (Date.now() - began) / 600);
      setProgress(pct);
      if (pct >= 1) {
        clearInterval(timer.current);
        setProgress(0);
        onUndo();
      }
    }, 30);
  };
  const cancel = () => {
    clearInterval(timer.current);
    setProgress(0);
  };
  useEffect(() => () => clearInterval(timer.current), []);
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      className="relative flex flex-col items-center justify-center bg-paper py-3 text-sm font-medium text-ink disabled:opacity-40"
      style={{ minHeight: 60 }}
    >
      <span className="relative z-10">Hold to undo</span>
      {progress > 0 && (
        <span className="absolute bottom-0 left-0 h-1 bg-scoreRed" style={{ width: `${progress * 100}%` }} />
      )}
    </button>
  );
}

function DockButton({ onClick, label, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bg-paper py-3 text-sm font-medium text-ink disabled:opacity-40"
      style={{ minHeight: 60 }}
    >
      {label}
    </button>
  );
}

/* ---------- decided notice ---------- */
function DecidedNotice({ match }) {
  const winnerName = match.winner === 'A' ? slotName(match.teamA) : slotName(match.teamB);
  return (
    <div className="border border-green bg-greenTint p-4 text-center" style={{ borderRadius: 'var(--radius-sm)' }}>
      <span className="block text-xs font-semibold uppercase tracking-wider text-deepGreen">Match decided</span>
      <span className="mt-1 block font-display text-2xl text-ink">{winnerName} win</span>
      <span className="mt-1 block text-xs text-muted">
        Made a mistake? Hold undo to reopen the last point.
      </span>
    </div>
  );
}

/* ---------- history sheet ---------- */
function HistorySheet({ timeline, match, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-[430px] flex-col rounded-t-lg border-t border-rule bg-paper"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between rule-b border-rule px-4 py-3">
          <h3 className="font-display text-xl text-ink">Rally history</h3>
          <button type="button" onClick={onClose} className="text-sm text-muted" aria-label="Close">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <MatchTimeline timeline={timeline} match={match} />
        </div>
      </div>
    </div>
  );
}

/* ---------- sync banner ---------- */
function SyncBanner({ message, online, onDismiss }) {
  return (
    <div className="flex items-start justify-between gap-3 border border-amber bg-paper p-3" style={{ borderRadius: 'var(--radius-sm)' }}>
      <div className="text-sm text-ink">
        <span className="font-semibold text-amber">{online ? 'Scoring paused' : 'Offline'}</span>
        <span className="mt-0.5 block text-muted">{message}</span>
      </div>
      <button type="button" onClick={onDismiss} className="shrink-0 text-xs font-medium text-green">
        Dismiss
      </button>
    </div>
  );
}
