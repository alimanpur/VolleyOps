import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { publicService } from '../../services/publicService.js';
import { AsyncView, EmptyState } from '../../components/ui/states.jsx';
import { SectionHead, Pill } from '../../components/ui/primitives.jsx';

/*
 * Site search over teams and players. The query lives in the URL (?q=) so a
 * search is shareable; the input refines it in place. Each result is typed with
 * a pill and links to the right detail page.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [draft, setDraft] = useState(q);

  const search = useApi(() => (q ? publicService.search(q) : Promise.resolve({ results: [] })), [q]);

  const submit = (e) => {
    e.preventDefault();
    const next = draft.trim();
    setParams(next ? { q: next } : {});
  };

  return (
    <div className="space-y-8">
      <SectionHead kicker="Find" title="Search" />

      <form onSubmit={submit} role="search" className="flex gap-2">
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search teams and players"
          aria-label="Search teams and players"
          className="w-full max-w-md border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
          style={{ borderRadius: 'var(--radius-sm)' }}
        />
        <button
          type="submit"
          className="border border-ink px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          Search
        </button>
      </form>

      {!q ? (
        <EmptyState title="Search the tournament" hint="Type a team or player name to get started." />
      ) : (
        <AsyncView
          query={search}
          label="Searching"
          emptyWhen={(d) => !d.results?.length}
          empty={<EmptyState title="No results" hint={`Nothing matched “${q}”. Try another name.`} />}
        >
          {({ results }) => (
            <ul className="border border-rule bg-surface" style={{ borderRadius: 'var(--radius-sm)' }}>
              {results.map((r) => (
                <li key={`${r.type}-${r.id}`} className="rule-b border-rule last:border-0">
                  <Link
                    to={r.type === 'team' ? `/tournament/teams/${r.id}` : `/tournament/players/${r.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-paper"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-ink">{r.label}</p>
                      {r.sub && <p className="text-xs text-muted">{r.sub}</p>}
                    </div>
                    <Pill tone={r.type === 'team' ? 'ink' : 'muted'}>
                      {r.type === 'team' ? 'Team' : 'Player'}
                    </Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AsyncView>
      )}
    </div>
  );
}
