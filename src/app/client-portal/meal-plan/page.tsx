'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';

interface MealPlanData {
  mealPlanName?: string;
  mealPlanUrl?: string;
  mealPlanUpdatedAt?: any;
}

export default function MealPlanPage() {
  const { userProfile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mealPlan, setMealPlan] = useState<MealPlanData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMealPlan = async () => {
      if (!userProfile?.email) return;

      try {
        setLoading(true);
        // Fetch client data using email (same pattern as other client portal pages)
        const headers = await import('@/lib/auth-headers').then(m => m.getAuthHeaders());
        const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}${userProfile?.uid ? `&userUid=${encodeURIComponent(userProfile.uid)}` : ''}`, { headers });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.client) {
            const client = data.data.client;
            setMealPlan({
              mealPlanName: client.mealPlanName,
              mealPlanUrl: client.mealPlanUrl,
              mealPlanUpdatedAt: client.mealPlanUpdatedAt
            });
          }
        } else {
          setError('Failed to load meal plan information');
        }
      } catch (error) {
        console.error('Error loading meal plan:', error);
        setError('Failed to load meal plan information');
      } finally {
        setLoading(false);
      }
    };

    loadMealPlan();
  }, [userProfile?.email, userProfile?.uid]);

  const formatDate = (dateField: any) => {
    if (!dateField) return 'N/A';
    
    try {
      // Handle Firebase Timestamp objects
      if (dateField.toDate && typeof dateField.toDate === 'function') {
        return dateField.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      // Handle plain objects with _seconds (Firebase Timestamp serialized)
      if (dateField._seconds) {
        return new Date(dateField._seconds * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      // Handle Date objects or ISO strings
      if (dateField instanceof Date) {
        return dateField.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      // Handle ISO string dates
      const date = new Date(dateField);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      return 'Invalid Date';
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 flex">
          <ClientNavigation />
          <div className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading meal plan...</p>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 flex">
        <ClientNavigation />
        <div className="flex-1 p-6 lg:p-12">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Meal Plan</h1>
              <p className="text-gray-600">View and access your assigned meal plan</p>
            </div>

            {/* Meal Plan Card */}
            {mealPlan?.mealPlanName && mealPlan?.mealPlanUrl ? (
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-6 border-b-2 border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Your Meal Plan</h2>
                      <p className="text-sm text-gray-600 mt-1">{mealPlan.mealPlanName}</p>
                    </div>
                    <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  <div className="space-y-6">
                    {/* Meal Plan Info */}
                    <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Meal Plan Name</p>
                          <p className="text-lg font-semibold text-gray-900">{mealPlan.mealPlanName}</p>
                        </div>
                        {mealPlan.mealPlanUpdatedAt && (
                          <div>
                            <p className="text-sm font-medium text-gray-600 mb-1">Last Updated</p>
                            <p className="text-sm text-gray-700">{formatDate(mealPlan.mealPlanUpdatedAt)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Access Button */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <a
                        href={mealPlan.mealPlanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-center transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open Meal Plan
                      </a>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-blue-900 mb-1">About Your Meal Plan</p>
                          <p className="text-sm text-blue-800">
                            Your meal plan has been assigned by your coach. Click the button above to access your meal plan in a new tab. 
                            If you have any questions about your meal plan, please contact your coach.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b-2 border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">No Meal Plan Assigned</h2>
                </div>
                <div className="p-8 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-lg mb-2">You don't have a meal plan assigned yet</p>
                  <p className="text-gray-500 text-sm">
                    Your coach will assign a meal plan to you soon. Once assigned, it will appear here.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}
