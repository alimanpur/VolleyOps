import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { MatchCard } from '../../components/match/MatchCard.jsx';
import { SectionHead, TeamChip, Pill } from '../../components/ui/primitives.jsx';

/*
 * One team, in full: identity header, the roster split into its active six and
 * the standby, and every match the team appears in. Captain is marked; jersey
 * numbers are tabular so the roster reads like a team sheet.
 */
export default function TeamDetailPage() {
  const { teamId } = useParams();
  const team = useApi(() => publicService.team(teamId), [teamId]);

  return (
    <div className="space-y-10">
      <AsyncView query={team} label="Loading team">
        {({ team: t, players = [], matches = [] }) => {
          const active = players.filter((p) => p.status === 'ACTIVE');
          const standby = players.filter((p) => p.status === 'STANDBY');
          return (
            <div className="space-y-10">
              <header className="rule-b border-rule pb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green">Team</p>
                <div className="mt-1 flex items-center gap-3">
                  <TeamChip colorToken={t.colorToken} />
                  <h1 className="font-display text-4xl leading-none text-ink sm:text-6xl">{t.name}</h1>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {t.code ? `${t.code} · ` : ''}Year {t.year}
                </p>
              </header>

              <section>
                <SectionHead kicker="Roster" title={`Active (${active.length}/6)`} />
                {active.length > 0 ? (
                  <Roster players={active} />
                ) : (
                  <p className="text-sm text-muted">No active players named yet.</p>
                )}
              </section>

              <section>
                <SectionHead kicker="Roster" title={`Standby (${standby.length}/1)`} />
                {standby.length > 0 ? (
                  <Roster players={standby} />
                ) : (
                  <p className="text-sm text-muted">No standby player named yet.</p>
                )}
              </section>

              <section>
                <SectionHead kicker="Schedule" title="Matches" />
                {matches.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {matches.map((m) => (
                      <MatchCard key={m.id} match={m} to={`/tournament/matches/${m.id}`} />
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No matches yet" hint="This team's fixtures will appear once the draw is set." />
                )}
              </section>
            </div>
          );
        }}
      </AsyncView>
    </div>
  );
}

function Roster({ players }) {
  return (
    <div className="border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
      <ul>
        {players.map((p) => (
          <li key={p.id} className="rule-b border-rule last:border-0">
            <Link
              to={`/tournament/players/${p.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-paper"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="tnum w-8 shrink-0 text-center font-display text-xl text-graphite">
                  {p.jerseyNumber ?? '—'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-ink">{p.name}</p>
                  {p.position && <p className="text-xs text-muted">{p.position}</p>}
                </div>
              </div>
              {p.isCaptain && <Pill tone="green">Captain</Pill>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
