import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/primitives.jsx';

/*
 * Intentional 404. Rendered OUTSIDE PublicLayout, so it carries its own minimal
 * masthead. Big display "404", a plain sentence, and one way back.
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="rule-b border-rule bg-surface">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-2xl tracking-tight text-ink">VolleyOps</span>
            <span className="hidden text-xs font-semibold uppercase tracking-wider text-green sm:inline">
              Volleyball Tournament
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <p className="font-display text-8xl leading-none text-ink sm:text-9xl">404</p>
        <p className="mt-4 text-lg text-muted">This page isn&apos;t part of the tournament.</p>
        <div className="mt-8">
          <Button variant="ink" to="/">Back to tournament</Button>
        </div>
      </main>
    </div>
  );
}
