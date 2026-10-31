import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { notifyError } from '../lib/alerts';
import { getErrorMessage } from '../lib/http';
import { useAuth } from '../context/AuthContext';
import type { AuthCallbackResponse } from '../types/hsms';

export function LoginPage() {
  const navigate = useNavigate();
  const { user, token, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // State for the active tab
  const [loginType, setLoginType] = useState<'staff' | 'patient'>('staff');

  if (user && token) {
    return <Navigate to="/" replace />;
  }

  const submitLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);

    try {
      // The backend now accepts both staff and patients on this endpoint
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
          {loginType === 'staff' 
            ? 'Clinic staff sign in with their assigned credentials.' 
            : 'Students & Employees sign in with their UIC email.'}
        </p>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee' }}>
          <button
            type="button"
            onClick={() => { setLoginType('staff'); setEmail(''); setPassword(''); }}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: loginType === 'staff' ? '2px solid #d44974' : '2px solid transparent',
              color: loginType === 'staff' ? '#d44974' : '#666',
              fontWeight: loginType === 'staff' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Clinic Staff
          </button>
          <button
            type="button"
            onClick={() => { setLoginType('patient'); setEmail(''); setPassword(''); }}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: loginType === 'patient' ? '2px solid #d44974' : '2px solid transparent',
              color: loginType === 'patient' ? '#d44974' : '#666',
              fontWeight: loginType === 'patient' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Student & Employee Portal
          </button>
        </div>

        <form className="form-grid" onSubmit={submitLogin}>
          <label className="field full-width">
            <span>{loginType === 'staff' ? 'Staff Email' : 'UIC Email Address'}</span>
            <input
              autoComplete="username"
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
              placeholder={loginType === 'staff' ? 'nurse@uic.edu.ph' : 'student.or.employee@uic.edu.ph'}
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
              placeholder={loginType === 'staff' ? 'Enter password' : 'Default password is your email'}
            />
          </label>

          <div className="field full-width">
            <button className="button" disabled={busy} type="submit">
              {busy 
                ? 'Signing in...' 
                : (loginType === 'staff' ? 'Sign in as clinic staff' : 'Sign in as student / employee')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}