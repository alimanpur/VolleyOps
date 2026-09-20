import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { Scoreboard } from '../../components/match/Scoreboard.jsx';
import { SectionHead } from '../../components/ui/primitives.jsx';

/*
 * Live monitor. Polls the full match list every 8s and surfaces only what is on
 * court right now. Read-only — scoring lives with the scorer; from here an admin
 * jumps to the fixture to intervene (reassign, reopen, lock).
 */
export default function AdminLive() {
  const query = useApi(() => adminService.matches(), [], { poll: 8000 });

  return (
    <div className="space-y-8">
      <SectionHead kicker="Monitor" title="Live" />
      <AsyncView query={query} label="Loading live matches">
        {(data) => {
          const live = (data.matches || []).filter((m) => m.state === 'LIVE');
          if (live.length === 0) {
            return (
              <EmptyState
                title="Nothing is live"
                hint="Live scoreboards appear here the moment a scorer starts a match."
              />
            );
          }
          return (
            <div className="grid gap-5 lg:grid-cols-2">
              {live.map((m) => (
                <div key={m.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-scoreRed">
                      {m.label} · Set {m.currentSet}
                    </p>
                    <Link
                      to="/admin/fixtures"
                      className="text-sm font-medium text-graphite underline-offset-2 hover:text-green hover:underline"
                    >
                      Manage →
                    </Link>
                  </div>
                  <Scoreboard match={m} />
                  {m.court?.name && <p className="text-xs text-muted">{m.court.name}</p>}
                </div>
              ))}
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}
