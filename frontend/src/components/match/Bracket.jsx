import { Link } from 'react-router-dom';
import { slotName } from '../../utils/format.js';

/*
 * Tournament bracket. Desktop shows a horizontal progression Round 1 →
 * Semifinals → Final with connector rules between columns. Mobile stacks the
 * rounds vertically and stays readable. BYE teams appear naturally as a resolved
 * slot — no fake match cards are drawn for them.
 */

function slotLine(slot, { winner, side, state }) {
  const isWinner = ['FINISHED', 'LOCKED'].includes(state) && winner === side;
  const tbd = !slot || slot.tbd;
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
        isWinner ? 'font-semibold text-ink' : tbd ? 'italic text-muted' : 'text-graphite'
      }`}
    >
      <span className="truncate">{slotName(slot)}</span>
    </div>
  );
}

function BracketMatch({ match }) {
  const live = match.state === 'LIVE';
  const done = ['FINISHED', 'LOCKED'].includes(match.state);
  return (
    <Link
      to={`/tournament/matches/${match.id}`}
      className="block w-56 border bg-surface transition hover:border-ink"
      style={{
        borderRadius: 'var(--radius-sm)',
        borderColor: live ? 'var(--color-scoreRed)' : 'var(--color-rule)',
      }}
    >
      <div className="flex items-center justify-between border-b border-rule px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{match.label}</span>
        {live && <span className="text-[11px] font-bold uppercase text-scoreRed">Live</span>}
        {done && <span className="text-[11px] font-bold uppercase text-green">Final</span>}
      </div>
      {slotLine(match.teamA, { winner: match.winner, side: 'A', state: match.state })}
      <div className="rule-t border-rule" />
      {slotLine(match.teamB, { winner: match.winner, side: 'B', state: match.state })}
    </Link>
  );
}

export function Bracket({ matches }) {
  const round1 = matches.filter((m) => m.stage === 'ROUND_1');
  const semis = matches.filter((m) => m.stage === 'SEMIFINAL');
  const final = matches.filter((m) => m.stage === 'FINAL');

  const Column = ({ title, items }) => (
    <div className="flex min-w-56 flex-col justify-center gap-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-green">{title}</p>
      <div className="flex flex-col justify-around gap-6">
        {items.map((m) => (
          <BracketMatch key={m.id} match={m} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="scroll-x -mx-1 px-1">
      <div className="flex items-stretch gap-10 pb-2" style={{ minWidth: 'min-content' }}>
        <Column title="Round 1" items={round1} />
        <Column title="Semifinals" items={semis} />
        <Column title="Final" items={final} />
      </div>
    </div>
  );
}
