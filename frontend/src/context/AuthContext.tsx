import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';
import { normalizeRoleName } from '../lib/format';
import { clearSession, getStoredToken, getStoredUser, storeSession } from '../lib/session';
import type { AuthUser, RoleName } from '../types/hsms';


interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isInitializing: boolean;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
  hasRole: (roles: RoleName[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function sanitizeUser(user: AuthUser): AuthUser {
  return {
    ...user,
    role: normalizeRoleName(user.role),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const signOut = useCallback(async () => {
    try {
      // Tell the backend we are logging out (for audit logs / token invalidation)
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore errors — we are clearing the client state regardless
    }
    
    // Clear the client session
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const signIn = useCallback((nextToken: string, nextUser: AuthUser) => {
    const safeUser = sanitizeUser(nextUser);

    storeSession(nextToken, safeUser);
    setToken(nextToken);
    setUser(safeUser);
  }, []);

  const refreshProfile = useCallback(async () => {
    const response = await api.get<AuthUser>('/auth/me');
    const safeUser = sanitizeUser(response.data);
    const currentToken = getStoredToken();

    if (currentToken) {
      storeSession(currentToken, safeUser);
      setToken(currentToken);
    }

    setUser(safeUser);
  }, []);

  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();

    if (!storedToken || !storedUser) {
      setIsInitializing(false);
      return;
    }

    setToken(storedToken);
    setUser(storedUser);

    refreshProfile()
      .catch(() => {
        signOut();
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [refreshProfile, signOut]);

  const hasRole = useCallback(
    (roles: RoleName[]) => {
      const currentRole = normalizeRoleName(user?.role);
      return roles.includes(currentRole);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isInitializing,
      signIn,
      signOut,
      refreshProfile,
      hasRole,
    }),
    [hasRole, isInitializing, refreshProfile, signIn, signOut, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
