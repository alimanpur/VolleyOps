import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { adminService } from '../../services/adminService.js';
import { AsyncView } from '../../components/ui/states.jsx';
import { Scoreboard } from '../../components/match/Scoreboard.jsx';
import { MatchCard } from '../../components/match/MatchCard.jsx';
import { SectionHead, Button } from '../../components/ui/primitives.jsx';
import { slotName, formatTime } from '../../utils/format.js';

/*
 * The operational "what needs attention now" board. Not a generic SaaS
 * dashboard — a compact stat strip up top, then LIVE, NEXT, and an attention
 * queue built from real gaps: incomplete rosters, unassigned matches, matches
 * waiting for a winner, and unread notifications. Rules and tabular figures do
 * the structural work; cards only where grouping is real. Live figures poll.
 */
export default function AdminOverview() {
  const query = useApi(() => adminService.dashboard(), [], { poll: 12000 });

  return (
    <div className="space-y-8">
      <SectionHead kicker="Operations" title="Overview" />
      <AsyncView query={query} label="Loading dashboard">
        {(data) => {
          const { live = [], next, attention = {}, counts = {} } = data;
          const {
            incompleteRosters = [],
            unassignedUpcoming = [],
            waitingForWinner = [],
            unreadNotifications = 0,
          } = attention;

          const attentionCount =
            incompleteRosters.length +
            unassignedUpcoming.length +
            waitingForWinner.length +
            (unreadNotifications > 0 ? 1 : 0);

          return (
            <div className="space-y-10">
              {/* Stat strip */}
              <div
                className="grid grid-cols-2 border border-rule bg-surface sm:grid-cols-4"
                style={{ borderRadius: 'var(--radius-sm)' }}
              >
                <Stat label="Teams" value={counts.teams} to="/admin/teams" />
                <Stat label="Players" value={counts.players} to="/admin/players" />
                <Stat label="Matches" value={counts.matches} to="/admin/fixtures" />
                <Stat label="Courts" value={counts.courts} to="/admin/courts" last />
              </div>

              {/* LIVE */}
              <section>
                <SectionHead
                  kicker="Live now"
                  title="On court"
                  action={<Button variant="quiet" to="/admin/live">Monitor</Button>}
                />
                {live.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {live.map((m) => (
                      <Link key={m.id} to="/admin/live" className="block">
                        <Scoreboard match={m} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="rule-t rule-b border-rule py-6 text-sm text-muted">
                    No match is live right now.
                  </p>
                )}
              </section>

              {/* NEXT */}
              <section>
                <SectionHead kicker="Coming up" title="Next match" />
                {next ? (
                  <div className="max-w-md">
                    <MatchCard match={next} to="/admin/fixtures" />
                  </div>
                ) : (
                  <p className="rule-t rule-b border-rule py-6 text-sm text-muted">
                    No scheduled match ready to play. Build the bracket or set fixtures.
                  </p>
                )}
              </section>

              {/* ATTENTION */}
              <section>
                <SectionHead
                  kicker="Attention"
                  title={attentionCount === 0 ? 'All clear' : `${attentionCount} to resolve`}
                />
                {attentionCount === 0 ? (
                  <p className="rule-t rule-b border-rule py-6 text-sm text-muted">
                    Nothing needs attention. Rosters are complete and every upcoming match has a scorer.
                  </p>
                ) : (
                  <div className="divide-y divide-rule border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
                    {/* Incomplete rosters */}
                    {incompleteRosters.map(({ team, issues }) => (
                      <AttentionRow
                        key={`roster-${team.id}`}
                        tone="amber"
                        label="Roster incomplete"
                        to={`/admin/teams/${team.id}`}
                        title={team.name}
                        detail={issues?.map((i) => i.message).join(' · ') || 'Roster does not meet requirements'}
                      />
                    ))}
                    {/* Unassigned upcoming */}
                    {unassignedUpcoming.map((m) => (
                      <AttentionRow
                        key={`unassigned-${m.id}`}
                        tone="green"
                        label="No scorer"
                        to="/admin/fixtures"
                        title={m.label}
                        detail={`${slotName(m.teamA)} vs ${slotName(m.teamB)}${m.scheduledAt ? ` · ${formatTime(m.scheduledAt)}` : ''}`}
                      />
                    ))}
                    {/* Waiting for winner */}
                    {waitingForWinner.map((m) => (
                      <AttentionRow
                        key={`waiting-${m.id}`}
                        tone="muted"
                        label="Waiting on result"
                        to="/admin/fixtures"
                        title={m.label}
                        detail={`${slotName(m.teamA)} vs ${slotName(m.teamB)}`}
                      />
                    ))}
                    {/* Unread notifications */}
                    {unreadNotifications > 0 && (
                      <AttentionRow
                        tone="green"
                        label="Unread"
                        to="/admin/notifications"
                        title={`${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`}
                        detail="Open the notifications log to review."
                      />
                    )}
                  </div>
                )}
              </section>
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}

function Stat({ label, value, to, last }) {
  const inner = (
    <div className={`px-4 py-4 ${last ? '' : 'border-r border-rule'}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="tnum mt-1 font-display text-3xl text-ink">{value ?? 0}</p>
    </div>
  );
  return to ? (
    <Link to={to} className="transition hover:bg-paper">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function AttentionRow({ tone = 'muted', label, title, detail, to }) {
  const tones = {
    amber: 'text-amber border-amber',
    green: 'text-green border-green',
    muted: 'text-muted border-rule',
  };
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}
            style={{ borderRadius: 'var(--radius-xs)' }}
          >
            {label}
          </span>
          <span className="truncate font-medium text-ink">{title}</span>
        </div>
        {detail && <p className="mt-1 truncate text-sm text-muted">{detail}</p>}
      </div>
      {to && (
        <Link
          to={to}
          className="shrink-0 text-sm font-medium text-graphite underline-offset-2 hover:text-green hover:underline"
        >
          Resolve →
        </Link>
      )}
    </div>
  );
}
