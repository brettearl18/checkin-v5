'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

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
  reactions?: { [questionId: string]: { [coachId: string]: { emoji: string; coachName: string; createdAt: string } } };
}

interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
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

export default function ClientFeedbackPage() {
  const { userProfile } = useAuth();
  const params = useParams();
  const responseId = params.id as string;
  
  const [response, setResponse] = useState<FormResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [feedback, setFeedback] = useState<CoachFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientApproved, setClientApproved] = useState<boolean>(false);
  const [approving, setApproving] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch the specific response
        if (!userProfile?.uid) {
          console.error('No user profile found');
          return;
        }
        const responseRes = await fetch(`/api/responses/${responseId}?clientId=${userProfile.uid}`);
        
        if (!responseRes.ok) {
          throw new Error('Failed to fetch response data');
        }

        const responseData = await responseRes.json();
        
        if (!responseData.success) {
          throw new Error(responseData.message || 'Failed to fetch response');
        }

        setResponse(responseData.response);
        setQuestions(responseData.questions || []);
        
        // Check if client has already approved
        if (responseData.response?.clientApproved) {
          setClientApproved(true);
        }
        
        // Fetch coach feedback
        await fetchFeedback();
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    if (responseId) {
      fetchData();
    }
  }, [responseId, userProfile?.uid]);

  const fetchFeedback = async () => {
    try {
      // For clients, fetch feedback by responseId and clientId
      const feedbackRes = await fetch(`/api/coach-feedback?responseId=${responseId}&clientId=${userProfile?.uid}`);
      if (feedbackRes.ok) {
        const feedbackData = await feedbackRes.json();
        if (feedbackData.success) {
          setFeedback(feedbackData.feedback);
        }
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
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
            <span className="text-lg font-semibold text-gray-900">{answerValue}</span>
            <span className="text-sm text-gray-500">/ 10</span>
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

  const playAudio = (audioContent: string) => {
    try {
      // Check if content is already a data URL
      let audioSrc = audioContent;
      if (!audioContent.startsWith('data:') && !audioContent.startsWith('http')) {
        // If it's base64, convert to data URL
        // Assume it's audio/wav format (as recorded by VoiceRecorder)
        audioSrc = `data:audio/wav;base64,${audioContent}`;
      }
      const audio = new Audio(audioSrc);
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        alert('Unable to play audio. Please try again.');
      });
    } catch (error) {
      console.error('Error creating audio element:', error);
      alert('Unable to play audio. Please try again.');
    }
  };

  const handleApprove = async () => {
    if (!responseId || !userProfile?.uid || clientApproved || approving) return;

    setApproving(true);
    try {
      const response = await fetch(`/api/responses/${responseId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: userProfile.uid
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setClientApproved(true);
        } else {
          alert(data.message || 'Failed to approve feedback');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to approve feedback');
      }
    } catch (error) {
      console.error('Error approving feedback:', error);
      alert('Failed to approve feedback. Please try again.');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading feedback...</p>
          </div>
        </div>
      </RoleProtected>
    );
  }

  if (error || !response) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Feedback</h2>
            <p className="text-gray-600 mb-4">{error || 'Failed to load feedback'}</p>
            <Link
              href="/client-portal/history"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to History
            </Link>
          </div>
        </div>
      </RoleProtected>
    );
  }

  // Get overall feedback
  const overallFeedback = feedback.filter(f => !f.questionId);
  const overallVoiceFeedback = overallFeedback.find(f => f.feedbackType === 'voice');
  const overallTextFeedback = overallFeedback.find(f => f.feedbackType === 'text');

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-4">
                  <Link
                    href="/client-portal/history"
                    className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to History
                  </Link>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mt-4">Coach Feedback</h1>
                <p className="text-gray-600 mt-2">
                  Your response to {response.formTitle} with coach feedback
                </p>
              </div>
            </div>
          </div>

          {/* Response Summary */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Your Response Summary</h2>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{response.formTitle}</div>
                  <div className="text-sm text-gray-500">Form</div>
                </div>
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(response.score)}`}>
                    {response.score}%
                  </div>
                  <div className="text-sm text-gray-500">Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatDate(response.submittedAt)}
                  </div>
                  <div className="text-sm text-gray-500">Submitted</div>
                </div>
              </div>
            </div>
          </div>

          {/* Questions and Answers with Coach Feedback */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Questions & Coach Feedback</h2>
              <p className="text-gray-600 mt-1">Your answers and your coach's personalized feedback</p>
            </div>
            <div className="p-8">
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
                <div className="space-y-8">
                  {questions.map((question, index) => {
                    // Find the corresponding answer for this question
                    let answer = null;
                    if (response?.responses && Array.isArray(response.responses)) {
                      // Try to find answer by questionId first
                      const questionResponse = response.responses.find((r: any) => 
                        r.questionId === question.id || r.question === question.text
                      );
                      if (questionResponse) {
                        answer = questionResponse.answer;
                      } else {
                        // Fallback to index-based matching
                        answer = response.responses[index]?.answer || response.responses[index];
                      }
                    }
                    
                    // Find existing feedback for this question
                    const questionFeedback = feedback.filter(f => f.questionId === question.id);
                    const voiceFeedback = questionFeedback.find(f => f.feedbackType === 'voice');
                    const textFeedback = questionFeedback.find(f => f.feedbackType === 'text');
                    const questionReactions = response?.reactions?.[question.id] || {};
                    
                    return (
                      <div key={question.id} className="border border-gray-200 rounded-xl p-6">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-lg font-semibold text-gray-900 flex-1">
                                {question.text}
                              </h3>
                              {/* Display Reactions */}
                              {questionReactions && Object.keys(questionReactions).length > 0 && (
                                <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                                  {Object.values(questionReactions).map((reaction: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="relative group"
                                      title={`${reaction.coachName || 'Coach'} reacted ${new Date(reaction.createdAt).toLocaleDateString()}`}
                                    >
                                      <span className="text-2xl">{reaction.emoji}</span>
                                      {/* Tooltip on hover */}
                                      <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {reaction.coachName || 'Coach'}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="mt-4 mb-6">
                              <h4 className="text-sm font-medium text-gray-500 mb-2">Your Answer:</h4>
                              {renderAnswer(question, answer)}
                            </div>
                            
                            {/* Coach Feedback Section */}
                            {(voiceFeedback || textFeedback || (questionReactions && Object.keys(questionReactions).length > 0)) && (
                              <div className="border-t border-gray-200 pt-6">
                                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Coach Feedback
                                </h4>
                                
                                {/* Reactions Display */}
                                {questionReactions && Object.keys(questionReactions).length > 0 && (
                                  <div className="mb-4 pb-4 border-b border-gray-200">
                                    <h5 className="text-sm font-medium text-gray-700 mb-2">Coach Reaction:</h5>
                                    <div className="flex items-center space-x-3">
                                      {Object.entries(questionReactions).map(([coachId, reaction]: [string, any]) => (
                                        <div
                                          key={coachId}
                                          className="flex items-center space-x-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
                                        >
                                          <span className="text-2xl">{reaction.emoji}</span>
                                          <span className="text-sm text-gray-700">{reaction.coachName || 'Coach'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Voice Feedback */}
                                {voiceFeedback && (
                                  <div className="mb-4">
                                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                      <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                      </svg>
                                      Voice Note
                                    </h5>
                                    <button
                                      onClick={() => playAudio(voiceFeedback.content)}
                                      className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>Play Voice Note</span>
                                    </button>
                                  </div>
                                )}
                                
                                {/* Text Feedback */}
                                {textFeedback && (
                                  <div>
                                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                      <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      Text Feedback
                                    </h5>
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                      <p className="text-gray-900 leading-relaxed">{textFeedback.content}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Overall Coach Summary - Moved to bottom so clients review question feedback first */}
          {overallFeedback.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 mt-8">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-8 py-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900">Overall Coach Summary</h2>
                <p className="text-gray-600 mt-1">Your coach's overall feedback and recommendations</p>
              </div>
              <div className="p-8">
                <div className="space-y-6">
                  {/* Voice Summary */}
                  {overallVoiceFeedback && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Voice Summary
                      </h3>
                      <button
                        onClick={() => playAudio(overallVoiceFeedback.content)}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Play Voice Summary</span>
                      </button>
                    </div>
                  )}
                  
                  {/* Text Summary */}
                  {overallTextFeedback && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Text Summary
                      </h3>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-gray-900 leading-relaxed">{overallTextFeedback.content}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Received and Approved Button */}
                    <button
                      onClick={handleApprove}
                      disabled={clientApproved || approving}
                      className={`flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${
                        clientApproved
                          ? 'bg-green-600 cursor-default'
                          : approving
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {clientApproved ? (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>✓ Received and Approved</span>
                        </>
                      ) : approving ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Approving...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Received and Approved</span>
                        </>
                      )}
                    </button>

                    {/* Received and Reply Button */}
                    <Link
                      href={`/client-portal/messages?responseId=${responseId}&formTitle=${encodeURIComponent(response?.formTitle || 'Check-in')}&submittedAt=${encodeURIComponent(response?.submittedAt || '')}`}
                      className="flex-1 px-6 py-3 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>Received and Reply</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </RoleProtected>
  );
} 