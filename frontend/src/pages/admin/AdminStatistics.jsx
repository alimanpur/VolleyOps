import { useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, TeamChip } from '../../components/ui/primitives.jsx';

/*
 * Player leaderboard for the admin. One metric at a time, switchable up top; the
 * table re-sorts descending on the chosen figure. Same numbers the public sees,
 * traced back to recorded rally events.
 */
const METRICS = [
  { key: 'pointsScored', label: 'Points' },
  { key: 'kills', label: 'Kills' },
  { key: 'blocks', label: 'Blocks' },
  { key: 'aces', label: 'Aces' },
  { key: 'assists', label: 'Assists' },
  { key: 'digs', label: 'Digs' },
  { key: 'efficiency', label: 'Efficiency' },
];

export default function AdminStatistics() {
  const query = useApi(() => adminService.stats(), []);

  return (
    <div className="space-y-8">
      <SectionHead kicker="Leaders" title="Statistics" />
      <AsyncView
        query={query}
        label="Loading statistics"
        emptyWhen={(d) => !d.stats?.length}
        empty={<EmptyState title="No statistics yet" hint="Leaders appear once rallies have been recorded." />}
      >
        {({ stats }) => <Leaderboard rows={stats} />}
      </AsyncView>
    </div>
  );
}

function Leaderboard({ rows }) {
  const [metric, setMetric] = useState('pointsScored');
  const active = METRICS.find((m) => m.key === metric) || METRICS[0];

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0)),
    [rows, metric],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sort by metric">
        {METRICS.map((m) => {
          const on = m.key === metric;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={on}
              className={`border px-3 py-1.5 text-sm font-medium transition ${
                on ? 'border-ink bg-ink text-paper' : 'border-rule text-graphite hover:border-ink'
              }`}
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="scroll-x border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
        <table className="w-full min-w-[38rem] text-sm">
          <thead>
            <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
              <th scope="col" className="px-4 py-2.5 font-semibold">#</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Player</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Team</th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">{active.label}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.playerId} className="rule-b border-rule last:border-0">
                <td className="tnum px-4 py-3 text-muted">{i + 1}</td>
                <td className="px-4 py-3">
                  <span className="text-ink">{s.player?.name}</span>
                  {s.player?.position && <span className="ml-2 text-xs text-muted">{s.player.position}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-graphite">
                    <TeamChip colorToken={s.team?.colorToken} />
                    {s.team?.code || s.team?.name}
                  </span>
                </td>
                <td className="tnum px-4 py-3 text-right font-semibold text-ink">
                  {metric === 'efficiency' && typeof s[metric] === 'number' ? s[metric].toFixed(3) : s[metric] ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Based on recorded rally events.</p>
    </div>
  );
}
