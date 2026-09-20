import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { captainService } from '../../services/captainService.js';
import { AsyncView } from '../../components/ui/states.jsx';
import { Scoreboard } from '../../components/match/Scoreboard.jsx';
import { MatchCard } from '../../components/match/MatchCard.jsx';
import { SectionHead, Button, Pill } from '../../components/ui/primitives.jsx';

export default function CaptainDashboard() {
  const query = useApi(() => captainService.dashboard(), [], { poll: 15000 });
  return (
    <AsyncView query={query} label="Loading your team">
      {(data) => (
        <div className="space-y-8">
          <div className="rule-b border-rule pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green">Captain dashboard</p>
            <h1 className="mt-1 font-display text-4xl text-ink">{data.team.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RosterBadge report={data.roster.report} />
              {data.unreadNotifications > 0 && (
                <Pill tone="green">{data.unreadNotifications} unread</Pill>
              )}
            </div>
          </div>

          {data.live && (
            <section>
              <SectionHead kicker="Live" title="Your match is on court" />
              <Link to={`matches/${data.live.id}`}>
                <Scoreboard match={data.live} />
              </Link>
            </section>
          )}

          {data.next && (
            <section>
              <SectionHead kicker="Next" title="Coming up" />
              <MatchCard match={data.next} to={`matches/${data.next.id}`} />
            </section>
          )}

          <section>
            <SectionHead
              kicker="Team"
              title="Quick links"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" to="roster">View roster</Button>
              <Button variant="outline" to="fixtures">Fixtures</Button>
              <Button variant="outline" to="standings">Standings</Button>
            </div>
          </section>
        </div>
      )}
    </AsyncView>
  );
}

function RosterBadge({ report }) {
  if (report.complete) {
    return <Pill tone="green">Roster complete · {report.activeCount}/6 active · {report.standbyCount}/1 standby</Pill>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 border border-amber px-2 py-0.5 text-[11px] font-medium text-amber" style={{ borderRadius: 'var(--radius-xs)' }}>
      Roster incomplete · {report.activeCount}/6 active · {report.standbyCount}/1 standby
    </span>
  );
}
