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
  const [comments, setComments] = useState<{ [key: string]: string }>({});
  const [clientId, setClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

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

  const handleCommentChange = (questionId: string, comment: string) => {
    setComments(prev => ({
      ...prev,
      [questionId]: comment
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
        
        if (question.type === 'multiple_choice' || question.type === 'select') {
          const options = question.options || [];
          const getOptionText = (option: any) => {
            if (typeof option === 'string') return option;
            if (typeof option === 'object' && option.text) return option.text;
            return String(option);
          };
          const selectedIndex = options.findIndex((opt: any) => 
            getOptionText(opt) === responses[question.id] || 
            (typeof opt === 'object' && opt.value === responses[question.id])
          );
          if (selectedIndex >= 0) {
            const numOptions = options.length;
            questionScore = numOptions === 1 ? 5 : 1 + (selectedIndex / (numOptions - 1)) * 9;
          }
        } else if (question.type === 'scale') {
          questionScore = responses[question.id];
        } else if (question.type === 'number') {
          const value = responses[question.id];
          questionScore = Math.min(10, Math.max(1, value / 10));
        } else if (question.type === 'text') {
          questionScore = 5;
        } else if (question.type === 'textarea') {
          const textareaAnswer = String(responses[question.id]).trim().toLowerCase();
          if (textareaAnswer === 'great') {
            questionScore = 9;
          } else if (textareaAnswer === 'average') {
            questionScore = 5;
          } else if (textareaAnswer === 'poor') {
            questionScore = 2;
          } else {
            questionScore = 5;
          }
        } else if (question.type === 'boolean') {
          const isYes = responses[question.id] === true || responses[question.id] === 'yes' || responses[question.id] === 'Yes';
          questionScore = isYes ? 8 : 3;
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
      
      const responsesArray = questions.map(question => ({
        questionId: question.id,
        question: question.text,
        answer: responses[question.id] || '',
        type: question.type,
        comment: comments[question.id] || ''
      }));

      const responseData = {
        formId,
        formTitle: form?.title,
        clientId: clientId || 'anonymous',
        responses: responsesArray,
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
          <div className="space-y-3">
            {question.options?.map((option, index) => (
              <label key={index} className="flex items-center p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={responses[question.id] === option}
                  onChange={(e) => handleResponseChange(question.id, e.target.value)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-4 text-base text-gray-900 font-medium group-hover:text-blue-700">
                  {option}
                </span>
              </label>
            ))}
          </div>
        );

      case 'scale':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span className="font-medium">1 (Low)</span>
              <span className="font-medium">10 (High)</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={responses[question.id] || 5}
              onChange={(e) => handleResponseChange(question.id, parseInt(e.target.value))}
              className="w-full h-3 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold shadow-lg">
                {responses[question.id] || 5}
              </div>
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-lg transition-all"
              placeholder="Enter your answer"
            />
          </div>
        );

      case 'text':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={responses[question.id] || ''}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-lg transition-all"
              placeholder="Enter your answer"
            />
          </div>
        );

      case 'textarea':
        const textareaValue = responses[question.id] || '';
        const isGreat = textareaValue === 'Great' || textareaValue === 'great';
        const isAverage = textareaValue === 'Average' || textareaValue === 'average';
        const isPoor = textareaValue === 'Poor' || textareaValue === 'poor';
        
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleResponseChange(question.id, 'Great')}
                className={`px-6 py-4 rounded-xl font-semibold text-base transition-all transform hover:scale-105 shadow-md ${
                  isGreat
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ✨ Great
              </button>
              <button
                type="button"
                onClick={() => handleResponseChange(question.id, 'Average')}
                className={`px-6 py-4 rounded-xl font-semibold text-base transition-all transform hover:scale-105 shadow-md ${
                  isAverage
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ⚖️ Average
              </button>
              <button
                type="button"
                onClick={() => handleResponseChange(question.id, 'Poor')}
                className={`px-6 py-4 rounded-xl font-semibold text-base transition-all transform hover:scale-105 shadow-md ${
                  isPoor
                    ? 'bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ⚠️ Poor
              </button>
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div className="grid grid-cols-2 gap-4">
            <label className={`flex items-center justify-center p-6 rounded-xl border-2 transition-all cursor-pointer group ${
              responses[question.id] === true || responses[question.id] === 'yes' || responses[question.id] === 'Yes'
                ? 'border-green-500 bg-green-50 shadow-md'
                : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
            }`}>
              <input
                type="radio"
                name={question.id}
                value="yes"
                checked={responses[question.id] === true || responses[question.id] === 'yes' || responses[question.id] === 'Yes'}
                onChange={() => handleResponseChange(question.id, true)}
                className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300"
              />
              <span className={`ml-3 text-lg font-semibold ${
                responses[question.id] === true || responses[question.id] === 'yes' || responses[question.id] === 'Yes'
                  ? 'text-green-700'
                  : 'text-gray-700 group-hover:text-green-700'
              }`}>
                ✅ Yes
              </span>
            </label>
            <label className={`flex items-center justify-center p-6 rounded-xl border-2 transition-all cursor-pointer group ${
              responses[question.id] === false || responses[question.id] === 'no' || responses[question.id] === 'No'
                ? 'border-red-500 bg-red-50 shadow-md'
                : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
            }`}>
              <input
                type="radio"
                name={question.id}
                value="no"
                checked={responses[question.id] === false || responses[question.id] === 'no' || responses[question.id] === 'No'}
                onChange={() => handleResponseChange(question.id, false)}
                className="h-5 w-5 text-red-600 focus:ring-red-500 border-gray-300"
              />
              <span className={`ml-3 text-lg font-semibold ${
                responses[question.id] === false || responses[question.id] === 'no' || responses[question.id] === 'No'
                  ? 'text-red-700'
                  : 'text-gray-700 group-hover:text-red-700'
              }`}>
                ❌ No
              </span>
            </label>
          </div>
        );

      case 'select':
        const selectOptions = question.options || [];
        const getOptionText = (option: any) => {
          if (typeof option === 'string') return option;
          if (typeof option === 'object' && option.text) return option.text;
          return String(option);
        };
        
        return (
          <div className="space-y-3">
            {selectOptions.map((option, index) => {
              const optionText = getOptionText(option);
              const optionValue = typeof option === 'object' && option.value ? option.value : optionText;
              const isSelected = responses[question.id] === optionValue || responses[question.id] === optionText;
              
              return (
                <label key={index} className={`flex items-center p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                }`}>
                  <input
                    type="radio"
                    name={question.id}
                    value={optionValue}
                    checked={isSelected}
                    onChange={(e) => handleResponseChange(question.id, e.target.value)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className={`ml-4 text-base font-medium ${
                    isSelected ? 'text-blue-700' : 'text-gray-900 group-hover:text-blue-700'
                  }`}>
                    {optionText}
                  </span>
                </label>
              );
            })}
          </div>
        );

      default:
        return (
          <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
            Question type "{question.type}" not supported
          </div>
        );
    }
  };

  const answeredCount = Object.keys(responses).length;
  const progressPercentage = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-6 text-gray-700 text-lg font-medium">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Form not found</h2>
          <p className="text-gray-600">The form you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 mb-6 sm:mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">{form.title}</h1>
              {form.description && (
                <p className="text-gray-600 text-base sm:text-lg mt-2">{form.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{form.totalQuestions} questions</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">~{form.estimatedTime} min</span>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md">
              {form.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>

          {/* Progress Bar */}
          {questions.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm font-semibold text-blue-600">{answeredCount} / {questions.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Client ID Input */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Client Information</h3>
              <p className="text-gray-600 text-sm sm:text-base">Please enter your client ID to track your responses</p>
            </div>
            <div className="mt-4">
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter your client ID (optional)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-base transition-all"
              />
              <p className="text-sm text-gray-500 mt-2">
                This helps your coach track your progress. If you don't have a client ID, you can leave this blank.
              </p>
            </div>
          </div>

          {questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8 hover:shadow-xl transition-shadow">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                      {question.text}
                    </h3>
                  </div>
                </div>
                {question.category && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 mt-2">
                    {question.category}
                  </span>
                )}
              </div>
              
              <div className="mt-6">
                {renderQuestion(question)}
              </div>

              {/* Comment/Notes Section */}
              {(question.type === 'boolean' || question.type === 'multiple_choice' || question.type === 'select' || question.type === 'scale' || question.type === 'number') && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={comments[question.id] || ''}
                    onChange={(e) => handleCommentChange(question.id, e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-base transition-all resize-none"
                    rows={3}
                    placeholder="Add any additional notes or context about your answer..."
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Use this space to provide more context or details about your response
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Submit Button */}
          <div className="sticky bottom-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border-t border-gray-200 shadow-lg">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-semibold transition-all shadow-sm hover:shadow-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || answeredCount < questions.length}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  `Submit Form ${answeredCount < questions.length ? `(${questions.length - answeredCount} remaining)` : ''}`
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style jsx>{`
        input[type="range"].slider::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #4f46e5);
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        input[type="range"].slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #4f46e5);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
