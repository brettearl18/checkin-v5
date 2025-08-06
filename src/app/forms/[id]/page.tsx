'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface Question {
  id: string;
  title: string;
  description: string;
  questionType: string;
  options: string[];
  weights: number[];
  yesNoWeight?: number;
  questionWeight: number;
  isRequired: boolean;
}

interface Form {
  id: string;
  title: string;
  description: string;
  category: string;
  totalQuestions: number;
  estimatedTime: number;
  isActive: boolean;
  questionIds: string[];
}

export default function FormViewPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;
  
  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<{ [key: string]: any }>({});
  const [clientId, setClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch form and questions
  useEffect(() => {
    const fetchFormAndQuestions = async () => {
      try {
        // Fetch form
        const formDoc = await getDoc(doc(db, 'forms', formId));
        if (!formDoc.exists()) {
          alert('Form not found');
          router.push('/forms');
          return;
        }

        const formData = { id: formDoc.id, ...formDoc.data() } as Form;
        setForm(formData);

        if (!formData.isActive) {
          alert('This form is not active');
          router.push('/forms');
          return;
        }

        // Fetch questions
        const questionsData: Question[] = [];
        for (const questionId of formData.questionIds) {
          const questionDoc = await getDoc(doc(db, 'questions', questionId));
          if (questionDoc.exists()) {
            questionsData.push({ id: questionDoc.id, ...questionDoc.data() } as Question);
          }
        }

        setQuestions(questionsData);
      } catch (error) {
        console.error('Error fetching form:', error);
        alert('Error loading form');
      } finally {
        setIsLoading(false);
      }
    };

    if (formId) {
      fetchFormAndQuestions();
    }
  }, [formId, router]);

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const validateResponses = () => {
    for (const question of questions) {
      if (question.isRequired && !responses[question.id]) {
        alert(`Please answer the required question: ${question.title}`);
        return false;
      }
    }
    return true;
  };

  const calculateScore = () => {
    let totalScore = 0;
    let totalWeight = 0;

    for (const question of questions) {
      if (responses[question.id] !== undefined) {
        let questionScore = 0;
        let questionMaxWeight = 0;
        
        if (question.questionType === 'multiple_choice') {
          const selectedIndex = question.options.indexOf(responses[question.id]);
          if (selectedIndex >= 0) {
            questionScore = question.weights[selectedIndex] || 1;
            questionMaxWeight = Math.max(...question.weights) || 1;
          }
        } else if (question.questionType === 'scale' || question.questionType === 'rating') {
          questionScore = responses[question.id];
          questionMaxWeight = 10; // Max scale/rating
        } else if (question.questionType === 'boolean') {
          const yesNoWeight = question.yesNoWeight || 5; // Default to neutral
          if (responses[question.id]) {
            // "Yes" was selected
            questionScore = yesNoWeight >= 5 ? 10 : 1; // If weight favors Yes, give 10, else 1
          } else {
            // "No" was selected
            questionScore = yesNoWeight < 5 ? 10 : 1; // If weight favors No, give 10, else 1
          }
          questionMaxWeight = 10;
        } else if (question.questionType === 'text') {
          // For text questions, give a neutral score based on question weight
          questionScore = question.questionWeight;
          questionMaxWeight = 10;
        }
        
        // Apply question weight multiplier
        const weightMultiplier = question.questionWeight / 5; // Normalize to 1.0 (5/5 = 1.0)
        totalScore += questionScore * weightMultiplier;
        totalWeight += questionMaxWeight * weightMultiplier;
      }
    }

    return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateResponses()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const score = calculateScore();
      
      const responseData = {
        formId,
        formTitle: form?.title,
        clientId: clientId || 'anonymous',
        responses,
        score,
        totalQuestions: questions.length,
        answeredQuestions: Object.keys(responses).length,
        submittedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'form_responses'), responseData);
      
      alert(`Form submitted successfully! Your score: ${score}%`);
      router.push('/forms');
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    switch (question.questionType) {
      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <label key={index} className="flex items-center">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={responses[question.id] === option}
                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  required={question.isRequired}
                />
                <span className="ml-3 text-sm text-gray-700">
                  {option} {question.weights[index] && `(Weight: ${question.weights[index]})`}
                </span>
              </label>
            ))}
          </div>
        );

      case 'scale':
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>1 (Low)</span>
              <span>10 (High)</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={responses[question.id] || 5}
              onChange={(e) => handleResponseChange(question.id, parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              required={question.isRequired}
            />
            <div className="text-center text-sm font-medium text-gray-700">
              {responses[question.id] || 5}
            </div>
          </div>
        );

      case 'rating':
        return (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <label key={rating} className="flex items-center">
                  <input
                    type="radio"
                    name={question.id}
                    value={rating}
                    checked={responses[question.id] === rating}
                    onChange={(e) => handleResponseChange(question.id, parseInt(e.target.value))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    required={question.isRequired}
                  />
                  <span className="ml-2 text-sm text-gray-700">{rating}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name={question.id}
                value="true"
                checked={responses[question.id] === true}
                onChange={(e) => handleResponseChange(question.id, e.target.value === 'true')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                required={question.isRequired}
              />
              <span className="ml-3 text-sm text-gray-700">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name={question.id}
                value="false"
                checked={responses[question.id] === false}
                onChange={(e) => handleResponseChange(question.id, e.target.value === 'true')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                required={question.isRequired}
              />
              <span className="ml-3 text-sm text-gray-700">No</span>
            </label>
          </div>
        );

      case 'text':
        return (
          <textarea
            value={responses[question.id] || ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your answer..."
            required={question.isRequired}
          />
        );

      default:
        return <p className="text-gray-500">Unsupported question type</p>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Form not found</h2>
          <p className="mt-2 text-gray-600">The form you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{form.title}</h1>
          {form.description && (
            <p className="mt-2 text-gray-600">{form.description}</p>
          )}
          <div className="mt-4 flex items-center space-x-4 text-sm text-gray-500">
            <span>{form.totalQuestions} questions</span>
            <span>•</span>
            <span>~{form.estimatedTime} minutes</span>
            <span>•</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {form.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Client ID Input */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">Client Information</h3>
              <p className="text-gray-700 mt-1">Please enter your client ID to track your responses</p>
            </div>
            <div className="mt-4">
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter your client ID (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                This helps your coach track your progress. If you don't have a client ID, you can leave this blank.
              </p>
            </div>
          </div>

          {questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-lg shadow p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Question {index + 1}
                  {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                </h3>
                <p className="text-gray-700 mt-1">{question.title}</p>
                {question.description && (
                  <p className="text-sm text-gray-500 mt-1">{question.description}</p>
                )}
              </div>
              
              <div className="mt-4">
                {renderQuestion(question)}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 