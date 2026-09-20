import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ScorerAssignments from './ScorerAssignments.jsx';
import ScorerConsole from './ScorerConsole.jsx';

/*
 * Scorer shell. Everything is constrained to a portrait column (max ~430px)
 * centered on paper, so the console reads the same on a phone and a desktop.
 */
export default function ScorerApp() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await logout();
    navigate('/scorer/access', { replace: true });
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col">
        <header className="flex items-center justify-between rule-b border-rule bg-surface px-4 py-2.5">
          <Link to="/scorer" className="font-display text-lg text-ink">
            VolleyOps <span className="text-xs uppercase tracking-wider text-green">Scorer</span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-muted hover:text-ink"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </header>
        <div className="flex flex-1 flex-col">
          <Routes>
            <Route index element={<ScorerAssignments />} />
            <Route path="matches/:matchId" element={<ScorerConsole />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
