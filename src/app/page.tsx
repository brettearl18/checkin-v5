'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && userProfile) {
      // Redirect based on user role
      if (userProfile.role === 'client') {
        router.push('/client-portal');
      } else if (userProfile.role === 'coach') {
        router.push('/dashboard');
      } else if (userProfile.role === 'admin') {
        router.push('/admin');
      } else {
        // Default fallback
        router.push('/dashboard');
      }
    } else if (!loading && !userProfile) {
      // No user logged in, redirect to login
      router.push('/login');
    }
  }, [userProfile, loading, router]);

  // Show loading while determining redirect
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // This should not be reached, but just in case
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to CheckInV5</h1>
        <p className="text-gray-600">Redirecting you to your dashboard...</p>
      </div>
    </div>
  );
}
