'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import VoiceRecorder from '@/components/VoiceRecorder';
import EmojiReactionPicker from '@/components/EmojiReactionPicker';

interface FormResponse {
  id: string;
  clientId: string;
  clientName: string;
  formId: string;
  formTitle: string;
  responses: any[];
  score: number;
  totalQuestions: number;
  submittedAt: string;
  status: string;
}

interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
  description?: string;
}

interface CoachFeedback {
  id?: string;
  responseId: string;
  coachId: string;
  clientId: string;
  questionId?: string;
  feedbackType: 'voice' | 'text';
  content: string;
  createdAt: any;
  updatedAt: any;
}

export default function ResponseDetailPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const responseId = params.id as string;
  
  const [response, setResponse] = useState<FormResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CoachFeedback[]>([]);
  const [textFeedback, setTextFeedback] = useState<{ [key: string]: string }>({});
  const [overallTextFeedback, setOverallTextFeedback] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [isReviewed, setIsReviewed] = useState(false);
  const [markingAsReviewed, setMarkingAsReviewed] = useState(false);
  const [checkInsList, setCheckInsList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [coachResponded, setCoachResponded] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<'completed' | 'reviewed' | 'responded'>('completed');
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [questionHistory, setQuestionHistory] = useState<{ [questionId: string]: any[] }>({});
  const [loadingHistory, setLoadingHistory] = useState<{ [questionId: string]: boolean }>({});
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set()); // Track expanded questions
  const [sortBy, setSortBy] = useState<'default' | 'score'>('default'); // Sort order for Answer Summary
  const [reactions, setReactions] = useState<{ [questionId: string]: { [coachId: string]: { emoji: string; coachName: string; createdAt: string } } }>({});
  const [assignmentClientId, setAssignmentClientId] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to finish loading before fetching data
    if (authLoading) {
      return;
    }

    const fetchResponseData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if user profile is available
        if (!userProfile?.uid) {
          console.error('No user profile found');
          setError('Authentication required. Please log in.');
          setLoading(false);
          return;
        }

        // Fetch the list of check-ins to review for navigation
        let checkIns: any[] = [];
        try {
          const checkInsRes = await fetch(`/api/dashboard/check-ins-to-review?coachId=${userProfile.uid}`);
          if (checkInsRes.ok) {
            const checkInsData = await checkInsRes.json();
            if (checkInsData.success && checkInsData.data?.checkIns) {
              checkIns = checkInsData.data.checkIns;
              setCheckInsList(checkIns);
            }
          }
        } catch (error) {
          console.log('Error fetching check-ins list:', error);
          // Don't fail if this fails
        }

        // Fetch the specific response
        const responseRes = await fetch(`/api/responses/${responseId}?coachId=${userProfile.uid}`);
        
        if (!responseRes.ok) {
          throw new Error('Failed to fetch response data');
        }

        const responseData = await responseRes.json();
        
        if (!responseData.success) {
          throw new Error(responseData.message || 'Failed to fetch response');
        }

        setResponse(responseData.response);
        setQuestions(responseData.questions || []);
        setIsReviewed(responseData.response?.reviewedByCoach || false);
        setCoachResponded(responseData.response?.coachResponded || false);
        setWorkflowStatus(responseData.response?.workflowStatus || 'completed');
        setFeedbackCount(responseData.response?.feedbackCount || 0);
        setReactions(responseData.response?.reactions || {});
        
        // If clientId is missing from response, try to fetch from assignment
        // First try using assignmentId from response, then try responseId as fallback
        if (!responseData.response?.clientId) {
          const assignmentIdToTry = responseData.response?.assignmentId || responseId;
          if (assignmentIdToTry) {
            try {
              const assignmentRes = await fetch(`/api/check-in-assignments/${assignmentIdToTry}`);
              if (assignmentRes.ok) {
                const assignmentData = await assignmentRes.json();
                if (assignmentData.success && assignmentData.assignment?.clientId) {
                  setAssignmentClientId(assignmentData.assignment.clientId);
                }
              }
            } catch (error) {
              console.log('Error fetching assignment for clientId:', error);
            }
          }
        }
        
        // Find current check-in index after we have both the list and the response
        if (checkIns.length > 0 && responseData.response) {
          const index = checkIns.findIndex((ci: any) => 
            ci.id === responseId || 
            ci.responseId === responseId || 
            ci.assignmentId === responseId ||
            ci.id === responseData.response.id ||
            ci.responseId === responseData.response.id
          );
          setCurrentIndex(index >= 0 ? index : -1);
        }
        
        // Fetch existing feedback after response is loaded
        if (responseData.response?.id) {
          await fetchFeedbackForResponse(responseData.response.id);
        }
      } catch (err) {
        console.error('Error fetching response:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch response');
      } finally {
        setLoading(false);
      }
    };

    if (responseId && !authLoading) {
      fetchResponseData();
    }
  }, [responseId, userProfile?.uid, authLoading]);

  const fetchFeedbackForResponse = async (actualResponseId: string) => {
    try {
      if (!userProfile?.uid) return;
      
      const feedbackRes = await fetch(`/api/coach-feedback?responseId=${actualResponseId}&coachId=${userProfile.uid}`);
      if (feedbackRes.ok) {
        const feedbackData = await feedbackRes.json();
        if (feedbackData.success) {
          setFeedback(feedbackData.feedback);
          
          // Initialize text feedback fields
          const textFeedbackMap: { [key: string]: string } = {};
          feedbackData.feedback.forEach((f: CoachFeedback) => {
            if (f.feedbackType === 'text') {
              if (f.questionId) {
                textFeedbackMap[f.questionId] = f.content;
              } else {
                setOverallTextFeedback(f.content);
              }
            }
          });
          setTextFeedback(textFeedbackMap);
        }
      } else {
        console.error('Failed to fetch feedback:', await feedbackRes.text());
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };

  const fetchFeedback = async () => {
    // Use actual response ID if available, otherwise fallback to params
    const actualResponseId = response?.id || responseId;
    if (actualResponseId) {
      await fetchFeedbackForResponse(actualResponseId);
    }
  };

  // Refetch feedback when response is loaded (to ensure we use the correct response ID)
  useEffect(() => {
    if (response?.id && userProfile?.uid) {
      fetchFeedbackForResponse(response.id);
    }
  }, [response?.id, userProfile?.uid]);

  const saveVoiceFeedback = async (questionId: string | null, audioBlob: Blob) => {
    try {
      setSavingFeedback(true);
      
      if (!response) {
        console.error('Response not loaded yet');
        return;
      }
      
      // Use the actual response ID from the response object, not params
      const actualResponseId = response.id;
      
      // Convert audio blob to base64 for storage (in production, you'd upload to cloud storage)
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result as string;
        
        const feedbackData = {
          responseId: actualResponseId, // Use actual response ID
          coachId: userProfile?.uid,
          clientId: response.clientId,
          questionId,
          feedbackType: 'voice',
          content: base64Audio
        };

        const res = await fetch('/api/coach-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedbackData)
        });

        if (res.ok) {
          const result = await res.json();
          // Refetch feedback using the actual response ID
          await fetchFeedbackForResponse(actualResponseId);
          
          // Update workflow status if this was the first feedback
          if (result.isFirstFeedback) {
            setCoachResponded(true);
            setWorkflowStatus('responded');
            // Refetch response to get updated status
            const responseRes = await fetch(`/api/responses/${responseId}?coachId=${userProfile?.uid}`);
            if (responseRes.ok) {
              const responseData = await responseRes.json();
              if (responseData.success) {
                setCoachResponded(responseData.response?.coachResponded || false);
                setWorkflowStatus(responseData.response?.workflowStatus || 'completed');
                setFeedbackCount(responseData.response?.feedbackCount || 0);
              }
            }
          }
        } else {
          const errorData = await res.json();
          console.error('Error saving voice feedback:', errorData);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error saving voice feedback:', error);
    } finally {
      setSavingFeedback(false);
    }
  };

  const saveTextFeedback = async (questionId: string | null, text: string) => {
    try {
      setSavingFeedback(true);
      
      if (!response) {
        console.error('Response not loaded yet');
        return;
      }
      
      // Use the actual response ID from the response object, not params
      const actualResponseId = response.id;
      
      const feedbackData = {
        responseId: actualResponseId, // Use actual response ID
        coachId: userProfile?.uid,
        clientId: response.clientId,
        questionId,
        feedbackType: 'text',
        content: text
      };

      const res = await fetch('/api/coach-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData)
      });

      if (res.ok) {
        const result = await res.json();
        // Refetch feedback using the actual response ID
        await fetchFeedbackForResponse(actualResponseId);
        
        // Update workflow status if this was the first feedback
        if (result.isFirstFeedback) {
          setCoachResponded(true);
          setWorkflowStatus('responded');
          // Refetch response to get updated status
          const responseRes = await fetch(`/api/responses/${responseId}?coachId=${userProfile?.uid}`);
          if (responseRes.ok) {
            const responseData = await responseRes.json();
            if (responseData.success) {
              setCoachResponded(responseData.response?.coachResponded || false);
              setWorkflowStatus(responseData.response?.workflowStatus || 'completed');
              setFeedbackCount(responseData.response?.feedbackCount || 0);
            }
          }
        }
      } else {
        const errorData = await res.json();
        console.error('Error saving text feedback:', errorData);
      }
    } catch (error) {
      console.error('Error saving text feedback:', error);
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleTextFeedbackChange = (questionId: string | null, text: string) => {
    if (questionId) {
      setTextFeedback(prev => ({ ...prev, [questionId]: text }));
    } else {
      setOverallTextFeedback(text);
    }
  };

  const fetchQuestionHistory = async (questionId: string) => {
    if (!response?.clientId || questionHistory[questionId]) {
      // Already loaded or no client ID
      return;
    }

    if (!userProfile?.uid) {
      console.error('No user profile available for fetching coach feedback');
      return;
    }

    setLoadingHistory(prev => ({ ...prev, [questionId]: true }));
    try {
      // Include coachId to fetch matching coach feedback
      // MATCHING: API matches feedback by responseId + questionId + coachId
      const historyResponse = await fetch(
        `/api/questions/${questionId}/history?clientId=${response.clientId}&coachId=${userProfile.uid}`
      );
      
      if (historyResponse.ok) {
        const data = await historyResponse.json();
        if (data.success) {
          setQuestionHistory(prev => ({
            ...prev,
            [questionId]: data.history || []
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching question history:', error);
    } finally {
      setLoadingHistory(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const toggleQuestionHistory = (questionId: string) => {
    if (showHistoryFor === questionId) {
      setShowHistoryFor(null);
    } else {
      setShowHistoryFor(questionId);
      // Fetch history if not already loaded
      if (!questionHistory[questionId]) {
        fetchQuestionHistory(questionId);
      }
    }
  };

  const formatHistoryDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleTextFeedbackSave = (questionId: string | null) => {
    const text = questionId ? textFeedback[questionId] : overallTextFeedback;
    if (text && text.trim()) {
      saveTextFeedback(questionId, text.trim());
    }
  };

  const handleMarkAsReviewed = async () => {
    if (!response || !userProfile) return;
    
    setMarkingAsReviewed(true);
    try {
      const res = await fetch(`/api/responses/${responseId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: userProfile.uid,
          reviewedAt: new Date().toISOString()
        })
      });

      if (res.ok) {
        setIsReviewed(true);
        // Optionally create notification for client
        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: response.clientId,
              type: 'coach_feedback_ready',
              title: 'Coach Feedback Available',
              message: `Your coach has reviewed your check-in and provided feedback.`,
              actionUrl: `/client-portal/feedback/${responseId}`,
              metadata: {
                responseId: responseId,
                formTitle: response.formTitle
              }
            })
          });
        } catch (error) {
          console.error('Error creating client notification:', error);
        }
      }
    } catch (error) {
      console.error('Error marking as reviewed:', error);
    } finally {
      setMarkingAsReviewed(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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

  const renderAnswer = (question: Question, answer: any) => {
    // Handle different response structures
    let answerValue = answer;
    
    // If answer is an object with answer property
    if (answer && typeof answer === 'object' && answer.answer !== undefined) {
      answerValue = answer.answer;
    }
    
    // If answer is an object with question and answer properties
    if (answer && typeof answer === 'object' && answer.question && answer.answer !== undefined) {
      answerValue = answer.answer;
    }
    
    // Handle different question types
    switch (question.type) {
      case 'multiple_choice':
        if (Array.isArray(answerValue)) {
          return (
            <div className="space-y-1">
              {answerValue.map((choice: string, idx: number) => (
                <span key={idx} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm mr-2">
                  {choice}
                </span>
              ))}
            </div>
          );
        }
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{answerValue}</span>;
      
      case 'scale':
        return (
          <div className="flex items-center space-x-2">
            <span className="text-base sm:text-lg font-semibold text-gray-900">{answerValue}</span>
            <span className="text-xs sm:text-sm text-gray-500">/ 10</span>
          </div>
        );
      
      case 'boolean':
        return (
          <span className={`px-2 py-1 rounded text-sm font-medium ${
            answerValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {answerValue ? 'Yes' : 'No'}
          </span>
        );
      
      default:
        return <span className="text-gray-900">{answerValue}</span>;
    }
  };

  // Calculate progress indicator data
  const reviewedQuestionsCount = questions.length > 0 ? questions.filter(q => {
    const questionFeedback = feedback.filter(f => f.questionId === q.id);
    return questionFeedback.length > 0 || textFeedback[q.id];
  }).length : 0;
  const totalQuestionsCount = questions.length;
  const progressPercentage = totalQuestionsCount > 0 ? (reviewedQuestionsCount / totalQuestionsCount) * 100 : 0;
  const firstUnreviewedQuestion = questions.length > 0 ? questions.find(q => {
    const questionFeedback = feedback.filter(f => f.questionId === q.id);
    return questionFeedback.length === 0 && !textFeedback[q.id];
  }) : null;

  if (loading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading response details...</p>
          </div>
        </div>
      </RoleProtected>
    );
  }

  if (error || !response) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Response</h2>
            <p className="text-gray-600 mb-4">{error || 'Failed to load response'}</p>
            <Link
              href="/responses"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Responses
            </Link>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6 xl:px-8">
          {/* Header */}
          <div className="mb-4 sm:mb-6 lg:mb-8">
            <div className="flex flex-col space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 sm:mb-4">
                    <Link
                      href="/responses"
                      className="inline-flex items-center px-3 py-2 sm:px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm sm:text-base w-fit"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Back to Responses
                    </Link>
                    
                    {/* Navigation Buttons */}
                    {checkInsList.length > 0 && currentIndex >= 0 && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            if (currentIndex > 0) {
                              const prevCheckIn = checkInsList[currentIndex - 1];
                              router.push(`/responses/${prevCheckIn.id}`);
                            }
                          }}
                          disabled={currentIndex === 0}
                          className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-xs sm:text-sm"
                        >
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          <span className="hidden sm:inline">Previous</span>
                          <span className="sm:hidden">Prev</span>
                        </button>
                        
                        <span className="text-xs sm:text-sm text-gray-600 px-2 sm:px-3 whitespace-nowrap">
                          {currentIndex + 1} of {checkInsList.length}
                        </span>
                        
                        <button
                          onClick={() => {
                            if (currentIndex < checkInsList.length - 1) {
                              const nextCheckIn = checkInsList[currentIndex + 1];
                              router.push(`/responses/${nextCheckIn.id}`);
                            }
                          }}
                          disabled={currentIndex === checkInsList.length - 1}
                          className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-xs sm:text-sm"
                        >
                          <span className="hidden sm:inline">Next</span>
                          <span className="sm:hidden">Next</span>
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words">Response Details</h1>
                  <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2 break-words">
                    Reviewing response from {response.clientName} for {response.formTitle}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Response Summary */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-4 sm:mb-6 lg:mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Response Summary</h2>
                {response?.clientId ? (
                  <Link
                    href={`/clients/${response.clientId}/progress`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="hidden sm:inline">View Client Profile</span>
                    <span className="sm:hidden">Profile</span>
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words">{response.clientName}</div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Client</div>
                </div>
                <div className="text-center">
                  <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${getScoreColor(response.score)}`}>
                    {response.score}%
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Score</div>
                </div>
                <div className="text-center">
                  <div className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 break-words">
                    {formatDate(response.submittedAt)}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 mt-1">Submitted</div>
                </div>
              </div>
            </div>
          </div>

          {/* Respond Section - Prominent Call to Action */}
          {!coachResponded && (
            <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 rounded-xl sm:rounded-2xl shadow-xl border-2 border-yellow-300 overflow-hidden mb-4 sm:mb-6 lg:mb-8">
              <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6">
                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 break-words">Action Required: Provide Feedback</h2>
                    <p className="text-sm sm:text-base text-gray-700 mt-1 break-words">Your client is waiting for your feedback. Add voice notes or text feedback below.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress Indicator - Review Progress */}
          {questions.length > 0 && (
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-4 sm:mb-6 lg:mb-8">
              <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Review Progress</h2>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">
                      {reviewedQuestionsCount} of {totalQuestionsCount} questions reviewed
                    </p>
                  </div>
                  {firstUnreviewedQuestion && (
                    <button
                      onClick={() => {
                        // Expand the question if it's collapsed
                        setExpandedQuestions(prev => {
                          const newSet = new Set(prev);
                          newSet.add(firstUnreviewedQuestion.id);
                          return newSet;
                        });
                        // Scroll to the question
                        setTimeout(() => {
                          const element = document.getElementById(`question-${firstUnreviewedQuestion.id}`);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Highlight briefly
                            element.classList.add('ring-4', 'ring-blue-300', 'ring-opacity-50');
                            setTimeout(() => {
                              element.classList.remove('ring-4', 'ring-blue-300', 'ring-opacity-50');
                            }, 2000);
                          }
                        }, 100);
                      }}
                      className="inline-flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm sm:text-base w-full sm:w-auto justify-center"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="hidden sm:inline">Jump to Next Unreviewed</span>
                      <span className="sm:hidden">Next Unreviewed</span>
                    </button>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out flex items-center justify-end pr-2"
                    style={{ width: `${progressPercentage}%` }}
                  >
                    {progressPercentage > 10 && (
                      <span className="text-xs font-bold text-white">
                        {Math.round(progressPercentage)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Answer Summary Table - At-a-Glance View */}
          {questions.length > 0 && (
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-4 sm:mb-6 lg:mb-8">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <div>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Answer Summary</h2>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Quick overview of all answers. Click a row to jump to detailed view.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm text-gray-600 font-medium whitespace-nowrap">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'default' | 'score')}
                      className="px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    >
                      <option value="default">Original Order</option>
                      <option value="score">Score (Red → Orange → Green)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full sm:min-w-[700px] lg:min-w-[900px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 sm:px-4 py-5 sm:py-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
                      <th className="px-3 sm:px-4 lg:px-5 py-5 sm:py-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Question</th>
                      <th className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">Answer</th>
                      <th className="px-3 sm:px-4 lg:px-5 py-5 sm:py-6 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">Score</th>
                      <th className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Helper function to get question score and status priority
                      const getQuestionScore = (question: Question, originalIndex: number): { score: number | null; statusPriority: number } => {
                        let questionScore: number | null = null;
                        if (response?.responses && Array.isArray(response.responses)) {
                          const questionResponse = response.responses.find((r: any) => 
                            r.questionId === question.id || r.question === question.text
                          );
                          if (questionResponse) {
                            questionScore = questionResponse.score !== undefined ? questionResponse.score : null;
                          } else {
                            const fallbackResponse = response.responses[originalIndex];
                            questionScore = fallbackResponse?.score !== undefined ? fallbackResponse.score : null;
                          }
                        }
                        
                        // Priority: red (0-4) = 1, orange (5-6) = 2, green (7-10) = 3, null = 4
                        let statusPriority = 4; // Default for null scores (lowest priority)
                        if (questionScore !== null) {
                          if (questionScore >= 7) {
                            statusPriority = 3; // Green
                          } else if (questionScore >= 5) {
                            statusPriority = 2; // Orange
                          } else {
                            statusPriority = 1; // Red (highest priority for sorting)
                          }
                        }
                        
                        return { score: questionScore, statusPriority };
                      };

                      // Sort questions based on sortBy
                      const questionsWithIndices = questions.map((q, idx) => ({ question: q, originalIndex: idx }));
                      const sortedQuestions = [...questionsWithIndices].sort((a, b) => {
                        if (sortBy === 'default') {
                          return a.originalIndex - b.originalIndex;
                        } else if (sortBy === 'score') {
                          const aData = getQuestionScore(a.question, a.originalIndex);
                          const bData = getQuestionScore(b.question, b.originalIndex);
                          
                          // First sort by status priority (red first)
                          if (aData.statusPriority !== bData.statusPriority) {
                            return aData.statusPriority - bData.statusPriority;
                          }
                          
                          // If same status, sort by score (lower scores first within each group)
                          if (aData.score !== null && bData.score !== null) {
                            return aData.score - bData.score;
                          }
                          
                          // Null scores go to the end
                          if (aData.score === null) return 1;
                          if (bData.score === null) return -1;
                          
                          return 0;
                        }
                        return 0;
                      });

                      return sortedQuestions.map(({ question, originalIndex }) => {
                        const index = originalIndex; // Use original index for numbering
                        // Find the corresponding answer for this question
                        let answer = null;
                        let questionScore: number | null = null;
                        let questionResponse: any = null;
                        if (response?.responses && Array.isArray(response.responses)) {
                          questionResponse = response.responses.find((r: any) => 
                            r.questionId === question.id || r.question === question.text
                          );
                          if (questionResponse) {
                            answer = questionResponse.answer;
                            questionScore = questionResponse.score !== undefined ? questionResponse.score : null;
                          } else {
                            const fallbackResponse = response.responses[index];
                            questionResponse = fallbackResponse;
                            answer = fallbackResponse?.answer || fallbackResponse;
                            questionScore = fallbackResponse?.score !== undefined ? fallbackResponse.score : null;
                          }
                        }

                      // Determine status based on score
                      let statusColor = '';
                      let statusText = '';
                      let statusBadge = '';
                      if (questionScore !== null) {
                        if (questionScore >= 7) {
                          statusColor = 'text-green-700 bg-green-50 border-green-200';
                          statusText = 'Excellent';
                          statusBadge = '✅';
                        } else if (questionScore >= 5) {
                          statusColor = 'text-yellow-700 bg-yellow-50 border-yellow-200';
                          statusText = 'Review';
                          statusBadge = '🟡';
                        } else {
                          statusColor = 'text-red-700 bg-red-50 border-red-200';
                          statusText = 'Needs Attention';
                          statusBadge = '🔴';
                        }
                      }

                      // Format answer for table display (simplified version)
                      const formatAnswerForTable = (answer: any, questionType?: string): string => {
                        if (answer === null || answer === undefined) return '—';
                        
                        // Handle objects with answer property
                        if (answer && typeof answer === 'object' && answer.answer !== undefined) {
                          answer = answer.answer;
                        }
                        
                        // Handle different types
                        if (typeof answer === 'boolean') {
                          return answer ? 'Yes' : 'No';
                        }
                        
                        if (typeof answer === 'number') {
                          // For scale questions, show rounded to 1 decimal place
                          if (questionType === 'scale') {
                            return `${answer.toFixed(1)}/10`;
                          }
                          return answer.toFixed(1);
                        }
                        
                        if (Array.isArray(answer)) {
                          return answer.join(', ');
                        }
                        
                        if (typeof answer === 'string') {
                          // Truncate long text answers
                          if (answer.length > 40) {
                            return answer.substring(0, 40) + '...';
                          }
                          return answer;
                        }
                        
                        return String(answer);
                      };

                      const answerText = formatAnswerForTable(answer, question.type);

                      return (
                        <tr
                          key={question.id}
                          onClick={() => {
                            // Scroll to the detailed question view
                            const element = document.getElementById(`question-${question.id}`);
                            if (element) {
                              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              // Highlight briefly
                              element.classList.add('ring-4', 'ring-blue-300', 'ring-opacity-50');
                              setTimeout(() => {
                                element.classList.remove('ring-4', 'ring-blue-300', 'ring-opacity-50');
                              }, 2000);
                            }
                          }}
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <td className="px-3 sm:px-4 py-5 sm:py-6 whitespace-nowrap align-top">
                            <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-sm sm:text-base font-bold text-blue-600">{index + 1}</span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 lg:px-5 py-5 sm:py-6 align-top">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="text-sm sm:text-base font-medium text-gray-900 leading-relaxed line-clamp-4">
                                  {question.text}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-600 mt-2 sm:hidden line-clamp-1">
                                  {answerText}
                                </div>
                              </div>
                              {/* Show score inline on mobile - larger and more prominent */}
                              {questionScore !== null && (
                                <div className="sm:hidden flex-shrink-0 flex items-start pt-0.5">
                                  <span className={`inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap shadow-sm ${
                                    questionScore >= 7 
                                      ? 'bg-green-100 text-green-800 border border-green-200' 
                                      : questionScore >= 5 
                                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' 
                                      : 'bg-red-100 text-red-800 border border-red-200'
                                  }`}>
                                    {questionScore.toFixed(1)}/10
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 hidden sm:table-cell align-top">
                            <div className="text-sm text-gray-700 max-w-md break-words leading-relaxed">
                              {answerText}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 lg:px-5 py-5 sm:py-6 whitespace-nowrap text-center hidden sm:table-cell align-top">
                            {questionScore !== null ? (
                              <span className={`inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-base font-bold shadow-sm ${
                                questionScore >= 7 
                                  ? 'bg-green-100 text-green-800 border border-green-200' 
                                  : questionScore >= 5 
                                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' 
                                  : 'bg-red-100 text-red-800 border border-red-200'
                              }`}>
                                {questionScore.toFixed(1)}/10
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-center hidden md:table-cell">
                            {questionScore !== null ? (
                              <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}`}>
                                {statusBadge} {statusText}
                              </span>
                            ) : (
                              <span className="text-xs sm:text-sm text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Questions and Answers with Coach Feedback */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-4 sm:mb-6 lg:mb-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Questions & Answers</h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">Add voice notes or text feedback for each question</p>
                </div>
                {coachResponded && (
                  <div className="px-3 sm:px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium text-sm sm:text-base w-fit">
                    ✓ Feedback Provided
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 sm:p-6 lg:p-8">
              {questions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg">No questions found for this response</p>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                  {questions.map((question, index) => {
                    // Find the corresponding answer for this question
                    let answer = null;
                    let questionScore: number | null = null;
                    let questionResponse: any = null;
                    if (response?.responses && Array.isArray(response.responses)) {
                      // Try to find answer by questionId first
                      questionResponse = response.responses.find((r: any) => 
                        r.questionId === question.id || r.question === question.text
                      );
                      if (questionResponse) {
                        answer = questionResponse.answer;
                        questionScore = questionResponse.score !== undefined ? questionResponse.score : null;
                      } else {
                        // Fallback to index-based matching
                        const fallbackResponse = response.responses[index];
                        questionResponse = fallbackResponse;
                        answer = fallbackResponse?.answer || fallbackResponse;
                        questionScore = fallbackResponse?.score !== undefined ? fallbackResponse.score : null;
                      }
                    }
                    
                    // Find existing feedback for this question
                    const questionFeedback = feedback.filter(f => f.questionId === question.id);
                    const voiceFeedback = questionFeedback.find(f => f.feedbackType === 'voice');
                    const textFeedbackForQuestion = textFeedback[question.id] || '';
                    
                    const isExpanded = expandedQuestions.has(question.id);
                    const hasFeedback = questionFeedback.length > 0;
                    const borderColor = questionScore !== null 
                      ? (questionScore >= 7 ? 'border-green-300' : questionScore >= 5 ? 'border-yellow-300' : 'border-red-300')
                      : 'border-gray-200';
                    const borderLeftWidth = questionScore !== null && questionScore < 5 ? 'border-l-4' : 'border-l-4';
                    
                    return (
                      <div 
                        id={`question-${question.id}`}
                        key={question.id} 
                        className={`border ${borderColor} ${borderLeftWidth} rounded-lg sm:rounded-xl bg-white shadow-sm hover:shadow-md transition-all scroll-mt-4 ${isExpanded ? 'p-3 sm:p-4 lg:p-6' : 'p-3 sm:p-4'}`}
                      >
                        {/* Collapsed Header - Always Visible */}
                        <div 
                          className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4 cursor-pointer"
                          onClick={() => {
                            setExpandedQuestions(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(question.id)) {
                                newSet.delete(question.id);
                              } else {
                                newSet.add(question.id);
                              }
                              return newSet;
                            });
                          }}
                        >
                          <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-xs sm:text-sm font-bold text-blue-600">{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className={`font-semibold text-gray-900 ${isExpanded ? 'text-sm sm:text-base lg:text-lg' : 'text-xs sm:text-sm lg:text-base'} break-words`}>
                                  {question.text}
                                </h3>
                                {!isExpanded && (
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="text-xs sm:text-sm text-gray-600 break-words">
                                      {(() => {
                                        if (answer === null || answer === undefined) return '—';
                                        if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
                                        if (typeof answer === 'number') return answer.toString();
                                        if (typeof answer === 'string') {
                                          if (answer.length > 40) return answer.substring(0, 40) + '...';
                                          return answer;
                                        }
                                        return String(answer);
                                      })()}
                                    </span>
                                    {questionScore !== null && (
                                      <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap ${
                                        questionScore >= 7 
                                          ? 'bg-green-100 text-green-700' 
                                          : questionScore >= 5 
                                          ? 'bg-yellow-100 text-yellow-700' 
                                          : 'bg-red-100 text-red-700'
                                      }`}>
                                        {questionScore.toFixed(1)}/10
                                      </span>
                                    )}
                                    {hasFeedback && (
                                      <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                                        ✓ Reviewed
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                                {/* Emoji Reaction Picker */}
                                {userProfile?.uid && (
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <EmojiReactionPicker
                                      responseId={responseId}
                                      questionId={question.id}
                                      coachId={userProfile.uid}
                                      currentReaction={reactions[question.id]?.[userProfile.uid]?.emoji}
                                      onReactionChange={(emoji) => {
                                        // Update local state
                                        setReactions(prev => {
                                          const updated = { ...prev };
                                          if (!updated[question.id]) {
                                            updated[question.id] = {};
                                          }
                                          if (emoji) {
                                            updated[question.id][userProfile.uid] = {
                                              emoji,
                                              coachName: userProfile.displayName || 'Coach',
                                              createdAt: new Date().toISOString()
                                            };
                                          } else {
                                            delete updated[question.id][userProfile.uid];
                                            if (Object.keys(updated[question.id]).length === 0) {
                                              delete updated[question.id];
                                            }
                                          }
                                          return updated;
                                        });
                                      }}
                                    />
                                  </div>
                                )}
                                {hasFeedback && (
                                  <span className="text-green-600 text-xs sm:text-sm font-medium">✓</span>
                                )}
                                <svg 
                                  className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'transform rotate-180' : ''}`}
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Content - Conditionally Rendered */}
                        {isExpanded && (
                          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                                <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                                  <div className="flex-1 min-w-0">
                                    {question.description && (
                                      <p className="text-xs sm:text-sm text-gray-600 italic mb-2 break-words">
                                        {question.description}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleQuestionHistory(question.id);
                                    }}
                                    className="ml-4 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                                    title="View answer history"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </button>
                                </div>
                            
                            {/* Question History */}
                            {showHistoryFor === question.id && (
                              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold text-gray-900">Answer History (Last 4)</h4>
                                  <button
                                    onClick={() => setShowHistoryFor(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                                {loadingHistory[question.id] ? (
                                  <div className="text-center py-4">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                  </div>
                                ) : questionHistory[question.id] && questionHistory[question.id].length > 0 ? (
                                  <div className="space-y-3">
                                    {questionHistory[question.id].filter((historyItem, index, self) => 
                                      // Deduplicate by responseId - only show first occurrence
                                      index === self.findIndex((item) => item.responseId === historyItem.responseId)
                                    ).map((historyItem, historyIndex) => {
                                      const hasFeedback = historyItem.coachFeedback && (
                                        historyItem.coachFeedback.voice || historyItem.coachFeedback.text
                                      );
                                      
                                      return (
                                        <div key={historyIndex} className="p-3 bg-white rounded border border-blue-100">
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <div className="text-sm font-medium text-gray-900 mb-1">
                                                {renderAnswer(question, historyItem.answer)}
                                              </div>
                                              <div className="text-xs text-gray-500">
                                                {formatHistoryDate(historyItem.submittedAt)}
                                                {historyItem.weekNumber && ` • Week ${historyItem.weekNumber}`}
                                              </div>
                                              
                                              {/* Coach Feedback Display */}
                                              {hasFeedback && (
                                                <div className="mt-2 pt-2 border-t border-gray-200">
                                                  <div className="text-xs font-semibold text-gray-700 mb-1">Your Feedback:</div>
                                                  {historyItem.coachFeedback?.voice && (
                                                    <div className="flex items-center space-x-2 mb-1">
                                                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                      </svg>
                                                      <audio 
                                                        controls 
                                                        className="h-6 text-xs"
                                                        src={
                                                          historyItem.coachFeedback.voice.startsWith('data:') || 
                                                          historyItem.coachFeedback.voice.startsWith('http')
                                                            ? historyItem.coachFeedback.voice
                                                            : `data:audio/wav;base64,${historyItem.coachFeedback.voice}`
                                                        }
                                                      >
                                                        Your browser does not support audio playback.
                                                      </audio>
                                                    </div>
                                                  )}
                                                  {historyItem.coachFeedback?.text && (
                                                    <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-200">
                                                      {historyItem.coachFeedback.text}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                            <div className="ml-4 flex items-start space-x-2">
                                              {/* Coach Feedback Indicator */}
                                              {hasFeedback && (
                                                <div className="flex flex-col items-center space-y-1">
                                                  {historyItem.coachFeedback?.voice && (
                                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center" title="Voice feedback provided">
                                                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                      </svg>
                                                    </div>
                                                  )}
                                                  {historyItem.coachFeedback?.text && (
                                                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center" title="Text feedback provided">
                                                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                      </svg>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              {/* Score Badge */}
                                              {historyItem.score !== undefined && (
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                  historyItem.score >= 7 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : historyItem.score >= 4 
                                                    ? 'bg-orange-100 text-orange-700' 
                                                    : 'bg-red-100 text-red-700'
                                                }`}>
                                                  {typeof historyItem.score === 'number' ? historyItem.score.toFixed(1) : historyItem.score}/10
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-center py-4 text-sm text-gray-500">
                                    No previous answers found for this question
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div className="mt-3 sm:mt-4 mb-4 sm:mb-6">
                              <div className="flex items-center justify-between mb-2 gap-2">
                                <h4 className="text-xs sm:text-sm font-medium text-gray-500">Current Answer:</h4>
                                {questionScore !== null && (
                                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                                    <span className="text-[10px] sm:text-xs text-gray-500">Score:</span>
                                    <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap ${
                                      questionScore >= 7 
                                        ? 'bg-green-100 text-green-700' 
                                        : questionScore >= 4 
                                        ? 'bg-orange-100 text-orange-700' 
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {questionScore.toFixed(1)}/10
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
                                {renderAnswer(question, answer)}
                              </div>
                            </div>
                            
                            {/* Coach Feedback Section */}
                            <div className="border-t border-gray-200 pt-4 sm:pt-6 mt-4 sm:mt-6">
                              <div className="flex items-center justify-between mb-3 sm:mb-4">
                                <h4 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900">Coach Feedback</h4>
                                {/* Emoji Reaction Picker */}
                                {userProfile?.uid && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-gray-500 hidden sm:inline">Quick reaction:</span>
                                    <EmojiReactionPicker
                                      responseId={responseId}
                                      questionId={question.id}
                                      coachId={userProfile.uid}
                                      currentReaction={reactions[question.id]?.[userProfile.uid]?.emoji}
                                      onReactionChange={(emoji) => {
                                        setReactions(prev => {
                                          const updated = { ...prev };
                                          if (!updated[question.id]) {
                                            updated[question.id] = {};
                                          }
                                          if (emoji) {
                                            updated[question.id][userProfile.uid] = {
                                              emoji,
                                              coachName: userProfile.displayName || 'Coach',
                                              createdAt: new Date().toISOString()
                                            };
                                          } else {
                                            delete updated[question.id][userProfile.uid];
                                            if (Object.keys(updated[question.id]).length === 0) {
                                              delete updated[question.id];
                                            }
                                          }
                                          return updated;
                                        });
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                              
                              {/* Voice Feedback */}
                              <div className="mb-3 sm:mb-4">
                                <VoiceRecorder
                                  onSave={(audioBlob) => saveVoiceFeedback(question.id, audioBlob)}
                                  existingAudioUrl={voiceFeedback?.content}
                                  label="Record Voice Note"
                                  className="mb-3"
                                />
                              </div>
                              
                              {/* Text Feedback */}
                              <div className="space-y-2 sm:space-y-3">
                                <label className="block text-xs sm:text-sm font-medium text-gray-700">
                                  Text Feedback
                                </label>
                                <textarea
                                  value={textFeedbackForQuestion}
                                  onChange={(e) => handleTextFeedbackChange(question.id, e.target.value)}
                                  placeholder="Add your feedback, suggestions, or notes for this question..."
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                                  rows={3}
                                />
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => handleTextFeedbackSave(question.id)}
                                    disabled={!textFeedbackForQuestion.trim() || savingFeedback}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm font-medium"
                                  >
                                    {savingFeedback ? 'Saving...' : 'Save Feedback'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Overall Coach Summary */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-4 sm:mb-6 lg:mb-8">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 border-b border-gray-100">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Overall Coach Summary</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Provide overall feedback and recommendations for the client</p>
            </div>
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="space-y-6">
                {/* Voice Summary */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Voice Summary</h3>
                  <VoiceRecorder
                    onSave={(audioBlob) => saveVoiceFeedback(null, audioBlob)}
                    existingAudioUrl={feedback.find(f => !f.questionId && f.feedbackType === 'voice')?.content}
                    label="Record Overall Voice Summary"
                  />
                </div>
                
                {/* Text Summary */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Text Summary</h3>
                  <textarea
                    value={overallTextFeedback}
                    onChange={(e) => handleTextFeedbackChange(null, e.target.value)}
                    placeholder="Provide overall feedback, recommendations, action items, or encouragement for the client..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    rows={6}
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={() => handleTextFeedbackSave(null)}
                      disabled={!overallTextFeedback.trim() || savingFeedback}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {savingFeedback ? 'Saving...' : 'Save Overall Summary'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mark as Reviewed Section */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 overflow-hidden mt-4 sm:mt-6 lg:mt-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 border-b border-gray-100">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Review Status</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Mark this response as reviewed when you're done providing feedback</p>
            </div>
            <div className="p-4 sm:p-6 lg:p-8">
              {isReviewed ? (
                <div className="flex items-center space-x-2 sm:space-x-3 text-green-600">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-base sm:text-lg font-semibold">This response has been marked as reviewed</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base text-gray-700 mb-2">Once you've finished reviewing and providing feedback, mark this response as reviewed.</p>
                    <p className="text-xs sm:text-sm text-gray-500">The client will be notified that your feedback is ready.</p>
                  </div>
                  <button
                    onClick={handleMarkAsReviewed}
                    disabled={markingAsReviewed}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto"
                  >
                    {markingAsReviewed ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Marking...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Mark as Reviewed</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 