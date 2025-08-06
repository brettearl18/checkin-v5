'use client';

import { useAuth } from '@/contexts/AuthContext';
import { hasRoutePermission } from '@/lib/auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'coach' | 'client';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // If no user is logged in, redirect to login
      if (!user) {
        router.push('/login');
        return;
      }

      // If a specific role is required, check if user has that role
      if (requiredRole && user.role !== requiredRole) {
        // Redirect based on user's actual role
        switch (user.role) {
          case 'admin':
            router.push('/admin');
            break;
          case 'coach':
            router.push('/dashboard');
            break;
          case 'client':
            router.push('/client-portal');
            break;
          default:
            router.push('/login');
        }
        return;
      }

      // Check if user has permission to access this route
      if (!hasRoutePermission(user, pathname)) {
        // Redirect based on user's role
        switch (user.role) {
          case 'admin':
            router.push('/admin');
            break;
          case 'coach':
            router.push('/dashboard');
            break;
          case 'client':
            router.push('/client-portal');
            break;
          default:
            router.push('/login');
        }
        return;
      }
    }
  }, [user, loading, pathname, router, requiredRole]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If no user or no permission, don't render children
  if (!user || (requiredRole && user.role !== requiredRole) || !hasRoutePermission(user, pathname)) {
    return null;
  }

  return <>{children}</>;
} 