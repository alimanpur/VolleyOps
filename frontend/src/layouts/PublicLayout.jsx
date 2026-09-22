import { useState, useEffect } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '../components/ui/icons.jsx';

/*
 * Public shell. A confident editorial masthead with a hairline primary nav, a
 * discreet top-right "Staff" entry (staff access is no longer buried only in the
 * footer), and a real mobile drawer for the full nav. The footer keeps a
 * secondary Staff path. LIVE is always the most discoverable nav item.
 */

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/tournament/live', label: 'Live', live: true },
  { to: '/tournament/fixtures', label: 'Fixtures' },
  { to: '/tournament/results', label: 'Results' },
  { to: '/tournament/standings', label: 'Standings' },
  { to: '/tournament/teams', label: 'Teams' },
  { to: '/tournament/players', label: 'Players' },
  { to: '/tournament/stats', label: 'Stats' },
  { to: '/tournament/awards', label: 'Awards' },
  { to: '/tournament/info', label: 'Info' },
];

function navLinkClass({ isActive }) {
  return `inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
    isActive ? 'border-green text-ink' : 'border-transparent text-muted hover:text-ink'
  }`;
}

function SearchForm({ onSubmitted, autoFocus }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (q.trim()) {
      navigate(`/tournament/search?q=${encodeURIComponent(q.trim())}`);
      onSubmitted?.();
    }
  };
  return (
    <form onSubmit={submit} role="search" className="relative flex items-center">
      <span className="pointer-events-none absolute left-2.5 text-muted">
        <Icon.Search size={16} />
      </span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search teams, players"
        aria-label="Search teams and players"
        autoFocus={autoFocus}
        className="w-full border border-rule bg-paper py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none sm:w-56"
        style={{ borderRadius: 'var(--radius-sm)' }}
      />
    </form>
  );
}

function Masthead() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the drawer on any navigation.
  useEffect(() => setOpen(false), [location.pathname]);
  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 rule-b border-rule bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-tight text-ink">VolleyOps</span>
          <span className="hidden text-xs font-semibold uppercase tracking-wider text-green sm:inline">
            Volleyball Tournament
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <SearchForm />
          </div>
          <Link
            to="/staff"
            className="hidden items-center gap-1.5 border border-rule px-3 py-1.5 text-sm font-medium text-graphite transition hover:border-ink hover:text-ink sm:inline-flex"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <Icon.Lock size={15} />
            Staff
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center border border-rule p-2 text-ink transition hover:border-ink lg:hidden"
            style={{ borderRadius: 'var(--radius-sm)' }}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Icon.Menu size={20} />
          </button>
        </div>
      </div>

      {/* Desktop primary nav */}
      <nav className="mx-auto hidden max-w-6xl px-2 lg:block" aria-label="Primary">
        <ul className="scroll-x flex gap-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={navLinkClass}>
                {item.live && (
                  <span className="h-1.5 w-1.5 rounded-full bg-scoreRed live-dot" aria-hidden="true" />
                )}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile / tablet drawer */}
      {open && <MobileDrawer onClose={() => setOpen(false)} />}
    </header>
  );
}

function MobileDrawer({ onClose }) {
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div className="absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col bg-surface shadow-xl">
        <div className="flex items-center justify-between rule-b border-rule px-4 py-3">
          <span className="font-display text-xl text-ink">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center border border-rule p-2 text-ink transition hover:border-ink"
            style={{ borderRadius: 'var(--radius-sm)' }}
            aria-label="Close menu"
          >
            <Icon.Close size={20} />
          </button>
        </div>
        <div className="px-4 py-3">
          <SearchForm onSubmitted={onClose} />
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Mobile">
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rule-b border-rule px-3 py-3 text-base font-medium transition ${
                      isActive ? 'text-green' : 'text-ink hover:text-green'
                    }`
                  }
                >
                  {item.live && (
                    <span className="h-2 w-2 rounded-full bg-scoreRed live-dot" aria-hidden="true" />
                  )}
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="rule-t border-rule p-4">
          <Link
            to="/staff"
            onClick={onClose}
            className="flex items-center justify-center gap-2 border border-ink px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
            style={{ borderRadius: 'var(--radius-sm)' }}
          >
            <Icon.Lock size={16} />
            Staff access
          </Link>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="rule-t border-rule bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <span className="font-display text-2xl text-ink">VolleyOps</span>
            <p className="mt-2 max-w-xs text-sm text-muted">
              Volleyball Tournament
            </p>
            <p className="mt-1 text-sm text-muted">21–22 September 2026 · from 3:00 PM IST</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-green">Tournament</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/tournament/live" className="text-graphite hover:text-ink">Live</Link></li>
              <li><Link to="/tournament/fixtures" className="text-graphite hover:text-ink">Fixtures</Link></li>
              <li><Link to="/tournament/standings" className="text-graphite hover:text-ink">Standings</Link></li>
              <li><Link to="/tournament/teams" className="text-graphite hover:text-ink">Teams</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-green">Access</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/staff" className="text-graphite hover:text-ink">Staff access</Link></li>
              <li><Link to="/admin/login" className="text-graphite hover:text-ink">Admin</Link></li>
              <li><Link to="/captain/access" className="text-graphite hover:text-ink">Captain</Link></li>
              <li><Link to="/scorer/access" className="text-graphite hover:text-ink">Scorer</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 rule-t border-rule pt-5 text-xs text-muted">
          © 2026 VolleyOps
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Masthead />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
