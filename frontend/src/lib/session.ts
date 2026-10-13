import type { AuthUser } from '../types/hsms';

const TOKEN_KEY = 'hsms.access_token';
const USER_KEY = 'hsms.auth_user';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function getStoredToken(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  const sessionValue = window.sessionStorage.getItem(TOKEN_KEY);

  if (sessionValue) {
    return sessionValue;
  }

  // One-time migration fallback from localStorage to sessionStorage.
  const legacyValue = window.localStorage.getItem(TOKEN_KEY);

  if (legacyValue) {
    window.sessionStorage.setItem(TOKEN_KEY, legacyValue);
    window.localStorage.removeItem(TOKEN_KEY);
  }

  return legacyValue;
}

export function getStoredUser(): AuthUser | null {
  if (!canUseStorage()) {
    return null;
  }

  let raw = window.sessionStorage.getItem(USER_KEY);

  if (!raw) {
    const legacyRaw = window.localStorage.getItem(USER_KEY);

    if (legacyRaw) {
      window.sessionStorage.setItem(USER_KEY, legacyRaw);
      window.localStorage.removeItem(USER_KEY);
      raw = legacyRaw;
    }
  }

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    window.sessionStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function storeSession(token: string, user: AuthUser): void {
  if (!canUseStorage()) {
    return;
  }

  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (!canUseStorage()) {
    return;
  }

  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
