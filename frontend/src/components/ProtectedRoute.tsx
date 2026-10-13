import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const location = useLocation();
  const { user, token, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="page standalone-page">
        <section className="panel centered">
          <h2>Checking your session</h2>
          <p className="muted">Please wait a moment.</p>
        </section>
      </div>
    );
  }

  if (!user || !token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
