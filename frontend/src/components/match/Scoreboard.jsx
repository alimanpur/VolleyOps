import { slotName } from '../../utils/format.js';

/**
 * Large scoreboard used in the public match center. Set-by-set line plus the
 * headline sets-won figure. Strong score typography, tabular figures, LIVE in
 * score red. No cards-within-cards — a single framed block.
 */
export function Scoreboard({ match }) {
  const { teamA, teamB, setScores = [], setsWon, state, winner, serving } = match;
  const live = state === 'LIVE';
  const done = ['FINISHED', 'LOCKED'].includes(state);

  const teamRow = (slot, side) => {
    const isWinner = done && winner === side;
    const isServing = live && serving === side;
    return (
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {isServing && <span className="h-2 w-2 shrink-0 rounded-full bg-scoreRed live-dot" aria-label="serving" />}
          <span className={`truncate font-display text-2xl sm:text-3xl ${isWinner ? 'text-ink' : 'text-graphite'}`}>
            {slotName(slot)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden gap-2 sm:flex">
            {setScores.map((s) => (
              <span
                key={s.setNumber}
                className={`tnum w-6 text-center text-sm ${s.winner === side ? 'font-semibold text-ink' : 'text-muted'}`}
              >
                {side === 'A' ? s.a : s.b}
              </span>
            ))}
          </div>
          <span
            className={`tnum font-display text-4xl sm:text-5xl ${
              live ? 'text-scoreRed' : isWinner ? 'text-green' : 'text-ink'
            }`}
          >
            {setsWon?.[side] ?? 0}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
      <div className="px-5">
        {teamRow(teamA, 'A')}
        <div className="rule-t border-rule" />
        {teamRow(teamB, 'B')}
      </div>
      {/* Mobile set line */}
      {setScores.length > 0 && (
        <div className="rule-t flex gap-4 border-rule px-5 py-2 text-xs text-muted sm:hidden">
          {setScores.map((s) => (
            <span key={s.setNumber} className="tnum">
              Set {s.setNumber}: {s.a}–{s.b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
