/**
 * Loading / empty / error primitives shared by every page. Errors explain what
 * went wrong and offer a way forward; empty states are an honest invitation,
 * never a fake skeleton that spins forever (spec §41).
 */

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-3 text-muted" role="status" aria-live="polite">
      <span className="inline-block h-4 w-4 rounded-full border-2 border-rule border-t-green live-dot" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function LoadingBlock({ label }) {
  return (
    <div className="flex min-h-40 items-center justify-center py-16">
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="rule-t rule-b border-rule py-14 text-center">
      <p className="font-display text-2xl text-ink">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const notFound = error?.status === 404;
  return (
    <div className="border border-rule bg-surface p-8 text-center" style={{ borderRadius: 'var(--radius-sm)' }}>
      <p className="font-display text-2xl text-scoreRed">
        {notFound ? 'Not found' : 'Something went wrong'}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {error?.message || 'The request could not be completed.'}
      </p>
      {onRetry && !notFound && (
        <button
          type="button"
          onClick={() => onRetry()}
          className="mt-5 inline-flex items-center border border-ink px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Convenience wrapper: renders loading/error, then children with data. Keeps
 * every page's state handling consistent without repeating the ladder.
 */
export function AsyncView({ query, children, emptyWhen, empty, label }) {
  if (query.loading && !query.data) return <LoadingBlock label={label} />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;
  if (emptyWhen && query.data && emptyWhen(query.data)) return empty || null;
  return children(query.data);
}
