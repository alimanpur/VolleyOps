import { useState } from 'react';
import { Button } from '../../components/ui/primitives.jsx';
import { slotName } from '../../utils/format.js';

/*
 * Pre-match lineup confirmation. For each side, the scorer picks the six players
 * on court to start. Defaults to the first six active players. Submitting sets
 * the lineups and starts the match (server-confirmed).
 */
export default function LineupScreen({ match, roster, onStart, busy, error }) {
  const [sel, setSel] = useState(() => ({
    A: pickDefaultSix(roster.A),
    B: pickDefaultSix(roster.B),
  }));

  const toggle = (side, id) => {
    setSel((prev) => {
      const current = prev[side];
      if (current.includes(id)) return { ...prev, [side]: current.filter((x) => x !== id) };
      if (current.length >= 6) return prev; // cap at six
      return { ...prev, [side]: [...current, id] };
    });
  };

  const ready = sel.A.length === 6 && sel.B.length === 6;

  return (
    <div className="flex flex-1 flex-col p-4">
      <h2 className="font-display text-2xl text-ink">Confirm lineups</h2>
      <p className="mt-1 text-sm text-muted">Pick the six players on court for each team, then start.</p>

      <div className="mt-4 flex-1 space-y-6 overflow-y-auto">
        {['A', 'B'].map((side) => (
          <div key={side}>
            <div className="mb-2 flex items-center justify-between rule-b border-rule pb-1">
              <span className="font-display text-lg text-ink">
                {slotName(side === 'A' ? match.teamA : match.teamB)}
              </span>
              <span className={`tnum text-sm ${sel[side].length === 6 ? 'text-green' : 'text-amber'}`}>
                {sel[side].length}/6
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {roster[side].map((p) => {
                const on = sel[side].includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(side, p.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-2 border px-3 py-2.5 text-left text-sm transition ${
                      on ? 'border-green bg-greenTint text-ink' : 'border-rule text-graphite'
                    }`}
                    style={{ borderRadius: 'var(--radius-sm)', minHeight: 48 }}
                  >
                    <span className="tnum w-6 text-center font-display text-base">{p.jersey ?? '–'}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.status === 'STANDBY' && <span className="text-[10px] uppercase text-muted">Sb</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-scoreRed">{error}</p>}
      <Button
        variant="primary"
        className="mt-4 w-full py-4 text-base"
        disabled={!ready || busy}
        onClick={() => onStart(sel)}
      >
        {busy ? 'Starting…' : 'Start match'}
      </Button>
    </div>
  );
}

function pickDefaultSix(players) {
  return players
    .filter((p) => p.status === 'ACTIVE')
    .slice(0, 6)
    .map((p) => p.id);
}
