import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { useAuth } from '../context/AuthContext';

export function ForcePasswordChangePage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth(); // Assuming your AuthContext has a refreshUser method
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
      await api.post('/auth/change-password', {
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      
      notifySuccess('Password updated successfully!');
      
      // Instead of logging out, we refresh the user state.
      // This updates `must_change_password` to false and lets the AppShell render the portal.
      if (refreshUser) {
        await refreshUser();
      }
      
      // Navigate to the dashboard/portal
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