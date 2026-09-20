import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, TeamChip } from '../../components/ui/primitives.jsx';

/*
 * The full league table. Two points per win; the note under the table spells
 * out the tiebreaker order so the ranking is never a mystery. Numbers are
 * tabular so columns line up down the page.
 */
export default function StandingsPage() {
  const standings = useApi(() => publicService.standings(), []);

  return (
    <div className="space-y-8">
      <SectionHead kicker="Table" title="Standings" />
      <AsyncView
        query={standings}
        label="Loading standings"
        emptyWhen={(d) => !d.standings?.length || d.standings.every((r) => r.played === 0)}
        empty={<EmptyState title="No matches played yet" hint="The table fills in once results start coming through." />}
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
                    <th scope="col" className="px-4 py-2.5 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.teamId} className="rule-b border-rule last:border-0">
                      <td className="tnum px-4 py-3 text-muted">{row.rank}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/tournament/teams/${row.teamId}`}
                          className="flex items-center gap-2 hover:text-green"
                        >
                          <TeamChip colorToken={row.team?.colorToken} />
                          {row.team?.name}
                        </Link>
                      </td>
                      <td className="tnum px-4 py-3 text-center">{row.played}</td>
                      <td className="tnum px-4 py-3 text-center">{row.wins}</td>
                      <td className="tnum px-4 py-3 text-center">{row.losses}</td>
                      <td className="tnum px-4 py-3 text-center text-graphite">
                        {row.setsWon}–{row.setsLost}
                      </td>
                      <td className="tnum px-4 py-3 text-center text-graphite">
                        {row.setRatio != null ? row.setRatio.toFixed(2) : '—'}
                      </td>
                      <td className="tnum px-4 py-3 text-center font-semibold text-ink">{row.points}</td>
                      <td className="px-4 py-3 text-center">
                        {row.qualificationStatus === 'QUALIFIED' && (
                          <span className="inline-flex items-center border border-green px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green" style={{ borderRadius: 'var(--radius-xs)' }}>
                            Qualified
                          </span>
                        )}
                        {row.qualificationStatus === 'ELIMINATED' && (
                          <span className="inline-flex items-center border border-scoreRed px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-scoreRed" style={{ borderRadius: 'var(--radius-xs)' }}>
                            Eliminated
                          </span>
                        )}
                        {row.manualTiebreak && (
                          <span className="inline-flex items-center border border-amber px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber" style={{ borderRadius: 'var(--radius-xs)' }}>
                            Manual Tiebreak
                          </span>
                        )}
                      </td>
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

