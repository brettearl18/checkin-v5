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

export default function CheckInSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [assignment, setAssignment] = useState<CheckInAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);

  const assignmentId = params.id as string;
  const scoreParam = searchParams.get('score');

  useEffect(() => {
    if (scoreParam) {
      setScore(parseInt(scoreParam));
    }
    fetchAssignmentData();
  }, [assignmentId, scoreParam]);

  const fetchAssignmentData = async () => {
    try {
      const assignmentDoc = await getDoc(doc(db, 'check_in_assignments', assignmentId));
      if (assignmentDoc.exists()) {
        setAssignment(assignmentDoc.data() as CheckInAssignment);
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
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
                    {assignment.completedAt?.toDate?.()?.toLocaleDateString() || new Date().toLocaleDateString()}
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
                  <p className="font-medium text-blue-900">Your coach will review your responses</p>
                  <p className="text-sm text-blue-700">They'll provide feedback and adjust your program if needed</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-blue-600 mr-3 mt-1">📈</span>
                <div>
                  <p className="font-medium text-blue-900">Track your progress over time</p>
                  <p className="text-sm text-blue-700">View your improvement trends in your dashboard</p>
                </div>
              </div>
              <div className="flex items-start">
                <span className="text-blue-600 mr-3 mt-1">⏰</span>
                <div>
                  <p className="font-medium text-blue-900">Look out for your next check-in</p>
                  <p className="text-sm text-blue-700">Your coach will assign new check-ins based on your progress</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/client-portal"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium text-center transition-colors"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/client-portal/progress"
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-md font-medium text-center transition-colors"
            >
              View Progress Report
            </Link>
          </div>

          {/* Tips */}
          <div className="mt-8 bg-yellow-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-yellow-900 mb-4">💡 Tips for Better Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-yellow-900 mb-2">Be Consistent</p>
                <p className="text-yellow-800">Complete check-ins regularly to track your progress accurately</p>
              </div>
              <div>
                <p className="font-medium text-yellow-900 mb-2">Be Honest</p>
                <p className="text-yellow-800">Your responses help your coach provide better guidance</p>
              </div>
              <div>
                <p className="font-medium text-yellow-900 mb-2">Set Reminders</p>
                <p className="text-yellow-800">Schedule time for your check-ins to build a routine</p>
              </div>
              <div>
                <p className="font-medium text-yellow-900 mb-2">Celebrate Progress</p>
                <p className="text-yellow-800">Every improvement, no matter how small, is worth celebrating</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedOnly>
  );
} 