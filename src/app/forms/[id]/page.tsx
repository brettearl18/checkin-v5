'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

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

interface Form {
  id: string;
  title: string;
  description: string;
  category: string;
  totalQuestions: number;
  estimatedTime: number;
  isActive?: boolean;
  isStandard?: boolean;
  questions: string[];
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

        // Check if form is active or is a standard form
        if (!formData.isActive && !formData.isStandard) {
          alert('This form is not active');
          router.push('/forms');
          return;
        }

        // Fetch questions
        const questionsData: Question[] = [];
        for (const questionId of formData.questions) {
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
      if (!responses[question.id]) {
        alert(`Please answer the question: ${question.text}`);
        return false;
      }
    }
    return true;
  };

  const calculateScore = () => {
    let totalScore = 0;
    let totalQuestions = 0;

    for (const question of questions) {
      if (responses[question.id] !== undefined && responses[question.id] !== '') {
        let questionScore = 0;
        
        if (question.type === 'multiple_choice') {
          // For multiple choice, give a score based on the option index
          const selectedIndex = question.options?.indexOf(responses[question.id]) || 0;
          questionScore = (selectedIndex + 1) * 2; // 2, 4, 6, 8, 10
        } else if (question.type === 'scale') {
          questionScore = responses[question.id];
        } else if (question.type === 'number') {
          // For number questions, normalize to 1-10 scale
          const value = responses[question.id];
          questionScore = Math.min(10, Math.max(1, value / 10));
        } else if (question.type === 'text') {
          // For text questions, give a neutral score
          questionScore = 5;
        }
        
        totalScore += questionScore;
        totalQuestions++;
      }
    }

    return totalQuestions > 0 ? Math.round((totalScore / (totalQuestions * 10)) * 100) : 0;
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
    switch (question.type) {
      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={responses[question.id] === option}
                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-3 text-sm text-gray-900">
                  {option}
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
            />
            <div className="text-center text-sm font-medium text-gray-900">
              {responses[question.id] || 5}
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="space-y-2">
            <input
              type="number"
              value={responses[question.id] || ''}
              onChange={(e) => handleResponseChange(question.id, parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your answer"
            />
          </div>
        );

      case 'text':
        return (
          <div className="space-y-2">
            <textarea
              value={responses[question.id] || ''}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Enter your answer"
            />
          </div>
        );

      default:
        return (
          <div className="text-sm text-gray-500">
            Question type "{question.type}" not supported
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-800">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Form not found</h2>
          <p className="mt-2 text-gray-800">The form you're looking for doesn't exist.</p>
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
            <p className="mt-2 text-gray-800">{form.description}</p>
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
              <p className="text-gray-900 mt-1">Please enter your client ID to track your responses</p>
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
                </h3>
                <p className="text-gray-900 mt-1">{question.text}</p>
                {question.category && (
                  <p className="text-sm text-gray-500 mt-1">Category: {question.category}</p>
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
              className="px-4 py-2 text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200"
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