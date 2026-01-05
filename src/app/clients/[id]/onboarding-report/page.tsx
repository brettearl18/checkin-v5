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
  const [generatingAiSummary, setGeneratingAiSummary] = useState(false);

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

  const handleGenerateAiSummary = async () => {
    if (!clientId) return;
    
    setGeneratingAiSummary(true);
    try {
      const response = await fetch(`/api/client-portal/onboarding/regenerate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Refresh the report to show new summary
          await fetchOnboardingReport();
        } else {
          alert('Failed to generate AI summary: ' + (data.message || 'Unknown error'));
        }
      } else {
        alert('Failed to generate AI summary. Please try again.');
      }
    } catch (error) {
      console.error('Error generating AI summary:', error);
      alert('Error generating AI summary. Please try again.');
    } finally {
      setGeneratingAiSummary(false);
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

          {/* AI Summary Section */}
          {!onboardingData?.aiSummary && onboardingData && (
            <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-xl border-2 border-blue-200 overflow-hidden">
              <div className="bg-blue-600 px-8 py-6 border-b-2 border-blue-700">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h2 className="text-2xl font-bold text-white">AI Coaching Summary</h2>
                </div>
              </div>
              
              <div className="p-8 text-center">
                <div className="max-w-md mx-auto">
                  <svg className="w-16 h-16 text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Generate AI Coaching Summary</h3>
                  <p className="text-gray-600 mb-6">
                    Generate an AI-powered analysis of the client's onboarding questionnaire. This will provide insights on training approach, communication style, and things to watch for.
                  </p>
                  <button
                    onClick={handleGenerateAiSummary}
                    disabled={generatingAiSummary}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                  >
                    {generatingAiSummary ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate AI Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {onboardingData?.aiSummary && (
            <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-xl border-2 border-blue-200 overflow-hidden">
              <div className="bg-blue-600 px-8 py-4 border-b-2 border-blue-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="w-6 h-6 text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-white">AI Coaching Summary</h2>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('Regenerate the AI summary? This will create a new analysis based on the current onboarding data.')) {
                        return;
                      }
                      await handleGenerateAiSummary();
                    }}
                    disabled={generatingAiSummary}
                    className="px-4 py-2 bg-white hover:bg-blue-50 disabled:bg-gray-200 disabled:cursor-not-allowed text-blue-600 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {generatingAiSummary ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerate Summary
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="p-8">
                {/* Overall Summary */}
                {onboardingData.aiSummary.summary && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Overall Assessment</h3>
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                      <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                        {onboardingData.aiSummary.summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* Goals Analysis */}
                {onboardingData.aiSummary.goals && (
                  <div className="mb-6 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-2xl mr-2">🎯</span>
                      Goals Analysis
                    </h3>
                    <div className="space-y-4">
                      {onboardingData.aiSummary.goals.primaryGoals?.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Primary Goals:</span>
                          <ul className="list-disc list-inside text-gray-800 mt-2 space-y-1">
                            {onboardingData.aiSummary.goals.primaryGoals.map((goal: string, idx: number) => (
                              <li key={idx}>{goal}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {onboardingData.aiSummary.goals.secondaryGoals?.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Secondary Goals:</span>
                          <ul className="list-disc list-inside text-gray-800 mt-2 space-y-1">
                            {onboardingData.aiSummary.goals.secondaryGoals.map((goal: string, idx: number) => (
                              <li key={idx}>{goal}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {onboardingData.aiSummary.goals.goalAnalysis && (
                        <div>
                          <span className="font-medium text-gray-700">Goal Analysis:</span>
                          <p className="text-gray-800 mt-2 leading-relaxed">{onboardingData.aiSummary.goals.goalAnalysis}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* How to Work With Them */}
                {onboardingData.aiSummary.workingApproach && (
                  <div className="mb-6 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-2xl mr-2">💪</span>
                      How to Work With Them Over the Program
                    </h3>
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <span className="font-medium text-gray-700 text-sm">Recommended Style:</span>
                          <p className="text-gray-800 mt-1 text-sm">{onboardingData.aiSummary.workingApproach.recommendedStyle}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 text-sm">Intensity:</span>
                          <p className="text-gray-800 mt-1 text-sm">{onboardingData.aiSummary.workingApproach.intensity}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 text-sm">Weekly Schedule:</span>
                          <p className="text-gray-800 mt-1 text-sm">{onboardingData.aiSummary.workingApproach.weeklySchedule}</p>
                        </div>
                      </div>
                      {onboardingData.aiSummary.workingApproach.howToWorkWithThem && (
                        <div>
                          <span className="font-medium text-gray-700">Detailed Approach:</span>
                          <p className="text-gray-800 mt-2 leading-relaxed">{onboardingData.aiSummary.workingApproach.howToWorkWithThem}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Things to Watch */}
                {onboardingData.aiSummary.thingsToWatch && (
                  <div className="mb-6 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-2xl mr-2">⚠️</span>
                      What to Watch Out For
                    </h3>
                    <div className="space-y-4">
                      {onboardingData.aiSummary.thingsToWatch.watchOutFor && (
                        <div className="mb-4">
                          <p className="text-gray-800 leading-relaxed">{onboardingData.aiSummary.thingsToWatch.watchOutFor}</p>
                        </div>
                      )}
                      <div className="grid md:grid-cols-3 gap-4">
                        {onboardingData.aiSummary.thingsToWatch.healthConcerns?.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700 text-sm">Health Concerns:</span>
                            <ul className="list-disc list-inside text-gray-800 mt-2 space-y-1 text-sm">
                              {onboardingData.aiSummary.thingsToWatch.healthConcerns.map((concern: string, idx: number) => (
                                <li key={idx}>{concern}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {onboardingData.aiSummary.thingsToWatch.potentialBarriers?.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700 text-sm">Potential Barriers:</span>
                            <ul className="list-disc list-inside text-gray-800 mt-2 space-y-1 text-sm">
                              {onboardingData.aiSummary.thingsToWatch.potentialBarriers.map((barrier: string, idx: number) => (
                                <li key={idx}>{barrier}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {onboardingData.aiSummary.thingsToWatch.redFlags?.length > 0 && (
                          <div>
                            <span className="font-medium text-red-700 text-sm">Red Flags:</span>
                            <ul className="list-disc list-inside text-red-800 mt-2 space-y-1 text-sm">
                              {onboardingData.aiSummary.thingsToWatch.redFlags.map((flag: string, idx: number) => (
                                <li key={idx}>{flag}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* SWOT Analysis */}
                {onboardingData.aiSummary.swotAnalysis && (
                  <div className="mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 shadow-sm border-2 border-indigo-200">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                      <span className="text-2xl mr-2">📊</span>
                      SWOT Analysis
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Strengths */}
                      <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                        <h4 className="font-bold text-green-700 mb-3 flex items-center">
                          <span className="text-lg mr-2">✅</span>
                          Strengths
                        </h4>
                        <ul className="list-disc list-inside text-gray-800 space-y-1 text-sm">
                          {onboardingData.aiSummary.swotAnalysis.strengths?.map((strength: string, idx: number) => (
                            <li key={idx}>{strength}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Weaknesses */}
                      <div className="bg-white rounded-lg p-4 border-2 border-orange-200">
                        <h4 className="font-bold text-orange-700 mb-3 flex items-center">
                          <span className="text-lg mr-2">⚠️</span>
                          Weaknesses
                        </h4>
                        <ul className="list-disc list-inside text-gray-800 space-y-1 text-sm">
                          {onboardingData.aiSummary.swotAnalysis.weaknesses?.map((weakness: string, idx: number) => (
                            <li key={idx}>{weakness}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Opportunities */}
                      <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                        <h4 className="font-bold text-blue-700 mb-3 flex items-center">
                          <span className="text-lg mr-2">🚀</span>
                          Opportunities
                        </h4>
                        <ul className="list-disc list-inside text-gray-800 space-y-1 text-sm">
                          {onboardingData.aiSummary.swotAnalysis.opportunities?.map((opportunity: string, idx: number) => (
                            <li key={idx}>{opportunity}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Threats */}
                      <div className="bg-white rounded-lg p-4 border-2 border-red-200">
                        <h4 className="font-bold text-red-700 mb-3 flex items-center">
                          <span className="text-lg mr-2">🔴</span>
                          Threats
                        </h4>
                        <ul className="list-disc list-inside text-gray-800 space-y-1 text-sm">
                          {onboardingData.aiSummary.swotAnalysis.threats?.map((threat: string, idx: number) => (
                            <li key={idx}>{threat}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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







                    </svg>
                    <h2 className="text-2xl font-bold text-white">AI Coaching Summary</h2>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('Regenerate the AI summary? This will create a new analysis based on the current onboarding data.')) {
                        return;
                      }
                      await handleGenerateAiSummary();
                    }}
                    disabled={generatingAiSummary}
                    className="px-4 py-2 bg-white hover:bg-blue-50 disabled:bg-gray-200 disabled:cursor-not-allowed text-blue-600 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {generatingAiSummary ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerate Summary
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="p-8">
                {/* Overall Summary */}
                {onboardingData.aiSummary.summary && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Overall Assessment</h3>
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                      <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                        {onboardingData.aiSummary.summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* Goals Analysis */}
                {onboardingData.aiSummary.goals && (
                  <div className="mb-6 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-2xl mr-2">🎯</span>
                      Goals Analysis
                    </h3>
                    <div className="space-y-4">
                      {onboardingData.aiSummary.goals.primaryGoals?.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Primary Goals:</span>
                          <ul className="list-disc list-inside text-gray-800 mt-2 space-y-1">
                            {onboardingData.aiSummary.goals.primaryGoals.map((goal: string, idx: number) => (
                              <li key={idx}>{goal}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {onboardingData.aiSummary.goals.secondaryGoals?.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700">Secondary Goals:</span>
                          <ul className="list-disc list-inside text-gray-800 mt-2 space-y-1">
                            {onboardingData.aiSummary.goals.secondaryGoals.map((goal: string, idx: number) => (
                              <li key={idx}>{goal}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {onboardingData.aiSummary.goals.goalAnalysis && (
                        <div>
                          <span className="font-medium text-gray-700">Goal Analysis:</span>
                          <p className="text-gray-800 mt-2 leading-relaxed">{onboardingData.aiSummary.goals.goalAnalysis}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* How to Work With Them */}
                {onboardingData.aiSummary.workingApproach && (
                  <div className="mb-6 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-2xl mr-2">💪</span>
                      How to Work With Them Over the Program
                    </h3>
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <span className="font-medium text-gray-700 text-sm">Recommended Style:</span>
                          <p className="text-gray-800 mt-1 text-sm">{onboardingData.aiSummary.workingApproach.recommendedStyle}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 text-sm">Intensity:</span>
                          <p className="text-gray-800 mt-1 text-sm">{onboardingData.aiSummary.workingApproach.intensity}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 text-sm">Weekly Schedule:</span>
                          <p className="text-gray-800 mt-1 text-sm">{onboardingData.aiSummary.workingApproach.weeklySchedule}</p>
                        </div>
                      </div>
                      {onboardingData.aiSummary.workingApproach.howToWorkWithThem && (
                        <div>
                          <span className="font-medium text-gray-700">Detailed Approach:</span>
                          <p className="text-gray-800 mt-2 leading-relaxed">{onboardingData.aiSummary.workingApproach.howToWorkWithThem}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Things to Watch */}
                {onboardingData.aiSummary.thingsToWatch && (
                  <div className="mb-6 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="text-2xl mr-2">⚠️</span>
                      What to Watch Out For
                    </h3>
                    <div className="space-y-4">
                      {onboardingData.aiSummary.thingsToWatch.watchOutFor && (
                        <div className="mb-4">
                          <p className="text-gray-800 leading-relaxed">{onboardingData.aiSummary.thingsToWatch.watchOutFor}</p>
                        </div>
                      )}
                      <div className="grid md:grid-cols-3 gap-4">
                        {onboardingData.aiSummary.thingsToWatch.healthConcerns?.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700 text-sm">Health Concerns:</span>
                            <ul className="list-disc list-inside text-gray-800 mt-2 space-y-1 text-sm">
                              {onboardingData.aiSummary.thingsToWatch.healthConcerns.map((concern: string, idx: number) => (
                                <li key={idx}>{concern}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {onboardingData.aiSummary.thingsToWatch.potentialBarriers?.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700 text-sm">Potential Barriers:</span>
                            <ul className="list-disc list-inside text-gray-800 mt-2 space-y-1 text-sm">
                              {onboardingData.aiSummary.thingsToWatch.potentialBarriers.map((barrier: string, idx: number) => (
                                <li key={idx}>{barrier}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {onboardingData.aiSummary.thingsToWatch.redFlags?.length > 0 && (
                          <div>
                            <span className="font-medium text-red-700 text-sm">Red Flags:</span>
                            <ul className="list-disc list-inside text-red-800 mt-2 space-y-1 text-sm">
                              {onboardingData.aiSummary.thingsToWatch.redFlags.map((flag: string, idx: number) => (
                                <li key={idx}>{flag}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* SWOT Analysis */}
                {onboardingData.aiSummary.swotAnalysis && (
                  <div className="mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 shadow-sm border-2 border-indigo-200">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                      <span className="text-2xl mr-2">📊</span>
                      SWOT Analysis
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Strengths */}
                      <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                        <h4 className="font-bold text-green-700 mb-3 flex items-center">
                          <span className="text-lg mr-2">✅</span>
                          Strengths
                        </h4>
                        <ul className="list-disc list-inside text-gray-800 space-y-1 text-sm">
                          {onboardingData.aiSummary.swotAnalysis.strengths?.map((strength: string, idx: number) => (
                            <li key={idx}>{strength}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Weaknesses */}
                      <div className="bg-white rounded-lg p-4 border-2 border-orange-200">
                        <h4 className="font-bold text-orange-700 mb-3 flex items-center">
                          <span className="text-lg mr-2">⚠️</span>
                          Weaknesses
                        </h4>
                        <ul className="list-disc list-inside text-gray-800 space-y-1 text-sm">
                          {onboardingData.aiSummary.swotAnalysis.weaknesses?.map((weakness: string, idx: number) => (
                            <li key={idx}>{weakness}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Opportunities */}
                      <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                        <h4 className="font-bold text-blue-700 mb-3 flex items-center">
                          <span className="text-lg mr-2">🚀</span>
                          Opportunities
                        </h4>
                        <ul className="list-disc list-inside text-gray-800 space-y-1 text-sm">
                          {onboardingData.aiSummary.swotAnalysis.opportunities?.map((opportunity: string, idx: number) => (
                            <li key={idx}>{opportunity}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Threats */}
                      <div className="bg-white rounded-lg p-4 border-2 border-red-200">
                        <h4 className="font-bold text-red-700 mb-3 flex items-center">
                          <span className="text-lg mr-2">🔴</span>
                          Threats
                        </h4>
                        <ul className="list-disc list-inside text-gray-800 space-y-1 text-sm">
                          {onboardingData.aiSummary.swotAnalysis.threats?.map((threat: string, idx: number) => (
                            <li key={idx}>{threat}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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






