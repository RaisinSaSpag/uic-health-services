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
  signIn: (token: string, user: AuthUser) => Promise<void>;
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
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore errors
    }
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const signIn = useCallback(async (nextToken: string, nextUser: AuthUser) => {
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
        // If the profile fetch fails (e.g., 401), clear the session
        clearSession();
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setIsInitializing(false);
      });
    
  // 🚨 FIX: Only run this once on mount to prevent infinite loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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