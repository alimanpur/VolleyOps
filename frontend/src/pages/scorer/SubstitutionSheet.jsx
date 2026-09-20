import { useState } from 'react';
import { slotName } from '../../utils/format.js';

/*
 * Substitution sheet. Pick a side, the player coming off (currently on court),
 * and the player coming on (from the bench for that side). Submits
 * { side, playerOut, playerIn, setNumber } — the server validates eligibility.
 */
export default function SubstitutionSheet({ match, onCourt, roster, setNumber, onConfirm, onCancel, busy, error }) {
  const [side, setSide] = useState('A');
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);

  const onCourtIds = new Set((onCourt[side] || []).map((p) => p.id));
  const bench = (roster[side] || []).filter((p) => !onCourtIds.has(p.id));

  const switchSide = (next) => {
    setSide(next);
    setPlayerOut(null);
    setPlayerIn(null);
  };

  const ready = playerOut && playerIn;
  const submit = () => ready && onConfirm({ side, playerOut, playerIn, setNumber });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onCancel}>
      <div
        className="w-full max-w-[430px] rounded-t-lg border-t border-rule bg-paper p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl text-ink">Substitution</h3>
          <button type="button" onClick={onCancel} className="text-sm text-muted" aria-label="Cancel">
            Cancel
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          {['A', 'B'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => switchSide(s)}
              aria-pressed={side === s}
              className={`border px-3 py-3 text-sm font-medium transition ${
                side === s ? 'border-green bg-greenTint text-ink' : 'border-rule text-graphite'
              }`}
              style={{ borderRadius: 'var(--radius-sm)', minHeight: 52 }}
            >
              {slotName(s === 'A' ? match.teamA : match.teamB)}
            </button>
          ))}
        </div>

        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Coming off</p>
        <PlayerGrid players={onCourt[side] || []} selected={playerOut} onPick={setPlayerOut} empty="No players on court." />

        <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Coming on</p>
        <PlayerGrid players={bench} selected={playerIn} onPick={setPlayerIn} empty="No bench players available." />

        {error && <p className="mt-3 text-sm text-scoreRed">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={!ready || busy}
          className="mt-4 w-full bg-green px-3 py-4 text-base font-semibold text-surface disabled:opacity-40"
          style={{ borderRadius: 'var(--radius-sm)', minHeight: 56 }}
        >
          {busy ? 'Substituting…' : 'Confirm substitution'}
        </button>
      </div>
    </div>
  );
}

function PlayerGrid({ players, selected, onPick, empty }) {
  if (players.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="grid grid-cols-2 gap-2">
      {players.map((p) => {
        const on = selected === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            aria-pressed={on}
            className={`flex items-center gap-2 border px-3 py-2.5 text-left text-sm transition ${
              on ? 'border-green bg-greenTint text-ink' : 'border-rule text-graphite'
            }`}
            style={{ borderRadius: 'var(--radius-sm)', minHeight: 48 }}
          >
            <span className="tnum w-6 text-center font-display text-base text-ink">{p.jersey ?? '–'}</span>
            <span className="flex-1 truncate">{p.name}</span>
            {p.status === 'STANDBY' && <span className="text-[10px] uppercase text-muted">Sb</span>}
          </button>
        );
      })}
    </div>
  );
}
