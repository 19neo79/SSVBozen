import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/app/allenamenti" replace />;
  return <>{children}</>;
}
