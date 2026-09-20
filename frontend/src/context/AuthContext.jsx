import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService.js';
import { onAuthExpired } from '../services/http.js';

const AuthContext = createContext(null);

/**
 * Session context for the authenticated experiences. Public pages do NOT mount
 * this (spec §43), so spectators never trigger /auth/me. It verifies the
 * session once on mount and reacts to global 401s by clearing the user.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await authService.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    return onAuthExpired(() => setUser(null));
  }, [refresh]);

  const logout = useCallback(async () => {
    await authService.logout().catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, ready, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
