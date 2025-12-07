'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'coach' | 'client';
  allowedRoles?: ('admin' | 'coach' | 'client')[];
}

export function AuthenticatedOnly({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !userProfile) {
      router.push('/login');
    }
  }, [userProfile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  return <>{children}</>;
}

export function RoleProtected({ children, requiredRole, allowedRoles }: ProtectedRouteProps) {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !userProfile) {
      router.push('/login');
      return;
    }

    if (!loading && userProfile) {
      // Helper to check if user has a role (supports multiple roles)
      const hasRole = (role: string) => {
        return userProfile.role === role || 
               (userProfile.roles && userProfile.roles.includes(role as any));
      };

      // Check if user has required role
      if (requiredRole && !hasRole(requiredRole)) {
        // Redirect based on primary role or first role in roles array
        const primaryRole = userProfile.role || (userProfile.roles && userProfile.roles[0]) || 'client';
        if (primaryRole === 'client') {
          router.push('/client-portal');
        } else if (primaryRole === 'coach') {
          router.push('/dashboard');
        } else if (primaryRole === 'admin') {
          router.push('/admin');
        }
        return;
      }

      // Check if user has one of the allowed roles
      if (allowedRoles && !allowedRoles.some(role => hasRole(role))) {
        // Redirect based on primary role
        const primaryRole = userProfile.role || (userProfile.roles && userProfile.roles[0]) || 'client';
        if (primaryRole === 'client') {
          router.push('/client-portal');
        } else if (primaryRole === 'coach') {
          router.push('/dashboard');
        } else if (primaryRole === 'admin') {
          router.push('/admin');
        }
        return;
      }
    }
  }, [userProfile, loading, router, requiredRole, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  // Helper to check if user has a role (supports multiple roles)
  const hasRole = (role: string) => {
    return userProfile.role === role || 
           (userProfile.roles && userProfile.roles.includes(role as any));
  };

  // Check role access
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.some(role => hasRole(role))) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Legacy component for backward compatibility
export default function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  return <RoleProtected requiredRole={requiredRole as any}>{children}</RoleProtected>;
} 