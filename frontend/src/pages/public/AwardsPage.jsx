import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead } from '../../components/ui/primitives.jsx';

/*
 * Published awards. Each is a titled block with its winner and their team —
 * quiet until the organisers announce them, so an empty list is an honest
 * "coming soon" rather than a placeholder trophy.
 */
export default function AwardsPage() {
  const awards = useApi(() => publicService.awards(), []);

  return (
    <div className="space-y-8">
      <SectionHead kicker="Honours" title="Awards" />
      <AsyncView
        query={awards}
        label="Loading awards"
        emptyWhen={(d) => !d.awards?.length}
        empty={<EmptyState title="Awards will be announced here" hint="Check back once the tournament wraps up." />}
      >
        {({ awards: list }) => (
          <div className="grid gap-px border border-rule bg-rule sm:grid-cols-2" style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {list.map((a) => (
              <article key={a.id} className="bg-surface px-5 py-6">
                <h3 className="font-display text-2xl text-ink">{a.title}</h3>
                {a.description && <p className="mt-1 text-sm text-muted">{a.description}</p>}
                <div className="mt-4 rule-t border-rule pt-4">
                  {a.winner ? (
                    <>
                      <p className="font-display text-xl text-green">
                        <Link to={`/tournament/players/${a.winner.id}`} className="hover:underline">
                          {a.winner.name}
                        </Link>
                      </p>
                      {a.winnerTeam && (
                        <Link to={`/tournament/teams/${a.winnerTeam.id}`} className="text-sm text-muted hover:text-green">
                          {a.winnerTeam.name}
                        </Link>
                      )}
                    </>
                  ) : (
                    <p className="text-sm italic text-muted">Winner to be announced</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </AsyncView>
    </div>
  );
}
