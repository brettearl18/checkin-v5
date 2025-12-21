'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import CoachNavigation from '@/components/CoachNavigation';

interface Question {
  id: string;
  title: string;
  description?: string;
  questionType: string;
  category: string;
  options?: string[];
  weights?: number[];
  yesNoWeight?: number;
  questionWeight: number;
  isRequired: boolean;
  isActive: boolean;
  usageCount?: number;
  lastUsedAt?: any;
  createdAt: any;
  updatedAt?: any;
  createdBy?: string;
  coachId?: string;
}

export default function QuestionLibraryPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const { userProfile } = useAuth();

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const coachId = userProfile?.uid;
        console.log('Fetching questions for coachId:', coachId);
        const response = await fetch(`/api/questions${coachId ? `?coachId=${coachId}` : ''}`);
        const data = await response.json();
        
        console.log('Questions API response:', data);
        
        if (data.success) {
          setQuestions(data.questions);
        } else {
          console.error('Error fetching questions:', data.message);
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (userProfile?.uid) {
      fetchQuestions();
    }
  }, [userProfile?.uid]);

  const handleDeleteQuestion = async (questionId: string) => {
    if (window.confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/questions/${questionId}`, {
          method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
          setQuestions(questions.filter(q => q.id !== questionId));
        } else {
          console.error('Error deleting question:', data.message);
        }
      } catch (error) {
        console.error('Error deleting question:', error);
      }
    }
  };

  const handleToggleActive = async (questionId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isActive: !currentStatus
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setQuestions(questions.map(q => 
          q.id === questionId ? { ...q, isActive: !currentStatus } : q
        ));
      } else {
        console.error('Error updating question status:', data.message);
      }
    } catch (error) {
      console.error('Error updating question status:', error);
    }
  };

  const handleCreateFemaleLibrary = async () => {
    if (!userProfile?.uid) {
      alert('Please log in to create the question library');
      return;
    }

    if (!window.confirm('This will create 80+ pre-weighted female-focused questions. Continue?')) {
      return;
    }

    try {
      const response = await fetch('/api/create-female-question-library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coachId: userProfile.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully created ${data.count} female-focused questions!\n\nCategories: ${data.categories.join(', ')}`);
        // Refresh the questions list
        window.location.reload();
      } else {
        alert('Error creating question library: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating female question library:', error);
      alert('Error creating question library. Please try again.');
    }
  };

  const handleCreateVanaCheckInQuestions = async () => {
    if (!userProfile?.uid) {
      alert('Please log in to create the question library');
      return;
    }

    if (!window.confirm('This will create 27 Vana Check In questions. Continue?')) {
      return;
    }

    try {
      const response = await fetch('/api/create-vana-checkin-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coachId: userProfile.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`Successfully created ${data.count} Vana Check In questions!\n\nCategories: ${data.categories.join(', ')}`);
        // Refresh the questions list
        window.location.reload();
      } else {
        alert('Error creating question library: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating Vana Check In questions:', error);
      alert('Error creating question library. Please try again.');
    }
  };

  const handleResetAndReload = async () => {
    if (!userProfile?.uid) {
      alert('Please log in to reset and reload questions');
      return;
    }

    if (!window.confirm('⚠️ WARNING: This will DELETE ALL your existing questions and replace them with the updated female-focused question library (with "past week" language and comment support).\n\nThis action cannot be undone. Continue?')) {
      return;
    }

    try {
      const response = await fetch('/api/questions/reset-and-reload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          coachId: userProfile.uid
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Reset Complete!\n\nDeleted: ${data.deletedCount} questions\nCreated: ${data.createdCount} new questions\n\nCategories: ${data.categories.join(', ')}${data.errors ? `\n\nErrors: ${data.errors.length}` : ''}`);
        // Refresh the questions list
        window.location.reload();
      } else {
        alert('Error resetting and reloading questions: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error resetting and reloading questions:', error);
      alert('Error resetting and reloading questions. Please try again.');
    }
  };

  const filteredQuestions = questions.filter(question => {
    // Handle both old and new field names
    const questionTitle = question.title || question.text || '';
    const questionType = question.questionType || question.type || '';
    const questionCategory = question.category || '';
    
    const matchesSearch = questionTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || questionCategory === selectedCategory;
    const matchesType = selectedType === 'all' || questionType === selectedType;
    const matchesStatus = showInactive ? true : question.isActive;
    
    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  const categories = ['all', ...Array.from(new Set(questions.map(q => q.category || '')))];
  const types = ['all', 'text', 'number', 'select', 'multiselect', 'scale', 'boolean', 'date', 'time', 'textarea'];

  const stats = {
    total: questions.length,
    active: questions.filter(q => q.isActive).length,
    categories: new Set(questions.map(q => q.category || '')).size,
    mostUsed: questions.reduce((max, q) => (q.usageCount || 0) > (max.usageCount || 0) ? q : max, questions[0])
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      text: '📝',
      number: '🔢',
      select: '📋',
      multiselect: '☑️',
      scale: '📊',
      boolean: '✅',
      date: '📅',
      time: '⏰',
      textarea: '📄'
    };
    return icons[type as keyof typeof icons] || '❓';
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      text: 'Short Text',
      number: 'Number',
      select: 'Single Choice',
      multiselect: 'Multiple Choice',
      scale: 'Scale/Rating',
      boolean: 'Yes/No',
      date: 'Date',
      time: 'Time',
      textarea: 'Long Text'
    };
    return labels[type as keyof typeof labels] || type;
  };

  // Helper function to safely format dates
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'Unknown date';
    
    try {
      // If it's a Firebase Timestamp
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate().toLocaleDateString();
      }
      
      // If it's already a Date object
      if (dateValue instanceof Date) {
        return dateValue.toLocaleDateString();
      }
      
      // If it's a string or number, try to create a Date
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
      
      return 'Invalid date';
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
              <div className="lg:col-span-3">
                <div className="h-96 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex">
      <CoachNavigation />
      
      {/* Main Content */}
      <div className="flex-1 ml-8 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Question Library
                </h1>
                <p className="text-gray-600 mt-2 text-lg">Manage and reuse questions across your forms</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleResetAndReload}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  title="Clear all questions and reload with updated library (past week language + comments)"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset & Reload Questions
                </button>
                <button
                  onClick={handleCreateFemaleLibrary}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  title="Create 80+ pre-weighted female-focused questions"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Female Question Library
                </button>
                <Link
                  href="/questions/create"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  + Create Question
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Questions</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-gradient-to-r from-green-500 to-green-600 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Questions</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Categories</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.categories}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Most Used</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.mostUsed?.usageCount || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Questions</label>
                  <input
                    type="text"
                    placeholder="Search question text..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="all">All Categories</option>
                    {categories.filter(cat => cat !== 'all').map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="all">All Types</option>
                    {types.filter(type => type !== 'all').map(type => (
                      <option key={type} value={type}>{getTypeLabel(type)}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-end">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={showInactive}
                      onChange={(e) => setShowInactive(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200"
                    />
                    <span className="ml-2 text-sm text-gray-700">Show inactive questions</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Questions List */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">All Questions ({filteredQuestions.length})</h2>
            </div>
            
            <div className="p-6">
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No questions found</h3>
                  <p className="text-gray-500 mb-6">Get started by creating questions or loading our pre-built female-focused question library.</p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        onClick={handleResetAndReload}
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reset & Reload Questions
                      </button>
                      <button
                        onClick={handleCreateFemaleLibrary}
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Create Female Question Library (80+ Questions)
                      </button>
                      <button
                        onClick={handleCreateVanaCheckInQuestions}
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Create Vana Check In Questions (27 Questions)
                      </button>
                    </div>
                    <Link
                      href="/questions/create"
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      Create Custom Question
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredQuestions.map((question) => {
                    const questionType = question.questionType || question.type || 'text';
                    const questionTitle = question.title || question.text || 'Untitled Question';
                    const hasWeighting = question.questionWeight !== 1 && question.questionWeight !== undefined;
                    
                    return (
                      <div
                        key={question.id}
                        className="group bg-white border-2 border-gray-100 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-xl transition-all duration-300 flex flex-col"
                      >
                        {/* Header with gradient background */}
                        <div className={`bg-gradient-to-r ${
                          questionType === 'scale' ? 'from-purple-500 to-pink-500' :
                          questionType === 'boolean' ? 'from-green-500 to-emerald-500' :
                          questionType === 'select' || questionType === 'multiselect' ? 'from-blue-500 to-indigo-500' :
                          questionType === 'number' ? 'from-orange-500 to-red-500' :
                          'from-gray-500 to-gray-600'
                        } px-6 py-4`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                <span className="text-2xl">{getTypeIcon(questionType)}</span>
                              </div>
                              <div>
                                <div className="text-white font-semibold text-sm">
                                  {getTypeLabel(questionType)}
                                </div>
                                {question.category && (
                                  <div className="text-white text-xs opacity-90 mt-0.5">
                                    {question.category}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {question.isActive ? (
                                <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></span>
                              ) : (
                                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 flex-1 flex flex-col">
                          {/* Question Text */}
                          <h3 className="text-lg font-semibold text-gray-900 mb-4 line-clamp-2 leading-snug">
                            {questionTitle}
                          </h3>

                          {/* Badges */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            {(question.isRequired || question.required) && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                Required
                              </span>
                            )}
                            {hasWeighting && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                Weight: {question.questionWeight}
                              </span>
                            )}
                            {!question.isActive && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                Inactive
                              </span>
                            )}
                          </div>

                          {/* Options Preview */}
                          {question.options && question.options.length > 0 && (
                            <div className="mb-4">
                              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                                Options {hasWeighting && <span className="text-green-600">(Weighted)</span>}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {question.options.slice(0, 6).map((option, index) => {
                                  const optionText = typeof option === 'string' ? option : option.text || option;
                                  const optionWeight = typeof option === 'object' ? option.weight : question.weights?.[index];
                                  return (
                                    <span 
                                      key={index} 
                                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
                                    >
                                      {optionText}
                                      {hasWeighting && optionWeight && (
                                        <span className="ml-1.5 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">
                                          {optionWeight}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                                {question.options.length > 6 && (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                                    +{question.options.length - 6} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          <div className="mt-auto pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <div className="flex items-center gap-4">
                                {question.usageCount !== undefined && question.usageCount > 0 && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    {question.usageCount}x
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {formatDate(question.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                          <button
                            onClick={() => handleToggleActive(question.id, question.isActive)}
                            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                              question.isActive
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {question.isActive ? (
                              <>
                                <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Active
                              </>
                            ) : (
                              'Inactive'
                            )}
                          </button>
                          
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/questions/edit/${question.id}`}
                              className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-all duration-200"
                            >
                              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </Link>
                            
                            <button
                              onClick={() => handleDeleteQuestion(question.id)}
                              className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-all duration-200"
                            >
                              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 