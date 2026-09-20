import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../../components/ui/primitives.jsx';
import CaptainDashboard from './CaptainDashboard.jsx';
import CaptainRoster from './CaptainRoster.jsx';
import CaptainFixtures from './CaptainFixtures.jsx';
import CaptainStandings from './CaptainStandings.jsx';
import CaptainStats from './CaptainStats.jsx';
import CaptainNotifications from './CaptainNotifications.jsx';
import CaptainMatch from './CaptainMatch.jsx';

const NAV = [
  { to: '', label: 'Dashboard', end: true },
  { to: 'roster', label: 'Roster' },
  { to: 'fixtures', label: 'Fixtures' },
  { to: 'standings', label: 'Standings' },
  { to: 'stats', label: 'Stats' },
  { to: 'notifications', label: 'Notifications' },
];

export default function CaptainApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    navigate('/captain/access', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="rule-b border-rule bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <span className="font-display text-xl text-ink">{user?.team?.name || 'My team'}</span>
            <span className="ml-2 text-xs uppercase tracking-wider text-green">Captain</span>
          </div>
          <Button variant="quiet" onClick={signOut}>
            Sign out
          </Button>
        </div>
        <nav className="mx-auto max-w-4xl px-2">
          <ul className="scroll-x flex gap-1">
            {NAV.map((item) => (
              <li key={item.to || 'home'}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                      isActive ? 'border-green text-ink' : 'border-transparent text-muted hover:text-ink'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <Routes>
          <Route index element={<CaptainDashboard />} />
          <Route path="roster" element={<CaptainRoster />} />
          <Route path="fixtures" element={<CaptainFixtures />} />
          <Route path="standings" element={<CaptainStandings />} />
          <Route path="stats" element={<CaptainStats />} />
          <Route path="notifications" element={<CaptainNotifications />} />
          <Route path="matches/:matchId" element={<CaptainMatch />} />
        </Routes>
      </main>
    </div>
  );
}
