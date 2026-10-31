import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { notifyError, notifySuccess } from '../lib/alerts';
import { useAuth } from '../context/AuthContext';

export function ForcePasswordChangePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      notifyError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      notifyError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      
      notifySuccess('Password updated successfully! Please log in again.');
      signOut();
      navigate('/login');
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
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 chars)"
            />
          </label>

          <label className="field full-width">
            <span>Confirm New Password</span>
            <input
              type="password"
              required
              minLength={6}
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