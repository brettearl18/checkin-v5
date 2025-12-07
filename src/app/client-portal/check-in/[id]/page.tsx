'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedOnly } from '@/components/ProtectedRoute';
import { doc, getDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';
import { isWithinCheckInWindow, getCheckInWindowDescription, DEFAULT_CHECK_IN_WINDOW, CheckInWindow } from '@/lib/checkin-window-utils';

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
  checkInWindow?: CheckInWindow;
}

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
  questionId: string;
  question: string;
  answer: string | number | boolean;
  type: string;
  comment?: string; // Optional comment/notes for the answer
}

export default function CheckInCompletionPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [assignment, setAssignment] = useState<CheckInAssignment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [error, setError] = useState('');
  const [windowStatus, setWindowStatus] = useState<{ isOpen: boolean; message: string; nextOpenTime?: Date } | null>(null);

  const assignmentId = params.id as string;

  useEffect(() => {
    fetchAssignmentData();
  }, [assignmentId]);

  const fetchAssignmentData = async () => {
    try {
      // Fetch assignment
      const assignmentDoc = await getDoc(doc(db, 'check_in_assignments', assignmentId));
      if (!assignmentDoc.exists()) {
        setError('Check-in assignment not found');
        setLoading(false);
        return;
      }

      const assignmentData = assignmentDoc.data() as CheckInAssignment;
      
      // Fetch form questions and get form title if missing
      const formDoc = await getDoc(doc(db, 'forms', assignmentData.formId));
      if (!formDoc.exists()) {
        setError('Form not found');
        setLoading(false);
        return;
      }

      const formData = formDoc.data();
      
      // Ensure formTitle is set (fetch from form if missing in assignment)
      if (!assignmentData.formTitle && formData.title) {
        assignmentData.formTitle = formData.title;
      }
      
      // If still no title, use a default
      if (!assignmentData.formTitle) {
        assignmentData.formTitle = 'Check-in Form';
      }
      
      setAssignment(assignmentData);

      // Check check-in window status
      const checkInWindow = assignmentData.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
      const status = isWithinCheckInWindow(checkInWindow);
      setWindowStatus(status);

      const questionIds = formData.questions || [];

      // Fetch individual questions
      const questionsData: Question[] = [];
      for (const questionId of questionIds) {
        const questionDoc = await getDoc(doc(db, 'questions', questionId));
        if (questionDoc.exists()) {
          questionsData.push({ id: questionDoc.id, ...questionDoc.data() } as Question);
        }
      }

      setQuestions(questionsData);

      // Initialize responses array
      const initialResponses: FormResponse[] = questionsData.map(q => ({
        questionId: q.id,
        question: q.text,
        answer: '',
        type: q.type,
        comment: '' // Initialize comment field
      }));
      setResponses(initialResponses);

    } catch (error) {
      console.error('Error fetching assignment data:', error);
      setError('Failed to load check-in data');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionIndex: number, answer: string | number | boolean) => {
    const updatedResponses = [...responses];
    if (updatedResponses[questionIndex]) {
      updatedResponses[questionIndex].answer = answer;
    } else {
      // If response doesn't exist, create it
      const question = questions[questionIndex];
      if (question) {
        updatedResponses[questionIndex] = {
          questionId: question.id,
          question: question.text,
          answer: answer,
          type: question.type,
          comment: ''
        };
      }
    }
    setResponses(updatedResponses);
  };

  const handleCommentChange = (questionIndex: number, comment: string) => {
    const updatedResponses = [...responses];
    if (updatedResponses[questionIndex]) {
      updatedResponses[questionIndex].comment = comment;
    } else {
      // If response doesn't exist, create it
      const question = questions[questionIndex];
      if (question) {
        updatedResponses[questionIndex] = {
          questionId: question.id,
          question: question.text,
          answer: '',
          type: question.type,
          comment: comment
        };
      }
    }
    setResponses(updatedResponses);
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

  const handleSubmit = async () => {
    if (!assignment || !userProfile) return;

    // Check if check-in window is open
    const checkInWindow = assignment.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
    const status = isWithinCheckInWindow(checkInWindow);
    
    if (!status.isOpen) {
      setError(`Check-in window is currently closed. ${status.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    try {
      // Validate that all questions are answered
      const unansweredQuestions = questions.filter((_, index) => {
        const response = responses[index];
        return !response || !response.answer || response.answer === '';
      });

      if (unansweredQuestions.length > 0) {
        setError(`Please answer all questions before submitting.`);
        setSubmitting(false);
        return;
      }

      // Calculate score based on answer quality with question weights
      let totalWeightedScore = 0;
      let totalWeight = 0;
      let answeredCount = 0;
      
      responses.forEach((response, index) => {
        const question = questions[index];
        if (!question || !response || response.answer === '' || response.answer === null || response.answer === undefined) {
          return; // Skip unanswered questions
        }
        
        // Get question weight (default to 5 if not set)
        const questionWeight = question.questionWeight || question.weight || 5;
        
        let questionScore = 0; // Score out of 10
        
        switch (question.type) {
          case 'scale':
          case 'rating':
            // For scale/rating (1-10), use the value directly
            const scaleValue = Number(response.answer);
            if (!isNaN(scaleValue) && scaleValue >= 1 && scaleValue <= 10) {
              questionScore = scaleValue; // 1-10 scale
            }
            break;
            
          case 'number':
            // For number questions, normalize to 1-10 scale
            const numValue = Number(response.answer);
            if (!isNaN(numValue)) {
              // Normalize: if it's a percentage (0-100), convert to 1-10
              if (numValue >= 0 && numValue <= 100) {
                questionScore = 1 + (numValue / 100) * 9; // Map 0-100 to 1-10
              } else {
                // For other numbers, clamp to 1-10 range
                questionScore = Math.min(10, Math.max(1, numValue / 10));
              }
            }
            break;
            
          case 'multiple_choice':
          case 'select':
            // For multiple choice, check if options have weights
            if (question.options && Array.isArray(question.options)) {
              // Check if options have weight property
              const optionWithWeight = question.options.find((opt: any) => 
                (typeof opt === 'object' && opt.text === String(response.answer)) ||
                (typeof opt === 'string' && opt === String(response.answer))
              );
              
              if (optionWithWeight && typeof optionWithWeight === 'object' && optionWithWeight.weight) {
                // Use the weight from the option (1-10)
                questionScore = optionWithWeight.weight;
              } else {
                // Fallback: score based on option position
                const selectedIndex = question.options.findIndex((opt: any) => 
                  (typeof opt === 'object' ? opt.text : opt) === String(response.answer)
                );
                if (selectedIndex >= 0) {
                  const numOptions = question.options.length;
                  if (numOptions === 1) {
                    questionScore = 5;
                  } else {
                    questionScore = 1 + (selectedIndex / (numOptions - 1)) * 9;
                  }
                }
              }
            }
            break;
            
          case 'boolean':
            // Use yesIsPositive field to determine scoring
            const yesIsPositive = question.yesIsPositive !== undefined ? question.yesIsPositive : true;
            const isYes = response.answer === true || response.answer === 'yes' || response.answer === 'Yes';
            
            if (yesIsPositive) {
              // YES is positive (e.g., "Do you feel happy?")
              questionScore = isYes ? 8 : 3;
            } else {
              // YES is negative (e.g., "Do you feel anxious?")
              questionScore = isYes ? 3 : 8;
            }
            break;
            
          case 'text':
          case 'textarea':
            // For text questions, give a neutral score
            const textValue = String(response.answer).trim();
            if (textValue.length > 0) {
              questionScore = 5; // Neutral score for text answers
            }
            break;
            
          default:
            // Default: give partial credit for answering
            questionScore = 5;
            break;
        }
        
        // Add weighted score (questionScore * questionWeight)
        totalWeightedScore += questionScore * questionWeight;
        totalWeight += questionWeight;
        answeredCount++;
      });
      
      // Calculate final score as percentage (0-100)
      // Normalize by total possible weighted score (10 * totalWeight)
      const score = totalWeight > 0 
        ? Math.round((totalWeightedScore / (totalWeight * 10)) * 100)
        : 0;

      // Ensure formTitle is set (should already be set from fetch, but double-check)
      let formTitle = assignment.formTitle;
      if (!formTitle) {
        // Fallback: fetch from form if still missing
        try {
          const formDoc = await getDoc(doc(db, 'forms', assignment.formId));
          if (formDoc.exists()) {
            formTitle = formDoc.data().title || 'Check-in Form';
          } else {
            formTitle = 'Check-in Form';
          }
        } catch (error) {
          console.error('Error fetching form title:', error);
          formTitle = 'Check-in Form';
        }
      }

      // Create response document
      const responseData = {
        formId: assignment.formId,
        formTitle: formTitle, // Use the ensured formTitle
        assignmentId: assignmentId, // Add assignment ID for linking
        clientId: userProfile.uid,
        coachId: assignment.coachId, // CRITICAL: Include coachId for coach to find responses
        clientName: userProfile.displayName || userProfile.firstName || 'Client',
        clientEmail: userProfile.email || '',
        submittedAt: new Date(),
        completedAt: new Date(),
        score: score,
        totalQuestions: questions.length,
        answeredQuestions: answeredCount,
        responses: responses.filter(r => r && r.answer !== undefined && r.answer !== null),
        status: 'completed'
      };

      console.log('Submitting response data:', JSON.stringify(responseData, null, 2));

      const responseRef = await addDoc(collection(db, 'formResponses'), responseData);

      // Update assignment status with score and response details
      await updateDoc(doc(db, 'check_in_assignments', assignmentId), {
        status: 'completed',
        completedAt: new Date(),
        responseId: responseRef.id,
        score: score, // Save the score to the assignment
        totalQuestions: questions.length, // Save total questions
        answeredQuestions: answeredCount // Save answered questions count
      });

      // Create notification for coach
      try {
        const notificationResponse = await fetch('/api/check-in-completed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: userProfile.uid,
            formId: assignment.formId,
            responseId: responseRef.id,
            score: score,
            formTitle: formTitle,
            clientName: userProfile.displayName || userProfile.firstName || 'Client'
          })
        });
        
        if (!notificationResponse.ok) {
          console.error('Failed to create notification');
        }
      } catch (error) {
        console.error('Error creating notification:', error);
        // Don't fail the check-in if notification fails
      }

      // Redirect to success page
      router.push(`/client-portal/check-in/${assignmentId}/success?score=${score}`);

    } catch (error) {
      console.error('Error submitting check-in:', error);
      setError('Failed to submit check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: Question, index: number) => {
    const response = responses.find(r => r.questionId === question.id);
    const answer = response?.answer || '';

    switch (question.type) {
      case 'text':
        return (
          <textarea
            value={answer as string}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            rows={4}
            placeholder="Enter your answer..."
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={answer as string}
            onChange={(e) => handleAnswerChange(index, Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            placeholder="Enter a number..."
          />
        );

      case 'rating':
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>1 (Poor)</span>
              <span>10 (Excellent)</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={answer as string}
              onChange={(e) => handleAnswerChange(index, Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center text-lg font-semibold text-blue-600">
              {answer || '5'}
            </div>
          </div>
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
              onChange={(e) => handleAnswerChange(index, Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center text-lg font-semibold text-blue-600">
              {answer || '5'}
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div className="space-y-2">
            <label className="flex items-center text-gray-900">
              <input
                type="radio"
                name={`question-${question.id}`}
                value="yes"
                checked={answer === true || answer === 'yes'}
                onChange={() => handleAnswerChange(index, true)}
                className="mr-2"
              />
              Yes
            </label>
            <label className="flex items-center text-gray-900">
              <input
                type="radio"
                name={`question-${question.id}`}
                value="no"
                checked={answer === false || answer === 'no'}
                onChange={() => handleAnswerChange(index, false)}
                className="mr-2"
              />
              No
            </label>
          </div>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {question.options?.map((option, optionIndex) => (
              <label key={optionIndex} className="flex items-center text-gray-900">
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option}
                  checked={answer === option}
                  onChange={() => handleAnswerChange(index, option)}
                  className="mr-2"
                />
                {option}
              </label>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={answer as string}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
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

  if (error || !assignment) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
              <p className="text-gray-600 mb-6">{error || 'Check-in not found'}</p>
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
                <h1 className="text-3xl font-bold text-gray-900">{assignment.formTitle}</h1>
                <p className="text-gray-600 mt-2">Complete your assigned check-in</p>
              </div>
              <Link
                href="/client-portal"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Dashboard
              </Link>
            </div>

            {/* Check-in Window Status */}
            {windowStatus && (
              <div className={`mb-4 p-4 rounded-lg border ${
                windowStatus.isOpen 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium ${
                      windowStatus.isOpen ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {windowStatus.isOpen ? '✅ Check-in window is open' : '⏰ Check-in window is closed'}
                    </p>
                    <p className={`text-sm mt-1 ${
                      windowStatus.isOpen ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {windowStatus.message}
                    </p>
                    {windowStatus.nextOpenTime && (
                      <p className="text-sm mt-1 text-yellow-700">
                        Next available: {windowStatus.nextOpenTime.toLocaleString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    Window: {getCheckInWindowDescription(assignment.checkInWindow || DEFAULT_CHECK_IN_WINDOW)}
                  </div>
                </div>
              </div>
            )}

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
                    <p className="text-gray-600">Category: {currentQ.category}</p>
                  )}
                </div>

                <div className="mb-8">
                  {renderQuestion(currentQ, currentQuestion)}
                </div>

                {/* Comment/Notes Section */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={responses[currentQuestion]?.comment || ''}
                    onChange={(e) => handleCommentChange(currentQuestion, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    rows={3}
                    placeholder="Add any additional notes or context about your answer..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Use this space to provide more context or details about your response
                  </p>
                </div>

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
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {submitting ? 'Submitting...' : 'Submit Check-in'}
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
                      : responses[index]?.answer
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