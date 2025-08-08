'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedOnly } from '@/components/ProtectedRoute';
import { doc, getDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
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

interface Question {
  id: string;
  title: string;
  description?: string;
  questionType: 'text' | 'number' | 'rating' | 'scale' | 'boolean' | 'multiple_choice';
  options?: string[];
  isRequired: boolean;
  order: number;
  questionWeight: number;
  category: string;
}

interface FormResponse {
  questionId: string;
  question: string;
  answer: string | number | boolean;
  type: string;
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
      setAssignment(assignmentData);

      // Fetch form questions
      const formDoc = await getDoc(doc(db, 'forms', assignmentData.formId));
      if (!formDoc.exists()) {
        setError('Form not found');
        setLoading(false);
        return;
      }

      const formData = formDoc.data();
      const questionIds = formData.questions || [];

      // Fetch individual questions
      const questionsData: Question[] = [];
      for (const questionId of questionIds) {
        const questionDoc = await getDoc(doc(db, 'questions', questionId));
        if (questionDoc.exists()) {
          questionsData.push({ id: questionDoc.id, ...questionDoc.data() } as Question);
        }
      }

      // Sort questions by order
      questionsData.sort((a, b) => a.order - b.order);
      setQuestions(questionsData);

      // Initialize responses array
      const initialResponses: FormResponse[] = questionsData.map(q => ({
        questionId: q.id,
        question: q.title,
        answer: '',
        type: q.questionType
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
    updatedResponses[questionIndex].answer = answer;
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

    setSubmitting(true);
    try {
      // Validate required questions
      const requiredQuestions = questions.filter(q => q.isRequired);
      const missingRequired = requiredQuestions.filter((_, index) => {
        const response = responses[questions.findIndex(q => q.id === requiredQuestions[index].id)];
        return !response.answer || response.answer === '';
      });

      if (missingRequired.length > 0) {
        setError(`Please answer all required questions: ${missingRequired.map(q => q.title).join(', ')}`);
        setSubmitting(false);
        return;
      }

      // Calculate score
      const totalWeight = questions.reduce((sum, q) => sum + q.questionWeight, 0);
      let earnedWeight = 0;

      responses.forEach((response, index) => {
        const question = questions[index];
        if (response.answer !== '' && response.answer !== null) {
          // Simple scoring logic - can be enhanced
          if (question.questionType === 'rating' || question.questionType === 'scale') {
            const numAnswer = Number(response.answer);
            if (numAnswer >= 7) earnedWeight += question.questionWeight;
            else if (numAnswer >= 5) earnedWeight += question.questionWeight * 0.7;
            else if (numAnswer >= 3) earnedWeight += question.questionWeight * 0.4;
            else earnedWeight += question.questionWeight * 0.1;
          } else if (question.questionType === 'boolean') {
            if (response.answer === true || response.answer === 'yes') {
              earnedWeight += question.questionWeight;
            }
          } else {
            // For other types, give partial credit for answering
            earnedWeight += question.questionWeight * 0.8;
          }
        }
      });

      const score = Math.round((earnedWeight / totalWeight) * 100);

      // Create response document
      const responseData = {
        formId: assignment.formId,
        formTitle: assignment.formTitle,
        clientId: userProfile.uid,
        clientName: userProfile.displayName || 'Client',
        clientEmail: userProfile.email,
        submittedAt: new Date(),
        completedAt: new Date(),
        score: score,
        totalQuestions: questions.length,
        answeredQuestions: responses.filter(r => r.answer !== '' && r.answer !== null).length,
        responses: responses,
        status: 'completed'
      };

      const responseRef = await addDoc(collection(db, 'formResponses'), responseData);

      // Update assignment status
      await updateDoc(doc(db, 'check_in_assignments', assignmentId), {
        status: 'completed',
        completedAt: new Date(),
        responseId: responseRef.id
      });

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

    switch (question.questionType) {
      case 'text':
        return (
          <textarea
            value={answer as string}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="flex items-center">
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
            <label className="flex items-center">
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
              <label key={optionIndex} className="flex items-center">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    {currentQ.title}
                    {currentQ.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </h2>
                  {currentQ.description && (
                    <p className="text-gray-600">{currentQ.description}</p>
                  )}
                </div>

                <div className="mb-8">
                  {renderQuestion(currentQ, currentQuestion)}
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