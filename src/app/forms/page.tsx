'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface Form {
  id: string;
  title: string;
  description: string;
  category: string;
  totalQuestions: number;
  estimatedTime: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export default function FormsPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    avgQuestions: 0
  });

  // Fetch forms from Firebase
  useEffect(() => {
    const fetchForms = async () => {
      try {
        const q = query(collection(db, 'forms'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const formsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Form[];
        
        setForms(formsData);
        
        // Calculate stats
        const total = formsData.length;
        const active = formsData.filter(form => form.isActive).length;
        const inactive = total - active;
        const avgQuestions = total > 0 ? Math.round(formsData.reduce((sum, form) => sum + form.totalQuestions, 0) / total) : 0;
        
        setStats({ total, active, inactive, avgQuestions });
      } catch (error) {
        console.error('Error fetching forms:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchForms();
  }, []);

  const toggleFormStatus = async (formId: string, currentStatus: boolean) => {
    try {
      const formRef = doc(db, 'forms', formId);
      await updateDoc(formRef, {
        isActive: !currentStatus,
        updatedAt: new Date()
      });
      
      // Update local state
      setForms(prev => prev.map(form => 
        form.id === formId 
          ? { ...form, isActive: !currentStatus }
          : form
      ));
      
      // Update stats
      setStats(prev => ({
        ...prev,
        active: currentStatus ? prev.active - 1 : prev.active + 1,
        inactive: currentStatus ? prev.inactive + 1 : prev.inactive - 1
      }));
    } catch (error) {
      console.error('Error updating form status:', error);
      alert('Error updating form status. Please try again.');
    }
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'general': 'General Check-in',
      'mental_health': 'Mental Health Assessment',
      'physical_health': 'Physical Health Check',
      'relationships': 'Relationship Assessment',
      'work': 'Work/Career Check-in',
      'lifestyle': 'Lifestyle Assessment',
      'goals': 'Goals & Progress Review'
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
          <p className="mt-4 text-gray-600">Loading forms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Forms Library</h1>
              <p className="mt-2 text-gray-600">Manage and organize your custom forms</p>
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
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Forms</p>
                <p className="text-lg font-semibold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Active Forms</p>
                <p className="text-lg font-semibold text-gray-900">{stats.active}</p>
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
                <p className="text-sm font-medium text-gray-500">Avg Questions</p>
                <p className="text-lg font-semibold text-gray-900">{stats.avgQuestions}</p>
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
                <p className="text-sm font-medium text-gray-500">Inactive Forms</p>
                <p className="text-lg font-semibold text-gray-900">{stats.inactive}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Forms List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">All Forms</h3>
          </div>
          
          {forms.length === 0 ? (
            <div className="p-6 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No forms yet</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating your first form.</p>
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
            <div className="divide-y divide-gray-200">
              {forms.map((form) => (
                <div key={form.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{form.title}</h4>
                          <p className="mt-1 text-sm text-gray-500">{form.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            form.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {form.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getCategoryLabel(form.category)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center">
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {form.totalQuestions} questions
                        </div>
                        <div className="flex items-center">
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          ~{form.estimatedTime} min
                        </div>
                        <div className="flex items-center">
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Created {formatDate(form.createdAt)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-6 flex items-center space-x-3">
                      <button
                        onClick={() => toggleFormStatus(form.id, form.isActive)}
                        className={`px-3 py-1 text-sm rounded-md ${
                          form.isActive
                            ? 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200'
                            : 'text-green-700 bg-green-100 hover:bg-green-200'
                        }`}
                      >
                        {form.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <Link
                        href={`/forms/${form.id}`}
                        className="px-3 py-1 text-sm text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
                      >
                        View
                      </Link>
                      <Link
                        href={`/forms/${form.id}/edit`}
                        className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 