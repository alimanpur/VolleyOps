import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView } from '../../components/ui/states.jsx';
import { Pill, TeamChip } from '../../components/ui/primitives.jsx';

/*
 * One player. Header carries identity — name, jersey, team, position, whether
 * they're active or standby, captaincy. The stat line is derived from recorded
 * rally events; if nothing's been recorded we say so plainly instead of showing
 * a wall of zeroes dressed up as data.
 */
const STAT_FIELDS = [
  { key: 'kills', label: 'Kills' },
  { key: 'blocks', label: 'Blocks' },
  { key: 'aces', label: 'Aces' },
  { key: 'assists', label: 'Assists' },
  { key: 'digs', label: 'Digs' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'pointsScored', label: 'Points' },
];

export default function PlayerDetailPage() {
  const { playerId } = useParams();
  const player = useApi(() => publicService.player(playerId), [playerId]);

  return (
    <div className="space-y-10">
      <AsyncView query={player} label="Loading player">
        {({ player: p, stats }) => (
          <div className="space-y-10">
            <header className="rule-b border-rule pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green">Player</p>
              <div className="mt-1 flex items-baseline gap-4">
                {p.jerseyNumber != null && (
                  <span className="tnum font-display text-5xl leading-none text-graphite sm:text-6xl">
                    {p.jerseyNumber}
                  </span>
                )}
                <h1 className="font-display text-4xl leading-none text-ink sm:text-6xl">{p.name}</h1>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
                {p.team && (
                  <Link to={`/tournament/teams/${p.team.id}`} className="inline-flex items-center gap-2 hover:text-green">
                    <TeamChip colorToken={p.team.colorToken} />
                    {p.team.name}
                  </Link>
                )}
                {p.position && <span>{p.position}</span>}
                <Pill tone={p.status === 'ACTIVE' ? 'green' : 'muted'}>
                  {p.status === 'ACTIVE' ? 'Active' : 'Standby'}
                </Pill>
                {p.isCaptain && <Pill tone="green">Captain</Pill>}
              </div>
            </header>

            <section>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-green">Statistics</p>
              {stats ? (
                <>
                  <dl className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4" style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    {STAT_FIELDS.map(({ key, label }) => (
                      <div key={key} className="bg-surface px-4 py-5">
                        <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
                        <dd className="tnum mt-1 font-display text-3xl text-ink">
                          {key === 'efficiency' && typeof stats[key] === 'number'
                            ? stats[key].toFixed(3)
                            : stats[key] ?? 0}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-muted">Based on recorded rally events.</p>
                </>
              ) : (
                <p className="text-sm text-muted">
                  No statistics recorded yet. Numbers appear here once this player features in scored rallies.
                </p>
              )}
            </section>
          </div>
        )}
      </AsyncView>
    </div>
  );
}
