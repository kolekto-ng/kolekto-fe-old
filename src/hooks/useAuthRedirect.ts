import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store';

interface UseAuthRedirectOptions {
  redirectTo?: string;
  requireAuth?: boolean;
  redirectIfAuthenticated?: boolean;
}

export const useAuthRedirect = (options: UseAuthRedirectOptions = {}) => {
  const { redirectTo = '/dashboard', requireAuth = false, redirectIfAuthenticated = false } = options;
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return; // Don't redirect while loading

    if (requireAuth && !user) {
      // User needs to be authenticated but isn't
      navigate('/login', { replace: true });
    } else if (redirectIfAuthenticated && user) {
      // User is authenticated but shouldn't be on this page
      navigate(redirectTo, { replace: true });
    }
  }, [user, isLoading, navigate, redirectTo, requireAuth, redirectIfAuthenticated]);

  return { user, isLoading };
};
