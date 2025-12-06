'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navigation Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl border-r border-gray-200 z-50">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Coach Portal</h2>
            <p className="text-sm text-gray-600">Manage your coaching business</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/dashboard" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Dashboard
            </Link>
            
            <Link href="/clients" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              My Clients
            </Link>
            
            <Link href="/messages" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Messages
            </Link>
            
            <Link href="/analytics" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </Link>
            
            <Link href="/forms" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Forms & Check-ins
            </Link>
            
            <Link href="/questions/library" className="flex items-center px-4 py-3 bg-blue-50 text-blue-700 rounded-xl border-r-4 border-blue-600">
              <div className="relative">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full"></div>
              </div>
              Questions Library
            </Link>
            
            <Link href="/check-ins" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Check-ins
            </Link>
            
            <Link href="/responses" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Responses
            </Link>
            
            <Link href="/audit" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Audit
            </Link>
          </nav>

          {/* Quick Actions */}
          <div className="p-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/clients/create" className="flex items-center px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                + Add New Client
              </Link>
              <Link href="/forms/create" className="flex items-center px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create New Form
              </Link>
              <Link href="/questions/create" className="flex items-center px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ? Add New Question
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="ml-64 flex-1 p-6">
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
              <Link
                href="/questions/create"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                + Create Question
              </Link>
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
                  <p className="text-gray-500 mb-6">Try adjusting your search criteria or create a new question.</p>
                  <Link
                    href="/questions/create"
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Create Question
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="bg-white border-2 border-gray-100 rounded-xl p-6 hover:border-blue-200 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{getTypeIcon(question.questionType || question.type)}</span>
                              <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                                {getTypeLabel(question.questionType || question.type)}
                              </span>
                              {(question.isRequired || question.required) && (
                                <span className="text-sm font-medium text-red-600 bg-red-100 px-3 py-1 rounded-full">
                                  Required
                                </span>
                              )}
                              {!question.isActive && (
                                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                  Inactive
                                </span>
                              )}
                              {(question.questionWeight !== 1 && question.questionWeight !== undefined) && (
                                <span className="text-sm font-medium text-green-600 bg-green-100 px-3 py-1 rounded-full">
                                  Weighted
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <h3 className="text-xl font-semibold text-gray-900 mb-3">{question.title || question.text}</h3>
                          
                          {(question.category || question.category !== '') && (
                            <div className="text-sm text-gray-600 mb-3">
                              Category: <span className="font-medium text-gray-800">{question.category}</span>
                            </div>
                          )}
                          
                          {question.options && question.options.length > 0 && (
                            <div className="mb-4">
                              <div className="text-sm text-gray-600 mb-2">
                                Options:
                                {(question.questionWeight !== 1 && question.questionWeight !== undefined) && (
                                  <span className="text-xs text-green-600 ml-2">(Weighted)</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {question.options.map((option, index) => (
                                  <span key={index} className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-lg">
                                    {typeof option === 'string' ? option : option.text || option}
                                    {(question.questionWeight !== 1 && question.questionWeight !== undefined) && (
                                      <span className="text-green-600 font-medium ml-1">({question.weights?.[index] || (typeof option === 'object' ? option.weight : '')})</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-6 text-sm text-gray-500">
                            {question.usageCount !== undefined && (
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                                Used {question.usageCount} times
                              </span>
                            )}
                            {question.lastUsedAt && (
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Last used: {formatDate(question.lastUsedAt)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Created: {formatDate(question.createdAt)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-6">
                          <button
                            onClick={() => handleToggleActive(question.id, question.isActive)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                              question.isActive
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {question.isActive ? 'Active' : 'Inactive'}
                          </button>
                          
                          <Link
                            href={`/questions/edit/${question.id}`}
                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-all duration-200"
                          >
                            Edit
                          </Link>
                          
                          <button
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 