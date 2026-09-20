import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView } from '../../components/ui/states.jsx';
import { MatchCard } from '../../components/match/MatchCard.jsx';
import { Scoreboard } from '../../components/match/Scoreboard.jsx';
import { SectionHead, Button, TeamChip } from '../../components/ui/primitives.jsx';
import { slotName } from '../../utils/format.js';

/*
 * The tournament destination. Priority hierarchy per spec §7A:
 * LIVE NOW → NEXT → TODAY'S FIXTURES → RESULTS → STANDINGS. If nothing is live
 * we say so honestly rather than inventing a match. Live data polls every 12s.
 */
export default function HomePage() {
  const tournament = useApi(() => publicService.tournament(), []);
  const overview = useApi(() => publicService.overview(), [], { poll: 12000 });
  const progress = useApi(() => publicService.progress(), []);

  return (
    <div className="space-y-10">
      <AsyncView query={tournament}>
        {({ tournament: t }) => <Hero t={t} live={overview.data?.live?.length} />}
      </AsyncView>

      <AsyncView query={progress} label="Loading tournament">
        {(prog) => <ProgressSection data={prog} />}
      </AsyncView>

      <AsyncView query={overview} label="Loading tournament">
        {(data) => (
          <div className="space-y-10">
            {/* LIVE NOW */}
            {data.live.length > 0 ? (
              <section>
                <SectionHead kicker="Live now" title="On court" />
                <div className="grid gap-4 lg:grid-cols-2">
                  {data.live.map((m) => (
                    <Link key={m.id} to={`/tournament/matches/${m.id}`} className="block">
                      <Scoreboard match={m} />
                    </Link>
                  ))}
                </div>
              </section>
            ) : (
              <section className="border border-rule bg-surface px-5 py-6" style={{ borderRadius: 'var(--radius-sm)' }}>
                <p className="font-display text-xl text-ink">No match is live right now</p>
                <p className="mt-1 text-sm text-muted">
                  {data.next
                    ? `Next up: ${slotName(data.next.teamA)} vs ${slotName(data.next.teamB)}`
                    : 'Check the fixtures for the full schedule.'}
                </p>
              </section>
            )}

            {/* NEXT + TODAY */}
            {data.upcoming.length > 0 && (
              <section>
                <SectionHead
                  kicker="Coming up"
                  title="Next matches"
                  action={<Button variant="quiet" to="/tournament/fixtures">All fixtures</Button>}
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.upcoming.map((m) => (
                    <MatchCard key={m.id} match={m} to={`/tournament/matches/${m.id}`} />
                  ))}
                </div>
              </section>
            )}

            {/* RESULTS */}
            {data.recentResults.length > 0 && (
              <section>
                <SectionHead
                  kicker="Results"
                  title="Latest results"
                  action={<Button variant="quiet" to="/tournament/results">All results</Button>}
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.recentResults.map((m) => (
                    <MatchCard key={m.id} match={m} to={`/tournament/matches/${m.id}`} />
                  ))}
                </div>
              </section>
            )}

            {/* STANDINGS snapshot */}
            {data.standings.length > 0 && (
              <section>
                <SectionHead
                  kicker="Table"
                  title="Standings"
                  action={<Button variant="quiet" to="/tournament/standings">Full table</Button>}
                />
                <div className="border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="rule-b border-rule text-left text-xs uppercase tracking-wider text-muted">
                        <th className="px-4 py-2 font-semibold">#</th>
                        <th className="px-4 py-2 font-semibold">Team</th>
                        <th className="px-4 py-2 text-center font-semibold">P</th>
                        <th className="px-4 py-2 text-center font-semibold">W</th>
                        <th className="px-4 py-2 text-center font-semibold">Pts</th>
                        <th className="px-4 py-2 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.standings.map((row) => (
                        <tr key={row.teamId} className="rule-b border-rule last:border-0">
                          <td className="tnum px-4 py-2.5 text-muted">{row.rank}</td>
                          <td className="px-4 py-2.5">
                            <Link to={`/tournament/teams/${row.teamId}`} className="flex items-center gap-2 hover:text-green">
                              <TeamChip colorToken={row.team?.colorToken} />
                              {row.team?.name}
                            </Link>
                          </td>
                          <td className="tnum px-4 py-2.5 text-center">{row.played}</td>
                          <td className="tnum px-4 py-2.5 text-center">{row.wins}</td>
                          <td className="tnum px-4 py-2.5 text-center font-semibold">{row.points}</td>
                          <td className="px-4 py-2.5 text-center">
                            {row.qualificationStatus === 'QUALIFIED' && (
                              <span className="inline-flex items-center border border-green px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green" style={{ borderRadius: 'var(--radius-xs)' }}>
                                Qualified
                              </span>
                            )}
                            {row.qualificationStatus === 'ELIMINATED' && (
                              <span className="inline-flex items-center border border-scoreRed px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-scoreRed" style={{ borderRadius: 'var(--radius-xs)' }}>
                                Eliminated
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}
      </AsyncView>
    </div>
  );
}

function Hero({ t, live }) {
  return (
    <section className="rule-b border-rule pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green">
            {t.subtitle || 'Tournament'}
          </p>
          <h1 className="mt-1 font-display text-5xl leading-none text-ink sm:text-7xl">{t.name}</h1>
          <p className="mt-3 text-sm text-muted">
            {t.venue ? `${t.venue} · ` : ''}
            {t.startTimeNote}
          </p>
        </div>
        {live > 0 && (
          <Link
            to="/tournament/live"
            className="inline-flex items-center gap-2 bg-scoreRed px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <span className="h-2 w-2 rounded-full bg-white live-dot" />
            {live} live now
          </Link>
        )}
      </div>
    </section>
  );
}

function ProgressSection({ data }) {
  if (!data) return null;
  const { stage, league, qualifiedTeams, eliminatedTeam, champion } = data;

  const stageLabel = {
    LEAGUE: 'League Stage',
    QUALIFICATION_COMPLETE: 'Qualification Complete',
    SEMIFINALS: 'Semifinals',
    FINAL: 'Final',
    COMPLETED: 'Completed',
  }[stage] || stage;

  return (
    <div className="border border-rule bg-surface p-6" style={{ borderRadius: 'var(--radius-sm)' }}>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Current Stage</p>
          <p className="font-display text-2xl text-ink">{stageLabel}</p>
        </div>
        {champion && (
          <div className="ml-auto border border-green px-4 py-2" style={{ borderRadius: 'var(--radius-xs)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-green">Champion</p>
            <p className="font-display text-xl text-ink">{champion.name}</p>
          </div>
        )}
      </div>

      {league && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">League Progress</span>
            <span className="text-muted">{league.completed} / {league.total} matches</span>
          </div>
          <div className="h-2 overflow-hidden bg-paper" style={{ borderRadius: 'var(--radius-xs)' }}>
            <div
              className="h-full bg-green transition-all"
              style={{ width: `${(league.completed / league.total) * 100}%`, borderRadius: 'var(--radius-xs)' }}
            />
          </div>
        </div>
      )}

      {qualifiedTeams && qualifiedTeams.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-green">Top 4 Qualified</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {qualifiedTeams.map((t) => (
              <div key={t.teamId} className="border border-rule px-3 py-2" style={{ borderRadius: 'var(--radius-xs)' }}>
                <p className="text-xs text-muted">#{t.rank}</p>
                <p className="text-sm font-medium text-ink">{t.name}</p>
              </div>
            ))}
          </div>
          {eliminatedTeam && (
            <p className="text-xs text-scoreRed">Eliminated: #{eliminatedTeam.rank} {eliminatedTeam.name}</p>
          )}
        </div>
      )}
    </div>
  );
}
