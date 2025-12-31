'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';

export default function OnboardingReportPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const clientId = params.id as string;
  const [onboardingData, setOnboardingData] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (clientId) {
      fetchClientData();
      fetchOnboardingReport();
    }
  }, [clientId]);

  const fetchClientData = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}`);
      const data = await response.json();
      if (data.success) {
        setClient(data.client);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    }
  };

  const fetchOnboardingReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/client-portal/onboarding/report?clientId=${clientId}`);
      const data = await response.json();
      if (data.success) {
        setOnboardingData(data.data);
      } else {
        setError(data.message || 'No onboarding data found');
      }
    } catch (error) {
      console.error('Error fetching onboarding report:', error);
      setError('Failed to load onboarding report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  if (error && !onboardingData) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No Onboarding Data</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link
                href={`/clients/${clientId}`}
                className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
              >
                Back to Client Profile
              </Link>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Link
                  href={`/clients/${clientId}`}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                  title="Back to Client Profile"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Onboarding Questionnaire Report</h1>
                  {client && (
                    <p className="text-gray-600 mt-1">
                      {client.firstName} {client.lastName}
                      {onboardingData?.submittedAt && (
                        <span className="ml-2">
                          • Submitted on {new Date(onboardingData.submittedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              {onboardingData?.status === 'submitted' && (
                <span className="px-4 py-2 bg-green-600 text-white rounded-full text-sm font-medium">
                  Submitted
                </span>
              )}
            </div>
          </div>

          {/* Onboarding Report Content */}
          {onboardingData && onboardingData.sections && onboardingData.sections.length > 0 ? (
            <div className="space-y-6">
              {onboardingData.sections.map((section: any) => (
                <div key={section.id} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-green-50 px-8 py-6 border-b-2 border-green-200">
                    <div className="flex items-center">
                      <span className="text-3xl mr-4">{section.icon}</span>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                          Section {section.id}: {section.name}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                          {section.questions.filter((q: any) => q.answered).length} of {section.questions.length} questions answered
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-8">
                    <div className="space-y-6">
                      {section.questions.map((question: any) => {
                        // Skip unanswered required questions
                        if (!question.answered && question.required) return null;
                        
                        return (
                          <div key={question.id} className="border-l-4 border-green-500 pl-6 py-3">
                            <p className="font-semibold text-lg text-gray-900 mb-2">
                              {question.questionText}
                              {question.required && <span className="text-red-500 ml-1">*</span>}
                            </p>
                            <div className="bg-gray-50 rounded-lg p-4">
                              <p className="text-gray-800 text-base">
                                {question.answer || <span className="text-gray-400 italic">Not answered</span>}
                              </p>
                            </div>
                            {question.followUpQuestion && question.followUpQuestion.answer && (
                              <div className="mt-4 ml-6 border-l-2 border-gray-300 pl-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">
                                  {question.followUpQuestion.questionText}
                                </p>
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <p className="text-gray-700 text-sm">
                                    {question.followUpQuestion.answer}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No Onboarding Data Available</h2>
              <p className="text-gray-600 mb-6">
                The client has not yet completed or submitted their onboarding questionnaire.
              </p>
              <Link
                href={`/clients/${clientId}`}
                className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
              >
                Back to Client Profile
              </Link>
            </div>
          )}
        </div>
      </div>
    </RoleProtected>
  );
}






