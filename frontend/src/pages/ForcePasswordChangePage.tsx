import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { useAuth } from '../context/AuthContext';
import { storeSession } from '../lib/session';

export function ForcePasswordChangePage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      notifyError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      notifyError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      // 🚨 P5-1 FIX: Capture the new token from the response
      const res = await api.post<{
        access_token: string;
        user: Record<string, unknown>;
      }>('/auth/change-password', {
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      // Store the new token BEFORE calling refreshProfile
      // (the old token is now invalid because tokens_valid_after was bumped).
      if (res.data.access_token) {
        storeSession(res.data.access_token, res.data.user as any);
      }

      notifySuccess('Password updated successfully!');

      if (refreshProfile) {
        await refreshProfile();
      }

      navigate('/');
    } catch (err) {
      notifyError('Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <section className="panel" style={{ maxWidth: '480px', width: '100%' }}>
        <h2>🔒 Welcome, {user?.first_name}!</h2>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          For your security, please change the default password before accessing your records.
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field full-width">
            <span>New Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 8 chars)"
            />
          </label>

          <label className="field full-width">
            <span>Confirm New Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
            />
          </label>

          <div className="field full-width">
            <button className="button primary" type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}