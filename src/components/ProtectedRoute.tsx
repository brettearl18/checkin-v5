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
      // Check if user has required role
      if (requiredRole && userProfile.role !== requiredRole) {
        // Redirect based on actual role
        if (userProfile.role === 'client') {
          router.push('/client-portal');
        } else if (userProfile.role === 'coach') {
          router.push('/dashboard');
        } else if (userProfile.role === 'admin') {
          router.push('/admin');
        }
        return;
      }

      // Check if user has one of the allowed roles
      if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
        // Redirect based on actual role
        if (userProfile.role === 'client') {
          router.push('/client-portal');
        } else if (userProfile.role === 'coach') {
          router.push('/dashboard');
        } else if (userProfile.role === 'admin') {
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

  // Check role access
  if (requiredRole && userProfile.role !== requiredRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
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