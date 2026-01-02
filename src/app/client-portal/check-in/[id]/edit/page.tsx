'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedOnly } from '@/components/ProtectedRoute';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';

interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[] | Array<{ text: string; weight: number }>;
  category: string;
  coachId: string;
  createdAt: string;
  updatedAt: string;
  questionWeight?: number; // Weight of the question (1-10)
  weight?: number; // Alternative field name for weight
  yesIsPositive?: boolean; // For boolean questions: true if YES is positive
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
    comment?: string; // Optional comment/notes for the answer
  }>;
  status: string;
}

export default function EditCheckInPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [formResponse, setFormResponse] = useState<FormResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<{ [key: string]: any }>({});
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const assignmentId = params.id as string;

  useEffect(() => {
    fetchData();
  }, [assignmentId]);

  const fetchData = async () => {
    try {
      // First, get the assignment to find the responseId
      const assignmentDoc = await getDoc(doc(db, 'check_in_assignments', assignmentId));
      if (!assignmentDoc.exists()) {
        setError('Check-in assignment not found');
        setLoading(false);
        return;
      }

      const assignmentData = assignmentDoc.data();
      const responseId = assignmentData.responseId;

      if (!responseId) {
        setError('No response found for this check-in');
        setLoading(false);
        return;
      }

      // Fetch the form response
      const responseDoc = await getDoc(doc(db, 'formResponses', responseId));
      if (!responseDoc.exists()) {
        setError('Response not found');
        setLoading(false);
        return;
      }

      const responseData = responseDoc.data() as FormResponse;
      // Ensure the ID is set (Firestore doc.data() doesn't include the ID)
      setFormResponse({
        ...responseData,
        id: responseDoc.id
      });

      // Fetch all questions from the response (no filtering by category)
      const questionsData: Question[] = [];
      for (const response of responseData.responses) {
        const questionDoc = await getDoc(doc(db, 'questions', response.questionId));
        if (questionDoc.exists()) {
          const questionData = { id: questionDoc.id, ...questionDoc.data() } as Question;
          // Include all questions
          questionsData.push(questionData);
        }
      }
      setQuestions(questionsData);

      // Initialize responses with existing answers
      const initialResponses: { [key: string]: any } = {};
      const initialComments: { [key: string]: string } = {};
      responseData.responses.forEach(response => {
        initialResponses[response.questionId] = response.answer;
        if (response.comment) {
          initialComments[response.questionId] = response.comment;
        }
      });
      setResponses(initialResponses);
      setComments(initialComments);

    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load check-in data');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleCommentChange = (questionId: string, comment: string) => {
    setComments(prev => ({
      ...prev,
      [questionId]: comment
    }));
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSave = async () => {
    if (!formResponse || !formResponse.id) {
      setError('Form response data is missing. Please refresh the page.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      // Update the responses array
      const updatedResponses = formResponse.responses.map(response => ({
        ...response,
        answer: responses[response.questionId] !== undefined ? responses[response.questionId] : response.answer,
        comment: comments[response.questionId] || response.comment || ''
      }));

      // Calculate score based on answer quality with question weights
      let totalWeightedScore = 0;
      let totalWeight = 0;
      let answeredCount = 0;
      
      updatedResponses.forEach((response) => {
        const question = questions.find(q => q.id === response.questionId);
        if (!question || response.answer === undefined || response.answer === null) {
          return; // Skip unanswered questions
        }
        
        // Get question weight (default to 5 if not set)
        const questionWeight = (question as any).questionWeight || (question as any).weight || 5;
        
        let questionScore = 0; // Score out of 10
        
        switch (question.type) {
          case 'scale':
          case 'rating':
            const scaleValue = Number(response.answer);
            if (!isNaN(scaleValue) && scaleValue >= 1 && scaleValue <= 10) {
              questionScore = scaleValue;
            }
            break;
            
          case 'number':
            const numValue = Number(response.answer);
            if (!isNaN(numValue)) {
              if (numValue >= 0 && numValue <= 100) {
                questionScore = 1 + (numValue / 100) * 9;
              } else {
                questionScore = Math.min(10, Math.max(1, numValue / 10));
              }
            }
            break;
            
          case 'multiple_choice':
          case 'select':
            if (question.options && Array.isArray(question.options)) {
              const optionWithWeight = question.options.find((opt: any) => 
                (typeof opt === 'object' && opt.text === String(response.answer)) ||
                (typeof opt === 'string' && opt === String(response.answer))
              );
              
              if (optionWithWeight && typeof optionWithWeight === 'object' && optionWithWeight.weight) {
                questionScore = optionWithWeight.weight;
              } else {
                const selectedIndex = question.options.findIndex((opt: any) => 
                  (typeof opt === 'object' ? opt.text : opt) === String(response.answer)
                );
                if (selectedIndex >= 0) {
                  const numOptions = question.options.length;
                  questionScore = numOptions === 1 ? 5 : 1 + (selectedIndex / (numOptions - 1)) * 9;
                }
              }
            }
            break;
            
          case 'boolean':
            // Use yesIsPositive field to determine scoring
            const yesIsPositive = (question as any).yesIsPositive !== undefined ? (question as any).yesIsPositive : true;
            const isYes = response.answer === true || response.answer === 'yes' || response.answer === 'Yes';
            
            if (yesIsPositive) {
              questionScore = isYes ? 8 : 3;
            } else {
              questionScore = isYes ? 3 : 8;
            }
            break;
            
          case 'text':
            const textValue = String(response.answer).trim();
            if (textValue.length > 0) {
              questionScore = 5;
            }
            break;
            
          case 'textarea':
            // All textarea questions are free-form text responses and are NOT scored
            // They should have questionWeight: 0 and are for context/reference only
            questionScore = 0;
            // Skip adding to weighted score for unscored questions
            return; // Exit early, don't add to scoring
            
          default:
            questionScore = 5;
            break;
        }
        
        // Skip unscored questions (weight = 0) from scoring calculation
        if (questionWeight === 0) {
          return; // Don't add to totals for unscored questions
        }
        
        totalWeightedScore += questionScore * questionWeight;
        totalWeight += questionWeight;
        answeredCount++;
      });
      
      // Calculate final score as percentage (0-100)
      const newScore = totalWeight > 0 
        ? Math.round((totalWeightedScore / (totalWeight * 10)) * 100)
        : 0;

      // Update the form response
      await updateDoc(doc(db, 'formResponses', formResponse.id), {
        responses: updatedResponses,
        score: newScore,
        answeredQuestions: answeredCount,
        updatedAt: new Date()
      });

      // Redirect to success page
      router.push(`/client-portal/check-in/${assignmentId}/success?score=${newScore}`);

    } catch (error) {
      console.error('Error saving changes:', error);
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const answer = responses[question.id] !== undefined ? responses[question.id] : '';

    switch (question.type) {
      case 'text':
        return (
          <textarea
            value={answer as string}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            rows={4}
            placeholder="Enter your answer..."
          />
        );

      case 'textarea':
        // All textarea questions should render as actual textareas
        // This allows free-form text responses
        return (
          <textarea
            value={answer as string || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 text-base transition-all resize-y"
            placeholder="Enter your answer..."
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={answer as string}
            onChange={(e) => handleAnswerChange(question.id, Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            placeholder="Enter a number..."
          />
        );

      case 'scale':
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>1</span>
              <span>10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={answer as string}
              onChange={(e) => handleAnswerChange(question.id, Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center text-lg font-semibold text-blue-600">
              {answer || '5'}
            </div>
          </div>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center text-gray-900">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option}
                  checked={answer !== undefined && answer !== null && answer === option}
                  onChange={() => handleAnswerChange(question.id, option)}
                  className="mr-2"
                />
                {option}
              </label>
            ))}
          </div>
        );

      case 'boolean':
        return (
          <div className="space-y-2">
            <label className="flex items-center text-gray-900">
              <input
                type="radio"
                name={`question-${question.id}`}
                value="true"
                checked={answer === true || answer === 'yes'}
                onChange={() => handleAnswerChange(question.id, true)}
                className="mr-2"
              />
              Yes
            </label>
            <label className="flex items-center text-gray-900">
              <input
                type="radio"
                name={`question-${question.id}`}
                value="false"
                checked={answer === false || answer === 'no'}
                onChange={() => handleAnswerChange(question.id, false)}
                className="mr-2"
              />
              No
            </label>
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={answer as string}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            placeholder="Enter your answer..."
          />
        );
    }
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

  if (error || !formResponse || questions.length === 0) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
              <p className="text-gray-600 mb-6">{error || 'Unable to load check-in data'}</p>
              <Link
                href="/client-portal"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <AuthenticatedOnly>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Edit Check-in Response</h1>
                <p className="text-gray-600 mt-2">Update your answers for {formResponse.formTitle}</p>
              </div>
              <Link
                href={`/client-portal/check-in/${assignmentId}/success`}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Results
              </Link>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500">
              Question {currentQuestion + 1} of {questions.length}
            </p>
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            {currentQ && (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {currentQ.text}
                  </h2>
                  {currentQ.category && (
                    <p className="text-sm text-gray-500">Category: {currentQ.category}</p>
                  )}
                </div>

                <div className="mb-8">
                  {renderQuestion(currentQ)}
                </div>

                {/* Comment/Notes Section - Only for boolean and multiple_choice questions */}
                {(currentQ.type === 'boolean' || currentQ.type === 'multiple_choice') && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      value={comments[currentQ.id] || ''}
                      onChange={(e) => handleCommentChange(currentQ.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      rows={3}
                      placeholder="Add any additional notes or context about your answer..."
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Use this space to provide more context or details about your response
                    </p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between">
                  <button
                    onClick={handlePrevious}
                    disabled={currentQuestion === 0}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  {currentQuestion < questions.length - 1 ? (
                    <button
                      onClick={handleNext}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Question Navigation */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Question Navigation</h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((question, index) => (
                <button
                  key={question.id}
                  onClick={() => setCurrentQuestion(index)}
                  className={`p-3 rounded-md text-sm font-medium transition-colors ${
                    index === currentQuestion
                      ? 'bg-blue-600 text-white'
                      : responses[question.id]
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-600 rounded mr-2"></div>
                Current
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-100 rounded mr-2"></div>
                Answered
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-100 rounded mr-2"></div>
                Unanswered
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedOnly>
  );
} 