'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';

interface Form {
  id: string;
  title: string;
  description?: string;
  category: string;
  estimatedTime: number;
  isActive: boolean;
  questions: string[];
  createdAt: any;
  totalAssignments?: number;
  lastAssignedAt?: any;
}

export default function FormLibraryPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const formsQuery = query(
          collection(db, 'forms'),
          orderBy('createdAt', 'desc')
        );
        const formsSnapshot = await getDocs(formsQuery);
        const formsData: Form[] = [];
        formsSnapshot.forEach((doc) => {
          formsData.push({ id: doc.id, ...doc.data() } as Form);
        });
        setForms(formsData);
      } catch (error) {
        console.error('Error fetching forms:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchForms();
  }, []);

  const filteredForms = forms.filter(form => {
    const categoryMatch = selectedCategory === 'all' || form.category === selectedCategory;
    const searchMatch = form.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (form.description && form.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return categoryMatch && searchMatch;
  });

  const handleDeleteForm = async (formId: string) => {
    if (confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'forms', formId));
        setForms(forms.filter(form => form.id !== formId));
      } catch (error) {
        console.error('Error deleting form:', error);
        alert('Error deleting form. Please try again.');
      }
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'general': 'bg-blue-100 text-blue-800',
      'mental_health': 'bg-purple-100 text-purple-800',
      'physical_health': 'bg-green-100 text-green-800',
      'relationships': 'bg-pink-100 text-pink-800',
      'work': 'bg-yellow-100 text-yellow-800',
      'lifestyle': 'bg-indigo-100 text-indigo-800',
      'goals': 'bg-orange-100 text-orange-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'general', label: 'General Check-in' },
    { value: 'mental_health', label: 'Mental Health Assessment' },
    { value: 'physical_health', label: 'Physical Health Check' },
    { value: 'relationships', label: 'Relationship Assessment' },
    { value: 'work', label: 'Work/Career Check-in' },
    { value: 'lifestyle', label: 'Lifestyle Assessment' },
    { value: 'goals', label: 'Goals & Progress Review' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Form Library</h1>
              <p className="mt-2 text-gray-600">Manage and organize your check-in forms</p>
            </div>
            <Link
              href="/forms/create"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              + Create New Form
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Forms
              </label>
              <input
                type="text"
                placeholder="Search by title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Filter
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Forms Grid */}
        {filteredForms.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No forms found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {forms.length === 0 
                ? "Get started by creating your first form."
                : "Try adjusting your search or filter criteria."
              }
            </p>
            {forms.length === 0 && (
              <div className="mt-6">
                <Link
                  href="/forms/create"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create Your First Form
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredForms.map((form) => (
              <div key={form.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {form.title}
                      </h3>
                      {form.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {form.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 mb-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(form.category)}`}>
                          {categories.find(c => c.value === form.category)?.label || form.category}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${form.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {form.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>Questions: {form.questions?.length || 0}</p>
                        <p>Est. Time: {form.estimatedTime} min</p>
                        <p>Created: {formatDate(form.createdAt)}</p>
                        {form.totalAssignments !== undefined && (
                          <p>Assignments: {form.totalAssignments}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex space-x-2">
                      <Link
                        href={`/forms/${form.id}/edit`}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/check-ins/send?form=${form.id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                      >
                        Send
                      </Link>
                    </div>
                    <button
                      onClick={() => handleDeleteForm(form.id)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {forms.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Form Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{forms.length}</div>
                <div className="text-sm text-gray-600">Total Forms</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {forms.filter(f => f.isActive).length}
                </div>
                <div className="text-sm text-gray-600">Active Forms</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {forms.reduce((total, form) => total + (form.totalAssignments || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Assignments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {categories.length - 1}
                </div>
                <div className="text-sm text-gray-600">Categories</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 