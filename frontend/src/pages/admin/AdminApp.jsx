import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

import AdminOverview from './AdminOverview.jsx';
import AdminLive from './AdminLive.jsx';
import AdminFixtures from './AdminFixtures.jsx';
import AdminTeams from './AdminTeams.jsx';
import AdminTeamRoster from './AdminTeamRoster.jsx';
import AdminPlayers from './AdminPlayers.jsx';
import AdminCourts from './AdminCourts.jsx';
import AdminStandings from './AdminStandings.jsx';
import AdminStatistics from './AdminStatistics.jsx';
import AdminAwards from './AdminAwards.jsx';
import AdminNotifications from './AdminNotifications.jsx';
import AdminAccess from './AdminAccess.jsx';
import AdminAudit from './AdminAudit.jsx';
import AdminSettings from './AdminSettings.jsx';

/*
 * The admin workspace shell. Desktop-first operational chrome: a fixed left
 * nav rail, a slim header carrying tournament + operator identity, and the
 * routed page in the main column. On small screens the rail becomes a
 * horizontally scrollable strip so the whole console stays reachable.
 */

const NAV = [
  { to: '', end: true, label: 'Overview' },
  { to: 'live', label: 'Live' },
  { to: 'fixtures', label: 'Fixtures' },
  { to: 'teams', label: 'Teams' },
  { to: 'players', label: 'Players' },
  { to: 'courts', label: 'Courts' },
  { to: 'standings', label: 'Standings' },
  { to: 'statistics', label: 'Statistics' },
  { to: 'awards', label: 'Awards' },
  { to: 'notifications', label: 'Notifications' },
  { to: 'access', label: 'Access' },
  { to: 'audit', label: 'Audit' },
  { to: 'settings', label: 'Settings' },
];

function NavItem({ to, end, label, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'group relative flex items-center whitespace-nowrap px-3 py-2 text-sm font-medium transition',
          isActive ? 'text-ink' : 'text-graphite hover:text-ink',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={`absolute left-0 top-1/2 hidden h-5 -translate-y-1/2 md:block ${
              isActive ? 'bg-green' : 'bg-transparent'
            }`}
            style={{ width: 3 }}
          />
          <span
            aria-hidden
            className={`absolute bottom-0 left-0 right-0 h-0.5 md:hidden ${
              isActive ? 'bg-green' : 'bg-transparent'
            }`}
          />
          {label}
        </>
      )}
    </NavLink>
  );
}

export default function AdminApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/admin/login');
  }

  const tournamentName = user?.tournament?.name || 'VolleyOps';

  return (
    <div className="min-h-screen bg-paper text-ink md:grid md:grid-cols-[15rem_1fr]">
      {/* Sidebar (desktop) / top strip (mobile) */}
      <aside className="border-b border-rule bg-surface md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r md:overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green">VolleyOps</p>
            <p className="mt-0.5 text-xs text-muted">Admin console</p>
          </div>
        </div>
        <nav
          aria-label="Admin sections"
          className="scroll-x flex gap-0.5 px-2 pb-2 md:flex-col md:gap-0 md:px-2 md:pb-4"
        >
          {NAV.map((item) => (
            <NavItem key={item.label} {...item} />
          ))}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-rule bg-paper/95 px-5 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="truncate font-display text-lg text-ink">{tournamentName}</p>
            <p className="text-xs text-muted">Operations</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-ink">{user?.displayName || 'Admin'}</p>
              <p className="text-xs text-muted">Administrator</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center border border-rule px-3 py-1.5 text-sm font-medium text-graphite transition hover:border-ink hover:text-ink"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
          <Routes>
            <Route index element={<AdminOverview />} />
            <Route path="live" element={<AdminLive />} />
            <Route path="fixtures" element={<AdminFixtures />} />
            <Route path="teams" element={<AdminTeams />} />
            <Route path="teams/:teamId" element={<AdminTeamRoster />} />
            <Route path="players" element={<AdminPlayers />} />
            <Route path="courts" element={<AdminCourts />} />
            <Route path="standings" element={<AdminStandings />} />
            <Route path="statistics" element={<AdminStatistics />} />
            <Route path="awards" element={<AdminAwards />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="access" element={<AdminAccess />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="settings" element={<AdminSettings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
