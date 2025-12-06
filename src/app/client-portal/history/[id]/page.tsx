'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedOnly } from '@/components/ProtectedRoute';
import Link from 'next/link';

interface ResponseDetail {
  id: string;
  checkInTitle: string;
  formTitle: string;
  submittedAt: string;
  submittedDate: Date;
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  status: string;
  responses: Array<{
    questionId: string;
    question: string;
    answer: string | number | boolean;
    type: string;
  }>;
  assignmentId: string | null;
  recurringWeek: number | null;
  totalWeeks: number | null;
}

export default function ResponseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [responseDetail, setResponseDetail] = useState<ResponseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const responseId = params.id as string;

  useEffect(() => {
    fetchResponseDetail();
  }, [responseId]);

  const fetchResponseDetail = async () => {
    try {
      const response = await fetch(`/api/client-portal/history/${responseId}?clientId=${userProfile?.uid}`);
      const data = await response.json();

      if (data.success) {
        setResponseDetail(data.response);
      } else {
        setError(data.message || 'Failed to load response details');
      }
    } catch (error) {
      console.error('Error fetching response detail:', error);
      setError('Failed to load response details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  if (loading) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="h-64 bg-gray-200 rounded mb-6"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
  }

  if (error || !responseDetail) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
              <p className="text-gray-600 mb-6">{error || 'Response not found'}</p>
              <Link
                href="/client-portal/history"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Back to History
              </Link>
            </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
  }

  return (
    <AuthenticatedOnly>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{responseDetail.checkInTitle}</h1>
                <p className="text-gray-600 mt-2">Response Details</p>
              </div>
              <Link
                href="/client-portal/history"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to History
              </Link>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Score</p>
                    <p className={`text-2xl font-bold ${getScoreColor(responseDetail.score)}`}>
                      {responseDetail.score}%
                    </p>
                    <p className="text-sm text-gray-500">{getScoreLabel(responseDetail.score)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Questions</p>
                    <p className="text-2xl font-bold text-gray-900">{responseDetail.totalQuestions}</p>
                    <p className="text-sm text-gray-500">Total</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Answered</p>
                    <p className="text-2xl font-bold text-gray-900">{responseDetail.answeredQuestions}</p>
                    <p className="text-sm text-gray-500">Questions</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Submitted</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatDate(responseDetail.submittedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Week Information */}
            {responseDetail.recurringWeek && responseDetail.totalWeeks && (
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Check-in Progress</h3>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Week {responseDetail.recurringWeek} of {responseDetail.totalWeeks}</span>
                      <span>{Math.round((responseDetail.recurringWeek / responseDetail.totalWeeks) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${(responseDetail.recurringWeek / responseDetail.totalWeeks) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Responses */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Your Responses</h2>
            </div>
            <div className="p-6">
              {responseDetail.responses.map((response, index) => (
                <div key={response.questionId} className="mb-8 last:mb-0">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Question {index + 1}
                    </h3>
                    <p className="text-gray-700">{response.question}</p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Your Answer</p>
                        <p className="text-lg text-gray-900">
                          {typeof response.answer === 'boolean' 
                            ? (response.answer ? 'Yes' : 'No')
                            : response.answer.toString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {response.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedOnly>
  );
} 