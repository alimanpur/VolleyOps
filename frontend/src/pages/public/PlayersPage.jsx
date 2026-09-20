import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, Pill, TeamChip } from '../../components/ui/primitives.jsx';

/*
 * Every player in the tournament, searchable by name and filterable by team.
 * Rows read like a squad list: jersey, name, position, team, status. Grouping
 * by team keeps related players together while the search narrows the field.
 */
export default function PlayersPage() {
  const players = useApi(() => publicService.players(), []);

  return (
    <div className="space-y-8">
      <SectionHead kicker="People" title="Players" />
      <AsyncView
        query={players}
        label="Loading players"
        emptyWhen={(d) => !d.players?.length}
        empty={<EmptyState title="No players yet" hint="Players appear here once rosters are registered." />}
      >
        {({ players: list }) => <PlayerBrowser players={list} />}
      </AsyncView>
    </div>
  );
}

function PlayerBrowser({ players }) {
  const [q, setQ] = useState('');
  const [teamId, setTeamId] = useState('');

  const teams = useMemo(() => {
    const map = new Map();
    players.forEach((p) => {
      if (p.team && !map.has(p.team.id)) map.set(p.team.id, p.team);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players.filter((p) => {
      if (teamId && p.team?.id !== teamId) return false;
      if (needle && !p.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [players, q, teamId]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((p) => {
      const key = p.team?.id || 'none';
      if (!map.has(key)) map.set(key, { team: p.team, players: [] });
      map.get(key).players.push(p);
    });
    return [...map.values()].sort((a, b) => (a.team?.name || '').localeCompare(b.team?.name || ''));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players"
          aria-label="Search players by name"
          className="w-full max-w-xs border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
          style={{ borderRadius: 'var(--radius-sm)' }}
        />
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          aria-label="Filter players by team"
          className="border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No players match" hint="Try a different name or clear the team filter." />
      ) : (
        <div className="space-y-8">
          {grouped.map(({ team, players: group }) => (
            <section key={team?.id || 'none'}>
              <div className="mb-3 flex items-center gap-2 rule-b border-rule pb-2">
                <TeamChip colorToken={team?.colorToken} />
                <h3 className="font-display text-xl text-ink">{team?.name || 'Unassigned'}</h3>
              </div>
              <ul className="border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
                {group.map((p) => (
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
                      <Pill tone={p.status === 'ACTIVE' ? 'green' : 'muted'}>
                        {p.status === 'ACTIVE' ? 'Active' : 'Standby'}
                      </Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
