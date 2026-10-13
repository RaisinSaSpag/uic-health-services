import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import { useAuth } from '../context/AuthContext';
import type { AuthCallbackResponse } from '../types/hsms';

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="google-mark" viewBox="0 0 18 18">
      <path
        d="M17.64 9.2045c0-.6382-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7968 2.7155v2.2582h2.9086c1.7018-1.5664 2.6846-3.8741 2.6846-6.6146z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.8064 5.9563-2.1805l-2.9086-2.2582c-.8063.54-1.8368.8591-3.0477.8591-2.344 0-4.3281-1.5832-5.0358-3.7105H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.9642 10.7091C3.7841 10.1691 3.6818 9.5927 3.6818 9s.1023-1.1691.2824-1.7091V4.9591H.9573C.3477 6.1732 0 7.5482 0 9s.3477 2.8268.9573 4.0409l3.0069-2.3318z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.3459l2.5813-2.5813C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9591l3.0069 2.3318C4.6719 5.1627 6.656 3.5795 9 3.5795z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { user, token, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user && token) {
    return <Navigate to="/" replace />;
  }

  const startGoogleLogin = (): void => {
    setBusy(true);

    try {
      window.location.assign(api.getUri({ url: '/auth/google/redirect' }));
    } catch (err) {
      setBusy(false);
      void notifyError(getErrorMessage(err, 'Unable to start Google login.'), 'Login Failed');
    }
  };

  const submitStaffLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);

    try {
      const response = await api.post<AuthCallbackResponse>('/auth/staff/login', {
        email,
        password,
      });

      signIn(response.data.access_token, response.data.user);
      navigate('/', { replace: true });
    } catch (err) {
      setBusy(false);
      void notifyError(getErrorMessage(err, 'Unable to sign in.'), 'Login Failed');
    }
  };

  return (
    <div className="login-screen">
      <section className="login-card">
        <div className="login-seal" aria-hidden="true" />

        <h1 className="login-title">UIC Health Services Management System</h1>
        <p className="login-subtitle">
          Students sign in with Google. Clinic staff sign in with their assigned credentials.
        </p>

        <div className="login-actions">
          <button
            className="button login-google-button"
            disabled={busy}
            onClick={startGoogleLogin}
            type="button"
          >
            <span className="google-mark-wrap" aria-hidden="true">
              <GoogleMark />
            </span>
            <span>{busy ? 'Redirecting to Google...' : 'Sign in with Google'}</span>
          </button>
        </div>

        <p className="login-note">Student accounts use an institutional Google account.</p>

        <form className="form-grid" onSubmit={submitStaffLogin}>
          <div className="field full-width">
            <h3>Clinic Staff</h3>
          </div>

          <label className="field full-width">
            <span>Email</span>
            <input
              autoComplete="username"
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="field full-width">
            <span>Password</span>
            <input
              autoComplete="current-password"
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <div className="field full-width">
            <button className="button" disabled={busy} type="submit">
              {busy ? 'Signing in...' : 'Sign in as clinic staff'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
