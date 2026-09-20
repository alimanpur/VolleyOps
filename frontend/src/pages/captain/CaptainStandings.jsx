import { useApi } from '../../hooks/useApi.js';
import { captainService } from '../../services/captainService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, TeamChip } from '../../components/ui/primitives.jsx';

export default function CaptainStandings() {
  const { user } = useAuth();
  const query = useApi(() => captainService.standings(), []);
  const myTeamId = user?.team?.id;
  return (
    <AsyncView
      query={query}
      label="Loading standings"
      emptyWhen={(d) => d.standings.every((r) => r.played === 0)}
      empty={<EmptyState title="No results yet" hint="Standings appear once matches are played." />}
    >
      {(data) => (
        <div>
          <SectionHead kicker="Table" title="Standings" />
          <div className="border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Team</th>
                  <th className="px-3 py-2 text-center font-semibold">P</th>
                  <th className="px-3 py-2 text-center font-semibold">W</th>
                  <th className="px-3 py-2 text-center font-semibold">L</th>
                  <th className="px-3 py-2 text-center font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {data.standings.map((row) => {
                  const mine = String(row.teamId) === String(myTeamId);
                  return (
                    <tr
                      key={row.teamId}
                      className={`rule-b border-rule last:border-0 ${mine ? 'bg-greenTint' : ''}`}
                    >
                      <td className="tnum px-3 py-2.5 text-muted">{row.rank}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <TeamChip colorToken={row.team?.colorToken} />
                          <span className={mine ? 'font-semibold text-ink' : ''}>{row.team?.name}</span>
                        </span>
                      </td>
                      <td className="tnum px-3 py-2.5 text-center">{row.played}</td>
                      <td className="tnum px-3 py-2.5 text-center">{row.wins}</td>
                      <td className="tnum px-3 py-2.5 text-center">{row.losses}</td>
                      <td className="tnum px-3 py-2.5 text-center font-semibold">{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AsyncView>
  );
}
