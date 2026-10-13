import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { normalizeRoleName } from '../lib/format';

export function RoleLandingPage() {
  const { user } = useAuth();

  const role = normalizeRoleName(user?.role);

  if (role === 'student' || role === 'employee') {
    return <Navigate to="/patient" replace />;
  }

  if (role === 'nurse') {
    return <Navigate to="/nurse" replace />;
  }

  if (role === 'doctor') {
    return <Navigate to="/doctor" replace />;
  }

  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <section className="panel centered">
      <h2>No dashboard mapped yet</h2>
      <p className="muted">Your account role is not recognized in this frontend build.</p>
    </section>
  );
}
