import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { Scoreboard } from '../../components/match/Scoreboard.jsx';
import { SectionHead, Button } from '../../components/ui/primitives.jsx';

/*
 * Live only. Polls every 8s so scoreboards move on their own. When nothing is
 * on court we say so and point to the fixtures rather than leave a blank page.
 */
export default function LivePage() {
  const overview = useApi(() => publicService.overview(), [], { poll: 8000 });

  return (
    <div className="space-y-8">
      <SectionHead kicker="On court" title="Live now" />
      <AsyncView query={overview} label="Loading live matches">
        {(data) =>
          data.live.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.live.map((m) => (
                <Link key={m.id} to={`/tournament/matches/${m.id}`} className="block focus-visible:outline-none">
                  <Scoreboard match={m} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No match is live right now"
              hint="When a match tips off it will show up here in real time."
              action={<Button variant="outline" to="/tournament/fixtures">See fixtures</Button>}
            />
          )
        }
      </AsyncView>
    </div>
  );
}
