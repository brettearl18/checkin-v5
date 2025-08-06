'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface Question {
  id: string;
  title: string;
  description: string;
  questionType: string;
  category: string;
  options: string[];
  weights: number[];
  yesNoWeight?: number;
  questionWeight: number;
  isRequired: boolean;
}

export default function CreateFormPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    isActive: true,
    estimatedTime: 5
  });

  const categories = [
    { value: 'general', label: 'General Check-in' },
    { value: 'mental_health', label: 'Mental Health Assessment' },
    { value: 'physical_health', label: 'Physical Health Check' },
    { value: 'relationships', label: 'Relationship Assessment' },
    { value: 'work', label: 'Work/Career Check-in' },
    { value: 'lifestyle', label: 'Lifestyle Assessment' },
    { value: 'goals', label: 'Goals & Progress Review' }
  ];

  // Fetch questions from Firebase
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const q = query(
          collection(db, 'questions'),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const questionsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Question[];
        setQuestions(questionsData);
      } catch (error) {
        console.error('Error fetching questions:', error);
      }
    };

    fetchQuestions();
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestions(prev => 
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate form data
      if (!formData.title.trim()) {
        alert('Please enter a form title');
        return;
      }

      if (selectedQuestions.length === 0) {
        alert('Please select at least one question');
        return;
      }

      // Prepare data for Firebase
      const formDataToSave = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        questionIds: selectedQuestions,
        totalQuestions: selectedQuestions.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add to Firebase
      const docRef = await addDoc(collection(db, 'forms'), formDataToSave);
      
      console.log('Form created with ID:', docRef.id);
      router.push('/forms');
    } catch (error) {
      console.error('Error creating form:', error);
      alert('Error creating form. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'multiple_choice': 'Multiple Choice',
      'scale': 'Scale (1-10)',
      'text': 'Text Input',
      'boolean': 'Yes/No',
      'rating': 'Rating (1-5)'
    };
    return typeMap[type] || type;
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'general': 'General',
      'mental_health': 'Mental Health',
      'physical_health': 'Physical Health',
      'relationships': 'Relationships',
      'work': 'Work/Career',
      'lifestyle': 'Lifestyle',
      'goals': 'Goals & Progress'
    };
    return categoryMap[category] || category;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Form</h1>
          <p className="mt-2 text-gray-600">Build forms by selecting questions from your question library</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Form Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Form Details</h2>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Form Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter form title..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the purpose of this form..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Time (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.estimatedTime}
                    onChange={(e) => handleInputChange('estimatedTime', parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="60"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Form is active and ready to use
                </label>
              </div>
            </div>
          </div>

          {/* Question Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900">Select Questions</h2>
              <div className="text-sm text-gray-500">
                {selectedQuestions.length} of {questions.length} questions selected
              </div>
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No questions available</h3>
                <p className="mt-1 text-sm text-gray-500">Create some questions first to build your form.</p>
                <div className="mt-6">
                  <a
                    href="/questions/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Create Question
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedQuestions.includes(question.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleQuestionSelection(question.id)}
                  >
                    <div className="flex items-start space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(question.id)}
                        onChange={() => toggleQuestionSelection(question.id)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-900">{question.title}</h3>
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {getQuestionTypeLabel(question.questionType)}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {getCategoryLabel(question.category)}
                            </span>
                          </div>
                        </div>
                        {question.description && (
                          <p className="mt-1 text-sm text-gray-500">{question.description}</p>
                        )}
                                                 {question.questionType === 'multiple_choice' && question.options.length > 0 && (
                           <div className="mt-2">
                             <p className="text-xs text-gray-500">Options:</p>
                             <div className="flex flex-wrap gap-1 mt-1">
                               {question.options.map((option, index) => (
                                 <span
                                   key={index}
                                   className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700"
                                 >
                                   {option} (w: {question.weights[index] || 1})
                                 </span>
                               ))}
                             </div>
                           </div>
                         )}
                         {question.questionType === 'boolean' && question.yesNoWeight && (
                           <div className="mt-2">
                             <p className="text-xs text-gray-500">Weight Configuration:</p>
                             <div className="flex flex-wrap gap-1 mt-1">
                               <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                                 Weight: {question.yesNoWeight}/10
                                 {question.yesNoWeight < 5 ? ' (Favors "No")' : 
                                  question.yesNoWeight > 5 ? ' (Favors "Yes")' : ' (Neutral)'}
                               </span>
                             </div>
                           </div>
                         )}
                         <div className="mt-2">
                           <p className="text-xs text-gray-500">Question Importance:</p>
                           <div className="flex flex-wrap gap-1 mt-1">
                             <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                               question.questionWeight <= 3 ? 'bg-red-100 text-red-700' :
                               question.questionWeight <= 6 ? 'bg-yellow-100 text-yellow-700' :
                               'bg-green-100 text-green-700'
                             }`}>
                               Importance: {question.questionWeight}/10
                               {question.questionWeight <= 3 ? ' (Low)' :
                                question.questionWeight <= 6 ? ' (Medium)' : ' (High)'}
                             </span>
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
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
              disabled={isLoading || selectedQuestions.length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 