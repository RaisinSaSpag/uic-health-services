import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { normalizeRoleName } from '../lib/format';
import { getErrorMessage } from '../lib/http';
import type { AuthCallbackResponse, AuthUser } from '../types/hsms';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [statusText, setStatusText] = useState('Validating Google sign-in...');
  const hasExecuted = useRef(false);

  useEffect(() => {
    if (hasExecuted.current) {
      return;
    }

    hasExecuted.current = true;

    const run = async (): Promise<void> => {
      const query = new URLSearchParams(window.location.search);
      const googleError = query.get('error');
      const code = query.get('code');

      if (googleError) {
        const errorMessage = `Google login was denied: ${googleError}`;
        setStatusText('Sign-in was cancelled. Please try again from the login page.');
        void notifyError(errorMessage, 'Google Sign-in Failed');
        return;
      }

      const token = query.get('token');

      if (token) {
        try {
          const response = await api.get<AuthUser>('/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });

          // Clear the token from the URL so it doesn't get stored in browser history
          window.history.replaceState({}, document.title, window.location.pathname);

          signIn(token, {
            ...response.data,
            role: normalizeRoleName(response.data.role),
          });

          setStatusText('Login successful. Loading your workspace...');
          navigate('/', { replace: true });
        } catch (err) {
          const errorMessage = getErrorMessage(err, 'Failed to complete Google callback.');
          setStatusText('Sign-in failed. Please return to login and try again.');
          void notifyError(errorMessage, 'Google Sign-in Failed');
        }

        return;
      }

      if (!code) {
        const errorMessage = 'Missing authorization code in callback URL.';
        setStatusText('Unable to continue sign-in. Please retry from the login page.');
        void notifyError(errorMessage, 'Google Sign-in Failed');
        return;
      }

      try {
        const response = await api.get<AuthCallbackResponse>('/auth/google/callback', {
          params: { code },
        });

        // Clear the code from the URL so it doesn't get stored in browser history
        window.history.replaceState({}, document.title, window.location.pathname);

        signIn(response.data.access_token, {
          ...response.data.user,
          role: normalizeRoleName(response.data.user.role),
        });

        setStatusText('Login successful. Loading your workspace...');
        navigate('/', { replace: true });
      } catch (err) {
        const errorMessage = getErrorMessage(err, 'Failed to complete Google callback.');
        setStatusText('Sign-in failed. Please return to login and try again.');
        void notifyError(errorMessage, 'Google Sign-in Failed');
      }
    };

    void run();
  }, [navigate, signIn]);

  return (
    <div className="page standalone-page">
      <section className="panel centered">
        <h2>Google Sign-in Callback</h2>
        <p className="muted">{statusText}</p>
      </section>
    </div>
  );
}