'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedOnly } from '@/components/ProtectedRoute';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';

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
            setScore(responseData.score || 0);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreMessage = (score: number) => {
    if (score >= 90) return 'Excellent! You\'re doing amazing!';
    if (score >= 80) return 'Great job! Keep up the good work!';
    if (score >= 70) return 'Good progress! You\'re on the right track.';
    if (score >= 60) return 'Keep going! Every step counts.';
    return 'Don\'t worry, progress takes time. Keep at it!';
  };

  const getScoreEmoji = (score: number) => {
    if (score >= 90) return '🎉';
    if (score >= 80) return '👍';
    if (score >= 70) return '😊';
    if (score >= 60) return '💪';
    return '🤝';
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

  return (
    <AuthenticatedOnly>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Check-in Completed!
            </h1>
            <p className="text-gray-600">
              Thank you for completing your check-in
            </p>
          </div>

          {/* Score Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <div className="text-center">
              <div className="text-6xl mb-4">{getScoreEmoji(score)}</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Your Score
              </h2>
              <div className={`text-5xl font-bold mb-4 ${getScoreColor(score)}`}>
                {score}%
              </div>
              <p className="text-lg text-gray-600 mb-6">
                {getScoreMessage(score)}
              </p>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
                <div 
                  className={`h-3 rounded-full transition-all duration-1000 ${
                    score >= 90 ? 'bg-green-500' :
                    score >= 80 ? 'bg-blue-500' :
                    score >= 70 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${score}%` }}
                ></div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm text-gray-500">
                <div>
                  <div className="font-semibold">Poor</div>
                  <div>0-59%</div>
                </div>
                <div>
                  <div className="font-semibold">Good</div>
                  <div>60-89%</div>
                </div>
                <div>
                  <div className="font-semibold">Excellent</div>
                  <div>90-100%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Assignment Details */}
          {assignment && (
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Check-in Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Form Title</p>
                  <p className="font-medium text-gray-900">{assignment.formTitle}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    Completed
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completed On</p>
                  <p className="font-medium text-gray-900">
                    {formResponse?.submittedAt ? 
                      (formResponse.submittedAt._seconds ? 
                        new Date(formResponse.submittedAt._seconds * 1000).toLocaleDateString() :
                        new Date(formResponse.submittedAt).toLocaleDateString()
                      ) : 
                      new Date().toLocaleDateString()
                    }
                  </p>
                </div>
                {assignment.isRecurring && (
                  <div>
                    <p className="text-sm text-gray-500">Progress</p>
                    <p className="font-medium text-gray-900">
                      Week {assignment.recurringWeek} of {assignment.totalWeeks}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-medium text-blue-900 mb-4">What's Next?</h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <span className="text-blue-600 mr-3 mt-1">📊</span>
                <div>
                  <p className="text-blue-900 font-medium">Your coach will review your responses</p>
                  <p className="text-blue-700 text-sm">They'll analyze your answers and provide personalized feedback</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-blue-600 mr-3 mt-1">📈</span>
                <div>
                  <p className="text-blue-900 font-medium">Track your progress over time</p>
                  <p className="text-blue-700 text-sm">Monitor your improvements and trends in your wellness journey</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-blue-600 mr-3 mt-1">⏰</span>
                <div>
                  <p className="text-blue-900 font-medium">Look out for your next check-in</p>
                  <p className="text-blue-700 text-sm">Complete regular check-ins to maintain momentum</p>
                </div>
              </div>
            </div>
          </div>

          {/* Your Responses */}
          {formResponse && formResponse.responses && formResponse.responses.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Your Responses</h3>
                <div className="text-sm text-gray-500">
                  Made a mistake? You can edit your responses below.
                </div>
              </div>
              <div className="space-y-6">
                {formResponse.responses.map((response, index) => (
                  <div key={response.questionId} className="border-b border-gray-100 pb-4 last:border-b-0">
                    <div className="mb-3">
                      <h4 className="text-md font-medium text-gray-900 mb-1">
                        Question {index + 1}
                      </h4>
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
          )}

          {/* Tips */}
          <div className="bg-green-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-medium text-green-900 mb-4">Tips for Better Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-green-900 mb-2">Be Consistent</h4>
                <p className="text-green-700 text-sm">Complete check-ins regularly to track your progress accurately</p>
              </div>
              <div>
                <h4 className="font-medium text-green-900 mb-2">Be Honest</h4>
                <p className="text-green-700 text-sm">Your responses help your coach provide better guidance</p>
              </div>
              <div>
                <h4 className="font-medium text-green-900 mb-2">Set Reminders</h4>
                <p className="text-green-700 text-sm">Schedule regular check-ins to stay on track</p>
              </div>
              <div>
                <h4 className="font-medium text-green-900 mb-2">Celebrate Progress</h4>
                <p className="text-green-700 text-sm">Every step forward is progress worth celebrating</p>
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/client-portal"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/client-portal/progress"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-center"
            >
              View Progress Report
            </Link>
            {formResponse && (
              <Link
                href={`/client-portal/check-in/${assignmentId}/edit`}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium text-center"
              >
                Edit Response
              </Link>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedOnly>
  );
} 