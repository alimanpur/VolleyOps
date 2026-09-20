import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { LoadingBlock } from './components/ui/states.jsx';

// Public experience (no auth, no AuthProvider needed for these routes).
import { PublicLayout } from './layouts/PublicLayout.jsx';
import HomePage from './pages/public/HomePage.jsx';

// Lazy-load the rest to keep the initial (spectator) bundle lean.
const FixturesPage = lazy(() => import('./pages/public/FixturesPage.jsx'));
const ResultsPage = lazy(() => import('./pages/public/ResultsPage.jsx'));
const StandingsPage = lazy(() => import('./pages/public/StandingsPage.jsx'));
const TeamsPage = lazy(() => import('./pages/public/TeamsPage.jsx'));
const TeamDetailPage = lazy(() => import('./pages/public/TeamDetailPage.jsx'));
const PlayersPage = lazy(() => import('./pages/public/PlayersPage.jsx'));
const PlayerDetailPage = lazy(() => import('./pages/public/PlayerDetailPage.jsx'));
const StatsPage = lazy(() => import('./pages/public/StatsPage.jsx'));
const AwardsPage = lazy(() => import('./pages/public/AwardsPage.jsx'));
const MatchCenterPage = lazy(() => import('./pages/public/MatchCenterPage.jsx'));
const SearchPage = lazy(() => import('./pages/public/SearchPage.jsx'));
const InfoPage = lazy(() => import('./pages/public/InfoPage.jsx'));
const LivePage = lazy(() => import('./pages/public/LivePage.jsx'));
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage.jsx'));

// Access + role apps
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'));
const AccessPage = lazy(() => import('./pages/access/AccessPage.jsx'));
const StaffAccessHub = lazy(() => import('./pages/access/StaffAccessHub.jsx'));
const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'));
const CaptainApp = lazy(() => import('./pages/captain/CaptainApp.jsx'));
const ScorerApp = lazy(() => import('./pages/scorer/ScorerApp.jsx'));

function Fallback() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <LoadingBlock />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Fallback />}>
        <Routes>
          {/* Public — / is always the tournament homepage */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/tournament" element={<Navigate to="/" replace />} />
            <Route path="/tournament/live" element={<LivePage />} />
            <Route path="/tournament/fixtures" element={<FixturesPage />} />
            <Route path="/tournament/results" element={<ResultsPage />} />
            <Route path="/tournament/standings" element={<StandingsPage />} />
            <Route path="/tournament/teams" element={<TeamsPage />} />
            <Route path="/tournament/teams/:teamId" element={<TeamDetailPage />} />
            <Route path="/tournament/players" element={<PlayersPage />} />
            <Route path="/tournament/players/:playerId" element={<PlayerDetailPage />} />
            <Route path="/tournament/stats" element={<StatsPage />} />
            <Route path="/tournament/awards" element={<AwardsPage />} />
            <Route path="/tournament/matches/:matchId" element={<MatchCenterPage />} />
            <Route path="/tournament/search" element={<SearchPage />} />
            <Route path="/tournament/info" element={<InfoPage />} />
            <Route path="/staff" element={<StaffAccessHub />} />
          </Route>

          {/* Access entry points (kept out of public nav) */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/captain/access" element={<AccessPage role="CAPTAIN" />} />
          <Route path="/scorer/access" element={<AccessPage role="SCORER" />} />

          {/* Admin */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute role="ADMIN" redirectTo="/admin/login">
                <AdminApp />
              </ProtectedRoute>
            }
          />
          {/* Captain */}
          <Route
            path="/captain/*"
            element={
              <ProtectedRoute role="CAPTAIN" redirectTo="/captain/access">
                <CaptainApp />
              </ProtectedRoute>
            }
          />
          {/* Scorer */}
          <Route
            path="/scorer/*"
            element={
              <ProtectedRoute role="SCORER" redirectTo="/scorer/access">
                <ScorerApp />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
