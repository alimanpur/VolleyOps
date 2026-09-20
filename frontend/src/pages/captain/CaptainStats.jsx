import { useApi } from '../../hooks/useApi.js';
import { captainService } from '../../services/captainService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead } from '../../components/ui/primitives.jsx';

const COLS = [
  ['kills', 'Kills'],
  ['blocks', 'Blk'],
  ['aces', 'Ace'],
  ['assists', 'Ast'],
  ['digs', 'Dig'],
  ['pointsScored', 'Pts'],
];

export default function CaptainStats() {
  const query = useApi(() => captainService.stats(), []);
  return (
    <AsyncView
      query={query}
      label="Loading statistics"
      emptyWhen={(d) => d.stats.length === 0}
      empty={<EmptyState title="No statistics yet" hint="Player stats build up as rallies are recorded." />}
    >
      {(data) => (
        <div>
          <SectionHead kicker="Statistics" title="Your players" />
          <div className="overflow-x-auto border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-semibold">Player</th>
                  {COLS.map(([, label]) => (
                    <th key={label} className="px-3 py-2 text-center font-semibold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.stats.map((s) => (
                  <tr key={s.playerId} className="rule-b border-rule last:border-0">
                    <td className="px-3 py-2.5 text-ink">{s.player.name}</td>
                    {COLS.map(([key]) => (
                      <td key={key} className="tnum px-3 py-2.5 text-center">{s[key] ?? 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Based on recorded rally events.</p>
        </div>
      )}
    </AsyncView>
  );
}
