'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
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
  createdAt: any;
}

interface Form {
  id: string;
  title: string;
  description: string;
  category: string;
  totalQuestions: number;
  isActive: boolean;
  createdAt: any;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch questions
        const questionsQuery = query(
          collection(db, 'questions'),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc')
        );
        const questionsSnapshot = await getDocs(questionsQuery);
        const questionsData = questionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Question[];

        // Fetch forms
        const formsQuery = query(
          collection(db, 'forms'),
          orderBy('createdAt', 'desc')
        );
        const formsSnapshot = await getDocs(formsQuery);
        const formsData = formsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Form[];

        setQuestions(questionsData);
        setForms(formsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

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

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-800">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Question Builder</h1>
              <p className="mt-2 text-gray-800">Create custom questions and forms with weighted scoring</p>
            </div>
            <div className="flex space-x-3">
              <Link
                href="/questions/create"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Create Question
              </Link>
              <Link
                href="/forms/create"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Create Form
              </Link>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Questions</p>
                  <p className="text-lg font-semibold text-gray-900">{questions.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Forms</p>
                  <p className="text-lg font-semibold text-gray-900">{forms.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Avg Importance</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {questions.length > 0 
                      ? Math.round(questions.reduce((sum, q) => sum + (q.questionWeight || 5), 0) / questions.length)
                      : 0
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Active Forms</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {forms.filter(f => f.isActive).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                href="/questions/create"
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <svg className="h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">Create New Question</p>
                  <p className="text-xs text-gray-500">Build custom questions with weighted scoring</p>
                </div>
              </Link>
              <Link
                href="/forms/create"
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <svg className="h-5 w-5 text-green-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">Create New Form</p>
                  <p className="text-xs text-gray-500">Build forms by selecting questions</p>
                </div>
              </Link>
              <Link
                href="/templates"
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <svg className="h-5 w-5 text-purple-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">Browse Templates</p>
                  <p className="text-xs text-gray-500">Use pre-built question templates</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Questions</h3>
            {questions.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No questions yet</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating your first question.</p>
                <div className="mt-6">
                  <Link
                    href="/questions/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Create Question
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.slice(0, 3).map((question) => (
                  <div key={question.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{question.title}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getCategoryLabel(question.category)}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {getQuestionTypeLabel(question.questionType)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {question.questionType === 'boolean' && question.yesNoWeight 
                            ? `Weight: ${question.yesNoWeight}/10${question.yesNoWeight < 5 ? ' (Favors No)' : question.yesNoWeight > 5 ? ' (Favors Yes)' : ' (Neutral)'}`
                            : question.weights && question.weights.length > 0 
                              ? `Avg Weight: ${Math.round(question.weights.reduce((sum, w) => sum + w, 0) / question.weights.length)}`
                              : 'No weights'
                          }
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                          question.questionWeight <= 3 ? 'bg-red-100 text-red-700' :
                          question.questionWeight <= 6 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {question.questionWeight}/10
                          {question.questionWeight <= 3 ? ' (Low)' :
                           question.questionWeight <= 6 ? ' (Medium)' : ' (High)'}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/questions/${question.id}/edit`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
                {questions.length > 3 && (
                  <Link
                    href="/questions"
                    className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View all {questions.length} questions
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Forms */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Forms</h3>
          </div>
          <div className="p-6">
            {forms.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No forms yet</h3>
                <p className="mt-1 text-sm text-gray-500">Create your first form to start collecting client data.</p>
                <div className="mt-6">
                  <Link
                    href="/forms/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    Create Form
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {forms.slice(0, 5).map((form) => (
                  <div key={form.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{form.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">{form.description}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className="text-xs text-gray-500">{form.totalQuestions} questions</span>
                        <span className="text-xs text-gray-500">~{form.estimatedTime || 5} min</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getCategoryLabel(form.category)}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          form.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {form.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/forms/${form.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View
                      </Link>
                      <Link
                        href={`/forms/${form.id}/edit`}
                        className="text-gray-800 hover:text-gray-800 text-sm font-medium"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
                {forms.length > 5 && (
                  <Link
                    href="/forms"
                    className="block text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View all {forms.length} forms
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 