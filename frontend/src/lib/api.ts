import axios from 'axios';
import { getStoredToken, getStoredUser, storeSession } from './session';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const api = axios.create({
  baseURL,
  headers: {
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 — token expired or invalid
    if (error.response?.status === 401) {
      // Only redirect if not already on login page
      if (!window.location.pathname.startsWith('/login')) {
        localStorage.removeItem('hsms_token');
        localStorage.removeItem('hsms_user');
        window.location.href = '/login';
      }
    }

    // Handle 403 with must_change_password — force the password change flow
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === 'must_change_password'
    ) {
      // Update the stored user so AuthContext picks up the flag
      const storedUser = getStoredUser();
      if (storedUser) {
        const updatedUser = { ...storedUser, must_change_password: true };
        const token = getStoredToken() ?? '';
        storeSession(token, updatedUser);
        
        // Reload so MustChangePasswordGuard kicks in
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);