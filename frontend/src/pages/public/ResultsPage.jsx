import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { MatchCard } from '../../components/match/MatchCard.jsx';
import { SectionHead } from '../../components/ui/primitives.jsx';

/*
 * Completed matches only. A plain grid of result cards — the winner's line is
 * emphasised by MatchCard itself. Empty until the first match is final.
 */
export default function ResultsPage() {
  const results = useApi(() => publicService.results(), []);

  return (
    <div className="space-y-8">
      <SectionHead kicker="Final scores" title="Results" />
      <AsyncView
        query={results}
        label="Loading results"
        emptyWhen={(d) => !d.matches?.length}
        empty={<EmptyState title="No results yet" hint="Finished matches will show up here as the tournament plays out." />}
      >
        {({ matches }) => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} to={`/tournament/matches/${m.id}`} />
            ))}
          </div>
        )}
      </AsyncView>
    </div>
  );
}
