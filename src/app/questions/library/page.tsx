'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Question {
  id: string;
  text: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'scale' | 'boolean' | 'date' | 'time' | 'textarea';
  category: string;
  options?: Array<{ text: string; weight: number }>;
  required: boolean;
  isActive: boolean;
  usageCount?: number;
  lastUsedAt?: any;
  createdAt: any;
  createdBy?: string;
  hasWeighting?: boolean;
}

export default function QuestionLibraryPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch('/api/questions');
        const data = await response.json();
        
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

    fetchQuestions();
  }, []);

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
    const matchesSearch = question.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || question.category === selectedCategory;
    const matchesType = selectedType === 'all' || question.type === selectedType;
    const matchesStatus = showInactive ? true : question.isActive;
    
    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  const categories = ['all', ...Array.from(new Set(questions.map(q => q.category)))];
  const types = ['all', 'text', 'number', 'select', 'multiselect', 'scale', 'boolean', 'date', 'time', 'textarea'];

  const stats = {
    total: questions.length,
    active: questions.filter(q => q.isActive).length,
    categories: new Set(questions.map(q => q.category)).size,
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Question Library</h1>
              <p className="text-gray-600 mt-2">Manage and reuse questions across your forms</p>
            </div>
            <Link
              href="/questions/create"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              + Create Question
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Questions</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-sm text-gray-600">Active Questions</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-purple-600">{stats.categories}</div>
              <div className="text-sm text-gray-600">Categories</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-orange-600">{stats.mostUsed?.usageCount || 0}</div>
              <div className="text-sm text-gray-600">Most Used</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
              
              {/* Search */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Questions</label>
                <input
                  type="text"
                  placeholder="Search question text..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {types.map(type => (
                    <option key={type} value={type}>
                      {type === 'all' ? 'All Types' : getTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Show inactive questions</span>
                </label>
              </div>

              {/* Results Count */}
              <div className="text-sm text-gray-600">
                {filteredQuestions.length} of {questions.length} questions
              </div>
            </div>
          </div>

          {/* Questions List */}
          <div className="lg:col-span-3">
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-lg border p-8 text-center">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No questions found</h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || selectedCategory !== 'all' || selectedType !== 'all' 
                    ? 'Try adjusting your filters or search terms.'
                    : 'Get started by creating your first question.'}
                </p>
                <Link
                  href="/questions/create"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Create Your First Question
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredQuestions.map((question) => (
                  <div key={question.id} className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{getTypeIcon(question.type)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {getTypeLabel(question.type)}
                            </span>
                            {question.required && (
                              <span className="text-sm font-medium text-red-500 bg-red-100 px-2 py-1 rounded">
                                Required
                              </span>
                            )}
                            {!question.isActive && (
                              <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                Inactive
                              </span>
                            )}
                            {question.hasWeighting && (
                              <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                                Weighted
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{question.text}</h3>
                        
                        {question.category && (
                          <div className="text-sm text-gray-600 mb-2">
                            Category: <span className="font-medium">{question.category}</span>
                          </div>
                        )}
                        
                        {question.options && question.options.length > 0 && (
                          <div className="mb-3">
                            <div className="text-sm text-gray-600 mb-1">
                              Options:
                              {question.hasWeighting && (
                                <span className="text-xs text-green-600 ml-2">(Weighted)</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {question.options.map((option, index) => (
                                <span key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {option.text}
                                  {question.hasWeighting && (
                                    <span className="text-green-600 font-medium ml-1">({option.weight})</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {question.usageCount !== undefined && (
                            <span>Used {question.usageCount} times</span>
                          )}
                          {question.lastUsedAt && (
                            <span>Last used: {question.lastUsedAt.toDate().toLocaleDateString()}</span>
                          )}
                          <span>Created: {question.createdAt.toDate().toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleToggleActive(question.id, question.isActive)}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            question.isActive
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {question.isActive ? 'Active' : 'Inactive'}
                        </button>
                        
                        <Link
                          href={`/questions/edit/${question.id}`}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
                        >
                          Edit
                        </Link>
                        
                        <button
                          onClick={() => handleDeleteQuestion(question.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition-colors"
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
  );
} 