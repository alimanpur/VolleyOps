import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, TeamChip } from '../../components/ui/primitives.jsx';

/*
 * Players are owned by their team, so this is a directory rather than a second
 * editing surface: each team links to its roster editor where player CRUD
 * actually lives. Completeness is shown so gaps are obvious without a click.
 */
export default function AdminPlayers() {
  const query = useApi(() => adminService.teams(), []);

  return (
    <div className="space-y-8">
      <SectionHead kicker="Squads" title="Players" />
      <p className="text-sm text-muted">
        Players belong to a team. Open a team to add, edit, or remove its players and set its captain.
      </p>
      <AsyncView
        query={query}
        label="Loading squads"
        emptyWhen={(d) => !d.teams?.length}
        empty={<EmptyState title="No teams yet" hint="Create a team first, then build its roster." />}
      >
        {({ teams }) => (
          <div className="scroll-x border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Team</th>
                  <th scope="col" className="px-4 py-2.5 text-center font-semibold">Active</th>
                  <th scope="col" className="px-4 py-2.5 text-center font-semibold">Standby</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Captain</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Roster</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold" />
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => {
                  const r = team.report || {};
                  return (
                    <tr key={team.id} className="rule-b border-rule last:border-0">
                      <td className="px-4 py-3">
                        <Link to={`/admin/teams/${team.id}`} className="flex items-center gap-2 font-medium text-ink hover:text-green">
                          <TeamChip colorToken={team.colorToken} />
                          {team.name}
                        </Link>
                      </td>
                      <td className="tnum px-4 py-3 text-center text-graphite">
                        {r.activeCount ?? 0}/{r.activeRequired ?? 6}
                      </td>
                      <td className="tnum px-4 py-3 text-center text-graphite">
                        {r.standbyCount ?? 0}/{r.standbyRequired ?? 1}
                      </td>
                      <td className="px-4 py-3">
                        {r.hasCaptain ? (
                          <span className="text-xs font-semibold text-green">Set</span>
                        ) : (
                          <span className="text-xs font-semibold text-amber">Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.complete ? (
                          <span className="text-xs font-semibold text-green">Complete</span>
                        ) : (
                          <span className="text-xs font-semibold text-amber">
                            {r.issues?.length || 0} issue{(r.issues?.length || 0) === 1 ? '' : 's'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/admin/teams/${team.id}`}
                          className="text-sm font-medium text-graphite underline-offset-2 hover:text-green hover:underline"
                        >
                          Edit roster →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AsyncView>
    </div>
  );
}
