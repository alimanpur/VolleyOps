import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingBlock } from './ui/states.jsx';

/**
 * Gate for authenticated experiences. Waits for the session check, then routes
 * to the appropriate access page when unauthenticated or wrong-role. Server-side
 * authorization is the real guard; this is just UX.
 */
export function ProtectedRoute({ role, redirectTo, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <LoadingBlock label="Checking access" />;
  if (!user) return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) {
    // Authenticated but wrong role — send to their own home.
    const home = user.role === 'ADMIN' ? '/admin' : user.role === 'CAPTAIN' ? '/captain' : '/scorer';
    return <Navigate to={home} replace />;
  }
  return children;
}
