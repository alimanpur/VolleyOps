import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, TeamChip } from '../../components/ui/primitives.jsx';

/*
 * The field. Teams are rule-bordered blocks, not heavy cards — the chip, name
 * and a thin line of meta is all a spectator needs to pick one and drill in.
 */
export default function TeamsPage() {
  const teams = useApi(() => publicService.teams(), []);

  return (
    <div className="space-y-8">
      <SectionHead kicker="The field" title="Teams" />
      <AsyncView
        query={teams}
        label="Loading teams"
        emptyWhen={(d) => !d.teams?.length}
        empty={<EmptyState title="No teams yet" hint="Teams will appear here once they are registered." />}
      >
        {({ teams: list }) => (
          <div className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3" style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {list.map((team) => (
              <Link
                key={team.id}
                to={`/tournament/teams/${team.id}`}
                className="group flex items-center justify-between gap-3 bg-surface px-4 py-4 transition hover:bg-paper"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <TeamChip colorToken={team.colorToken} />
                  <div className="min-w-0">
                    <p className="truncate font-display text-xl text-ink group-hover:text-green">{team.name}</p>
                    <p className="text-xs text-muted">Year {team.year}</p>
                  </div>
                </div>
                <span className="tnum shrink-0 text-sm text-muted">
                  {team.playerCount} {team.playerCount === 1 ? 'player' : 'players'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </AsyncView>
    </div>
  );
}
