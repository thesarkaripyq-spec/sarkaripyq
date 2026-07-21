import React, { memo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const ProtectedRoute = memo(({ children, adminOnly = false }) => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && user.role !== 'admin' && user.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  return children;
});

ProtectedRoute.displayName = 'ProtectedRoute';

export default ProtectedRoute;
