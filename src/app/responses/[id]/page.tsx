'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import VoiceRecorder from '@/components/VoiceRecorder';

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
  const { userProfile } = useAuth();
  const params = useParams();
  const responseId = params.id as string;
  
  const [response, setResponse] = useState<FormResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CoachFeedback[]>([]);
  const [textFeedback, setTextFeedback] = useState<{ [key: string]: string }>({});
  const [overallTextFeedback, setOverallTextFeedback] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);

  useEffect(() => {
    const fetchResponseData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch the specific response
        const responseRes = await fetch(`/api/responses/${responseId}?coachId=${userProfile?.uid || 'demo-coach-id'}`);
        
        if (!responseRes.ok) {
          throw new Error('Failed to fetch response data');
        }

        const responseData = await responseRes.json();
        
        if (!responseData.success) {
          throw new Error(responseData.message || 'Failed to fetch response');
        }

        setResponse(responseData.response);
        setQuestions(responseData.questions || []);
        
        // Fetch existing feedback
        await fetchFeedback();
      } catch (err) {
        console.error('Error fetching response:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch response');
      } finally {
        setLoading(false);
      }
    };

    if (responseId) {
      fetchResponseData();
    }
  }, [responseId, userProfile?.uid]);

  const fetchFeedback = async () => {
    try {
      const feedbackRes = await fetch(`/api/coach-feedback?responseId=${responseId}&coachId=${userProfile?.uid}`);
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
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };

  const saveVoiceFeedback = async (questionId: string | null, audioBlob: Blob) => {
    try {
      setSavingFeedback(true);
      
      // Convert audio blob to base64 for storage (in production, you'd upload to cloud storage)
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = reader.result as string;
        
        const feedbackData = {
          responseId,
          coachId: userProfile?.uid,
          clientId: response?.clientId,
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
          await fetchFeedback();
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
      
      const feedbackData = {
        responseId,
        coachId: userProfile?.uid,
        clientId: response?.clientId,
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
        await fetchFeedback();
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

  const handleTextFeedbackSave = (questionId: string | null) => {
    const text = questionId ? textFeedback[questionId] : overallTextFeedback;
    if (text && text.trim()) {
      saveTextFeedback(questionId, text.trim());
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
        <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-4">
                  <Link
                    href="/responses"
                    className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Responses
                  </Link>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mt-4">Response Details</h1>
                <p className="text-gray-600 mt-2">
                  Reviewing response from {response.clientName} for {response.formTitle}
                </p>
              </div>
            </div>
          </div>

          {/* Response Summary */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Response Summary</h2>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{response.clientName}</div>
                  <div className="text-sm text-gray-500">Client</div>
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
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Questions & Answers</h2>
              <p className="text-gray-600 mt-1">Add voice notes or text feedback for each question</p>
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
                    const textFeedbackForQuestion = textFeedback[question.id] || '';
                    
                    return (
                      <div key={question.id} className="border border-gray-200 rounded-xl p-6">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              {question.text}
                            </h3>
                            <div className="mt-4 mb-6">
                              <h4 className="text-sm font-medium text-gray-500 mb-2">Answer:</h4>
                              {renderAnswer(question, answer)}
                            </div>
                            
                            {/* Coach Feedback Section */}
                            <div className="border-t border-gray-200 pt-6">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4">Coach Feedback</h4>
                              
                              {/* Voice Feedback */}
                              <div className="mb-4">
                                <VoiceRecorder
                                  onSave={(audioBlob) => saveVoiceFeedback(question.id, audioBlob)}
                                  existingAudioUrl={voiceFeedback?.content}
                                  label="Record Voice Note"
                                  className="mb-3"
                                />
                              </div>
                              
                              {/* Text Feedback */}
                              <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">
                                  Text Feedback
                                </label>
                                <textarea
                                  value={textFeedbackForQuestion}
                                  onChange={(e) => handleTextFeedbackChange(question.id, e.target.value)}
                                  placeholder="Add your feedback, suggestions, or notes for this question..."
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                                  rows={3}
                                />
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => handleTextFeedbackSave(question.id)}
                                    disabled={!textFeedbackForQuestion.trim() || savingFeedback}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                  >
                                    {savingFeedback ? 'Saving...' : 'Save Feedback'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Overall Coach Summary */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Overall Coach Summary</h2>
              <p className="text-gray-600 mt-1">Provide overall feedback and recommendations for the client</p>
            </div>
            <div className="p-8">
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
        </div>
      </div>
    </RoleProtected>
  );
} 