import { useApi } from '../../hooks/useApi.js';
import { captainService } from '../../services/captainService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { MatchCard } from '../../components/match/MatchCard.jsx';
import { SectionHead } from '../../components/ui/primitives.jsx';

export default function CaptainFixtures() {
  const query = useApi(() => captainService.fixtures(), [], { poll: 15000 });
  return (
    <AsyncView
      query={query}
      label="Loading fixtures"
      emptyWhen={(d) => d.matches.length === 0}
      empty={<EmptyState title="No fixtures yet" hint="Your matches will appear here once the bracket is set." />}
    >
      {(data) => (
        <div>
          <SectionHead kicker="Fixtures" title="Your matches" />
          <div className="grid gap-4 sm:grid-cols-2">
            {data.matches.map((m) => (
              <MatchCard key={m.id} match={m} to={`../matches/${m.id}`} />
            ))}
          </div>
        </div>
      )}
    </AsyncView>
  );
}
