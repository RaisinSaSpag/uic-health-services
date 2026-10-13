import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { normalizeRoleName } from '../lib/format';
import type { RoleName } from '../types/hsms';

interface RoleRouteProps {
  roles: RoleName[];
  children: ReactNode;
}

export function RoleRoute({ roles, children }: RoleRouteProps) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const currentRole = normalizeRoleName(user.role);

  if (!roles.includes(currentRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
