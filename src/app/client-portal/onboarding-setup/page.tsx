'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RoleProtected } from '@/components/ProtectedRoute';

// Redirect old onboarding-setup route to unified Measurements page
export default function OnboardingSetupPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to measurements page which now handles onboarding
    router.replace('/client-portal/measurements');
  }, [router]);

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderBottomColor: '#daa450' }}></div>
          <p className="text-gray-600">Redirecting to Measurements...</p>
        </div>
      </div>
    </RoleProtected>
  );
}
