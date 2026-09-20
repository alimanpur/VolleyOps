import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { MatchCard } from '../../components/match/MatchCard.jsx';
import { Bracket } from '../../components/match/Bracket.jsx';
import { SectionHead } from '../../components/ui/primitives.jsx';
import { STAGE_LABELS } from '../../utils/format.js';

/*
 * The full schedule. We lead with the bracket so the shape of the tournament is
 * legible at a glance, then list every match grouped by stage (League →
 * Semifinal → Final). TBD slots carry their own explanation via MatchCard.
 */
const STAGE_ORDER = ['LEAGUE', 'SEMIFINAL', 'FINAL'];

export default function FixturesPage() {
  const fixtures = useApi(() => publicService.fixtures(), []);

  return (
    <div className="space-y-10">
      <SectionHead kicker="Schedule" title="Fixtures" />
      <AsyncView
        query={fixtures}
        label="Loading fixtures"
        emptyWhen={(d) => !d.matches?.length}
        empty={<EmptyState title="No fixtures yet" hint="The schedule will appear here once matches are drawn." />}
      >
        {({ matches }) => {
          const byStage = STAGE_ORDER
            .map((stage) => ({ stage, items: matches.filter((m) => m.stage === stage) }))
            .filter((g) => g.items.length > 0);
          return (
            <div className="space-y-12">
              <section>
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-green">Bracket</p>
                <Bracket matches={matches} />
              </section>
              {byStage.map(({ stage, items }) => (
                <section key={stage}>
                  <h3 className="mb-4 rule-b border-rule pb-2 font-display text-2xl text-ink">
                    {STAGE_LABELS[stage] || stage}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((m) => (
                      <MatchCard key={m.id} match={m} to={`/tournament/matches/${m.id}`} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}
