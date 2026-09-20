import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, TeamChip } from '../../components/ui/primitives.jsx';

/*
 * The league table as the admin sees it — same computation as the public page,
 * fed from the admin endpoint so unpublished tournaments still show a table.
 * Tabular figures line the columns up; the tiebreaker order is spelled out.
 */
export default function AdminStandings() {
  const query = useApi(() => adminService.standings(), []);

  return (
    <div className="space-y-8">
      <SectionHead kicker="Table" title="Standings" />
      <AsyncView
        query={query}
        label="Loading standings"
        emptyWhen={(d) => !d.standings?.length}
        empty={<EmptyState title="No standings yet" hint="The table fills in as results come through." />}
      >
        {({ standings: rows }) => (
          <div className="space-y-3">
            <div className="scroll-x border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                    <th scope="col" className="px-4 py-2.5 font-semibold">#</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Team</th>
                    <th scope="col" className="px-4 py-2.5 text-center font-semibold">P</th>
                    <th scope="col" className="px-4 py-2.5 text-center font-semibold">W</th>
                    <th scope="col" className="px-4 py-2.5 text-center font-semibold">L</th>
                    <th scope="col" className="px-4 py-2.5 text-center font-semibold">Sets</th>
                    <th scope="col" className="px-4 py-2.5 text-center font-semibold">Set ratio</th>
                    <th scope="col" className="px-4 py-2.5 text-center font-semibold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.teamId} className="rule-b border-rule last:border-0">
                      <td className="tnum px-4 py-3 text-muted">{row.rank}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 text-ink">
                          <TeamChip colorToken={row.team?.colorToken} />
                          {row.team?.name}
                        </span>
                      </td>
                      <td className="tnum px-4 py-3 text-center">{row.played}</td>
                      <td className="tnum px-4 py-3 text-center">{row.wins}</td>
                      <td className="tnum px-4 py-3 text-center">{row.losses}</td>
                      <td className="tnum px-4 py-3 text-center text-graphite">{row.setsWon}–{row.setsLost}</td>
                      <td className="tnum px-4 py-3 text-center text-graphite">
                        {row.setRatio != null ? row.setRatio.toFixed(2) : '—'}
                      </td>
                      <td className="tnum px-4 py-3 text-center font-semibold text-ink">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              Win = 2 points. Tiebreakers: points, wins, set ratio, point ratio, head-to-head.
            </p>
          </div>
        )}
      </AsyncView>
    </div>
  );
}
