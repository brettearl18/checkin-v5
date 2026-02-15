'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedOnly } from '@/components/ProtectedRoute';
import Link from 'next/link';
import CoachNavigation from '@/components/CoachNavigation';

interface FormResponse {
  id: string;
  formTitle: string;
  formId: string;
  clientId: string;
  clientName?: string;
  submittedAt: string | null;
  completedAt: string | null;
  score?: number;
  totalQuestions: number;
  answeredQuestions: number;
  responses: any[];
  category: string;
  isRecurring?: boolean;
  recurringWeek?: number;
  totalWeeks?: number;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

export default function ClientFormResponsesPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [formResponses, setFormResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [showResponseModal, setShowResponseModal] = useState(false);

  const clientId = params.id as string;

  useEffect(() => {
    fetchData();
  }, [clientId]);

  const fetchData = async () => {
    try {
      const headers = await import('@/lib/auth-headers').then((m) => m.getAuthHeaders());

      // Fetch client data
      const clientResponse = await fetch(`/api/clients/${clientId}`, { headers });
      if (clientResponse.ok) {
        const clientData = await clientResponse.json();
        setClient(clientData.client);
      }

      // Fetch form responses via API (server-side Firestore; avoids client permission errors)
      const responsesResponse = await fetch(`/api/clients/${clientId}/form-responses`, { headers });
      if (responsesResponse.ok) {
        const data = await responsesResponse.json();
        setFormResponses(data.formResponses ?? []);
      } else {
        setFormResponses([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setFormResponses([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'health': return 'bg-green-100 text-green-800';
      case 'progress': return 'bg-blue-100 text-blue-800';
      case 'nutrition': return 'bg-orange-100 text-orange-800';
      case 'fitness': return 'bg-purple-100 text-purple-800';
      case 'wellness': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (timestamp: string | null | any) => {
    if (!timestamp) return 'N/A';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : (timestamp.toDate ? timestamp.toDate() : new Date(timestamp));
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const openResponseModal = (response: FormResponse) => {
    setSelectedResponse(response);
    setShowResponseModal(true);
  };

  if (loading) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-gray-50 flex">
          <CoachNavigation />
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="space-y-4">
                  <div className="h-24 bg-gray-200 rounded"></div>
                  <div className="h-24 bg-gray-200 rounded"></div>
                  <div className="h-24 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
  }

  if (!client) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-gray-50 flex">
          <CoachNavigation />
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">Client not found</h1>
                <Link href="/clients" className="text-blue-600 hover:text-blue-800">
                  ← Back to Clients
                </Link>
              </div>
            </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
  }

  return (
    <AuthenticatedOnly>
      <div className="min-h-screen bg-gray-50 flex">
        <CoachNavigation />
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Form Responses - {client.firstName} {client.lastName}
                  </h1>
                  <p className="text-gray-800 mt-2">View detailed responses from completed check-ins</p>
                </div>
                <Link
                  href={`/clients/${clientId}`}
                  className="text-gray-800 hover:text-gray-900 font-medium px-4 py-2"
                >
                  ← Back to Profile
                </Link>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <p className="text-sm font-medium text-gray-800">Total Responses</p>
                <p className="text-2xl font-bold text-gray-900">{formResponses.length}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <p className="text-sm font-medium text-gray-800">Average Score</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formResponses.length > 0 ? Math.round(formResponses.reduce((sum, r) => sum + (r.score || 0), 0) / formResponses.length) : 0}%
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <p className="text-sm font-medium text-gray-800">Completion Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {formResponses.length > 0 ? Math.round((formResponses.reduce((sum, r) => sum + r.answeredQuestions, 0) / formResponses.reduce((sum, r) => sum + r.totalQuestions, 0)) * 100) : 0}%
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <p className="text-sm font-medium text-gray-800">Latest Response</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formResponses.length > 0 ? formatDate(formResponses[0].submittedAt).split(' ')[0] : 'N/A'}
                </p>
              </div>
            </div>

            {/* Form Responses List */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Completed Check-ins</h2>
              </div>
              <div className="p-6">
                {formResponses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-lg">No form responses yet</p>
                    <p className="text-gray-400 text-sm mt-2">Completed check-ins will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formResponses.map((response) => (
                      <div key={response.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openResponseModal(response)}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-medium text-gray-900">{response.formTitle}</h3>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(response.category)}`}>
                              {response.category}
                            </span>
                            {response.isRecurring && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                Week {response.recurringWeek} of {response.totalWeeks}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${getScoreColor(response.score || 0)}`}>
                              {response.score || 0}%
                            </div>
                            <div className="text-xs text-gray-500">
                              {response.answeredQuestions}/{response.totalQuestions} questions
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Submitted:</span>
                            <div>{formatDate(response.submittedAt)}</div>
                          </div>
                          <div>
                            <span className="font-medium">Completed:</span>
                            <div>{formatDate(response.completedAt)}</div>
                          </div>
                          <div>
                            <span className="font-medium">Response Rate:</span>
                            <div>{Math.round((response.answeredQuestions / response.totalQuestions) * 100)}%</div>
                          </div>
                          <div>
                            <span className="font-medium">Type:</span>
                            <div>{response.isRecurring ? 'Recurring' : 'One-time'}</div>
                          </div>
                        </div>
                        
                        <div className="mt-3 text-sm text-blue-600 hover:text-blue-800">
                          Click to view detailed responses →
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Response Detail Modal */}
      {showResponseModal && selectedResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedResponse.formTitle} - Detailed Responses
                </h3>
                <button
                  onClick={() => setShowResponseModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              {/* Response Summary */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Score:</span>
                    <div className={`text-lg font-bold ${getScoreColor(selectedResponse.score || 0)}`}>
                      {selectedResponse.score || 0}%
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Submitted:</span>
                    <div>{formatDate(selectedResponse.submittedAt)}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Questions:</span>
                    <div>{selectedResponse.answeredQuestions}/{selectedResponse.totalQuestions}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Category:</span>
                    <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(selectedResponse.category)}`}>
                      {selectedResponse.category}
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Responses */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Question Responses</h4>
                {(Array.isArray(selectedResponse.responses) ? selectedResponse.responses : []).map((response, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium text-gray-900">{response.question}</h5>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {response.type}
                      </span>
                    </div>
                    <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                      <p className="text-gray-900">{response.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedOnly>
  );
} 
