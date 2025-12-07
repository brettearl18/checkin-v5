'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';
import {
  getTrafficLightStatus,
  getTrafficLightColor,
  getTrafficLightGradient,
  getTrafficLightIcon,
  getTrafficLightLabel,
  getTrafficLightMessage,
  getScoreRangeDescription,
  getDefaultThresholds,
  convertLegacyThresholds,
  type ScoringThresholds,
  type TrafficLightStatus
} from '@/lib/scoring-utils';

interface CheckInAssignment {
  id: string;
  formId: string;
  formTitle: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  assignedBy: string;
  assignedAt: any;
  dueDate?: any;
  status: 'pending' | 'sent' | 'completed' | 'overdue';
  sentAt?: any;
  completedAt?: any;
  responseId?: string;
  isRecurring?: boolean;
  recurringWeek?: number;
  totalWeeks?: number;
}

interface FormResponse {
  id: string;
  formId: string;
  formTitle: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  submittedAt: any;
  completedAt: any;
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  responses: Array<{
    questionId: string;
    question: string;
    answer: string | number | boolean;
    type: string;
    comment?: string;
  }>;
  status: string;
}

export default function CheckInSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [assignment, setAssignment] = useState<CheckInAssignment | null>(null);
  const [formResponse, setFormResponse] = useState<FormResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [thresholds, setThresholds] = useState<ScoringThresholds>(getDefaultThresholds('lifestyle'));
  const [trafficLightStatus, setTrafficLightStatus] = useState<TrafficLightStatus>('orange');

  const assignmentId = params.id as string;
  const scoreParam = searchParams.get('score');

  useEffect(() => {
    if (scoreParam) {
      setScore(parseInt(scoreParam));
    }
    fetchData();
  }, [assignmentId, scoreParam]);

  const fetchData = async () => {
    try {
      // Fetch assignment data
      const assignmentDoc = await getDoc(doc(db, 'check_in_assignments', assignmentId));
      if (assignmentDoc.exists()) {
        const assignmentData = assignmentDoc.data() as CheckInAssignment;
        setAssignment(assignmentData);

        // Fetch the form response using the responseId
        if (assignmentData.responseId) {
          const responseDoc = await getDoc(doc(db, 'formResponses', assignmentData.responseId));
          if (responseDoc.exists()) {
            const responseData = responseDoc.data() as FormResponse;
            setFormResponse(responseData);
            const responseScore = responseData.score || 0;
            setScore(responseScore);

            // Fetch client scoring configuration
            try {
              const scoringDoc = await getDoc(doc(db, 'clientScoring', assignmentData.clientId));
              if (scoringDoc.exists()) {
                const scoringData = scoringDoc.data();
                let clientThresholds: ScoringThresholds;

                // Check if new format (redMax/orangeMax) exists
                if (scoringData.thresholds?.redMax !== undefined && scoringData.thresholds?.orangeMax !== undefined) {
                  clientThresholds = {
                    redMax: scoringData.thresholds.redMax,
                    orangeMax: scoringData.thresholds.orangeMax
                  };
                } else if (scoringData.thresholds?.red !== undefined && scoringData.thresholds?.yellow !== undefined) {
                  // Convert legacy format
                  clientThresholds = convertLegacyThresholds(scoringData.thresholds);
                } else if (scoringData.scoringProfile) {
                  // Use profile defaults
                  clientThresholds = getDefaultThresholds(scoringData.scoringProfile as any);
                } else {
                  // Default to lifestyle
                  clientThresholds = getDefaultThresholds('lifestyle');
                }

                setThresholds(clientThresholds);
                setTrafficLightStatus(getTrafficLightStatus(responseScore, clientThresholds));
              } else {
                // No scoring config, use default lifestyle thresholds
                const defaultThresholds = getDefaultThresholds('lifestyle');
                setThresholds(defaultThresholds);
                setTrafficLightStatus(getTrafficLightStatus(responseScore, defaultThresholds));
              }
            } catch (scoringError) {
              console.error('Error fetching scoring config:', scoringError);
              // Use default lifestyle thresholds on error
              const defaultThresholds = getDefaultThresholds('lifestyle');
              setThresholds(defaultThresholds);
              setTrafficLightStatus(getTrafficLightStatus(responseScore, defaultThresholds));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Use traffic light system instead of hardcoded thresholds
  const getScoreColor = () => getTrafficLightGradient(trafficLightStatus);
  const getScoreBgColor = () => {
    switch (trafficLightStatus) {
      case 'red': return 'bg-red-50 border-red-200';
      case 'orange': return 'bg-orange-50 border-orange-200';
      case 'green': return 'bg-green-50 border-green-200';
    }
  };
  const getScoreMessage = () => getTrafficLightMessage(trafficLightStatus, score);
  const getScoreEmoji = () => {
    switch (trafficLightStatus) {
      case 'red': return '💪';
      case 'orange': return '😊';
      case 'green': return '🎉';
    }
  };

  const formatDate = (dateField: any) => {
    if (!dateField) return 'N/A';
    
    // Handle Firestore Timestamp
    if (dateField.toDate && typeof dateField.toDate === 'function') {
      return dateField.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Handle Firebase Timestamp object with _seconds
    if (dateField._seconds) {
      return new Date(dateField._seconds * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Handle Date object
    if (dateField instanceof Date) {
      return dateField.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Handle ISO string
    if (typeof dateField === 'string') {
      return new Date(dateField).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return 'N/A';
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex">
          <ClientNavigation />
          <div className="flex-1 ml-4 p-5">
            <div className="max-w-4xl">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="h-64 bg-gray-200 rounded mb-6"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-4 p-5">
          <div className="max-w-4xl">
            {/* Success Header */}
            <div className="text-center mb-6">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                Check-in Completed!
              </h1>
              <p className="text-gray-900 text-sm font-medium">
                Thank you for completing your check-in
              </p>
            </div>

            {/* Score Card */}
            <div className={`bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 p-6 mb-6 ${getScoreBgColor()}`}>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-4xl">{getTrafficLightIcon(trafficLightStatus)}</span>
                  <span className="text-3xl">{getScoreEmoji()}</span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">
                  Your Score
                </h2>
                <div className={`text-5xl font-bold mb-2 bg-gradient-to-r ${getScoreColor()} bg-clip-text text-transparent`}>
                  {score}%
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold mb-3 ${getTrafficLightColor(trafficLightStatus)}`}>
                  <span>{getTrafficLightIcon(trafficLightStatus)}</span>
                  <span>{getTrafficLightLabel(trafficLightStatus)}</span>
                </div>
                <p className="text-base text-gray-900 mb-5 font-medium">
                  {getScoreMessage()}
                </p>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200/60 rounded-full h-2.5 mb-4">
                  <div 
                    className={`h-2.5 rounded-full transition-all duration-1000 bg-gradient-to-r ${getScoreColor()}`}
                    style={{ width: `${score}%` }}
                  ></div>
                </div>
                
                {/* Score Range Description */}
                <div className="text-xs text-gray-900 space-y-1">
                  <div className="font-semibold mb-2">Your Score Ranges:</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="font-semibold flex items-center gap-1">
                        <span>🔴</span> Red
                      </div>
                      <div>0-{thresholds.redMax}%</div>
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-1">
                        <span>🟠</span> Orange
                      </div>
                      <div>{thresholds.redMax + 1}-{thresholds.orangeMax}%</div>
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-1">
                        <span>🟢</span> Green
                      </div>
                      <div>{thresholds.orangeMax + 1}-100%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment Details */}
            {assignment && (
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 p-5 mb-6">
                <h3 className="text-base font-bold text-gray-900 mb-4">Check-in Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-900 mb-1 font-medium">Form Title</p>
                    <p className="text-sm font-semibold text-gray-900">{assignment.formTitle || 'Check-in Form'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-900 mb-1 font-medium">Status</p>
                    <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Completed
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-900 mb-1 font-medium">Completed On</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formResponse?.submittedAt ? formatDate(formResponse.submittedAt) : formatDate(new Date())}
                    </p>
                  </div>
                  {assignment.isRecurring && assignment.recurringWeek && assignment.totalWeeks && (
                    <div>
                      <p className="text-xs text-gray-900 mb-1 font-medium">Progress</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          Week {assignment.recurringWeek} of {assignment.totalWeeks}
                        </p>
                        <div className="flex-1 max-w-24 bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full"
                            style={{ width: `${(assignment.recurringWeek / assignment.totalWeeks) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 mb-6 border border-blue-200/60">
              <h3 className="text-base font-bold text-gray-900 mb-4">What's Next?</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm mb-1">Your coach will review your responses</p>
                    <p className="text-gray-900 text-xs">They'll analyze your answers and provide personalized feedback</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm mb-1">Track your progress over time</p>
                    <p className="text-gray-900 text-xs">Monitor your improvements and trends in your wellness journey</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm mb-1">Look out for your next check-in</p>
                    <p className="text-gray-900 text-xs">Complete regular check-ins to maintain momentum</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Responses */}
            {formResponse && formResponse.responses && formResponse.responses.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900">Your Responses</h3>
                  {formResponse && (
                    <Link
                      href={`/client-portal/check-in/${assignmentId}/edit`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit Responses
                    </Link>
                  )}
                </div>
                <div className="space-y-4">
                  {formResponse.responses.map((response, index) => (
                    <div key={response.questionId} className="border-b border-gray-200/60 pb-4 last:border-b-0 last:pb-0">
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                            Q{index + 1}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {response.type}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{response.question}</p>
                      </div>
                      
                      <div className="bg-gray-50/80 rounded-lg p-3">
                        <p className="text-xs text-gray-900 mb-1 font-medium">Your Answer</p>
                        <p className="text-sm text-gray-900 font-semibold">
                          {typeof response.answer === 'boolean' 
                            ? (response.answer ? 'Yes' : 'No')
                            : response.answer.toString()}
                        </p>
                        {response.comment && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-900 mb-1 font-medium">Comment</p>
                            <p className="text-xs text-gray-900">{response.comment}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/client-portal/check-ins"
                className="px-5 py-2.5 bg-white/80 backdrop-blur-sm text-gray-900 rounded-xl hover:bg-white border border-gray-200/60 shadow-sm transition-all duration-200 text-sm font-semibold text-center"
              >
                Back to Check-ins
              </Link>
              <Link
                href="/client-portal"
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg text-sm font-semibold text-center"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/client-portal/progress"
                className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg text-sm font-semibold text-center"
              >
                View Progress
              </Link>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 