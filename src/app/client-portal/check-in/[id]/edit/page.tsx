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
  options?: string[];
  category: string;
  coachId: string;
  createdAt: string;
  updatedAt: string;
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

export default function EditCheckInPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [formResponse, setFormResponse] = useState<FormResponse | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<{ [key: string]: any }>({});
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
      setFormResponse(responseData);

      // Fetch questions
      const questionsData: Question[] = [];
      for (const response of responseData.responses) {
        const questionDoc = await getDoc(doc(db, 'questions', response.questionId));
        if (questionDoc.exists()) {
          questionsData.push({ id: questionDoc.id, ...questionDoc.data() } as Question);
        }
      }
      setQuestions(questionsData);

      // Initialize responses with existing answers
      const initialResponses: { [key: string]: any } = {};
      responseData.responses.forEach(response => {
        initialResponses[response.questionId] = response.answer;
      });
      setResponses(initialResponses);

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
    if (!formResponse) return;

    setSaving(true);
    try {
      // Update the responses array
      const updatedResponses = formResponse.responses.map(response => ({
        ...response,
        answer: responses[response.questionId] !== undefined ? responses[response.questionId] : response.answer
      }));

      // Calculate new score - handle different answer types safely
      const answeredCount = updatedResponses.filter(r => {
        if (r.answer === undefined || r.answer === null) return false;
        if (typeof r.answer === 'string') return r.answer.trim() !== '';
        if (typeof r.answer === 'number') return !isNaN(r.answer);
        if (typeof r.answer === 'boolean') return true;
        return false;
      }).length;
      
      const newScore = Math.round((answeredCount / questions.length) * 100);

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