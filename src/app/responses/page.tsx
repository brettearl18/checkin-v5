'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';

interface FormResponse {
  id: string;
  formId: string;
  formTitle: string;
  responses: { [key: string]: any };
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  submittedAt: any;
}

interface Form {
  id: string;
  title: string;
  description: string;
  category: string;
}

export default function ResponsesPage() {
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [forms, setForms] = useState<{ [key: string]: Form }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const fetchResponses = async () => {
      try {
        // Fetch all form responses
        const responsesQuery = query(
          collection(db, 'form_responses'),
          orderBy('submittedAt', 'desc')
        );
        const responsesSnapshot = await getDocs(responsesQuery);
        
        const responsesData: FormResponse[] = [];
        const formIds = new Set<string>();

        responsesSnapshot.forEach((doc) => {
          const data = doc.data();
          responsesData.push({
            id: doc.id,
            ...data
          } as FormResponse);
          formIds.add(data.formId);
        });

        setResponses(responsesData);

        // Fetch form details for each response
        const formsData: { [key: string]: Form } = {};
        for (const formId of formIds) {
          const formDoc = await getDoc(doc(db, 'forms', formId));
          if (formDoc.exists()) {
            formsData[formId] = { id: formDoc.id, ...formDoc.data() } as Form;
          }
        }
        setForms(formsData);
      } catch (error) {
        console.error('Error fetching responses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResponses();
  }, []);

  const filteredResponses = responses.filter(response => {
    const formMatch = selectedForm === 'all' || response.formId === selectedForm;
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'high' && response.score >= 80) ||
      (filterStatus === 'medium' && response.score >= 60 && response.score < 80) ||
      (filterStatus === 'low' && response.score < 60);
    
    return formMatch && statusMatch;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Attention';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
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
          <h1 className="text-3xl font-bold text-gray-900">Form Responses & Check-ins</h1>
          <p className="mt-2 text-gray-600">
            View and analyze all client form submissions and check-in responses
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-blue-600">{responses.length}</div>
            <div className="text-sm text-gray-600">Total Responses</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">
              {responses.filter(r => r.score >= 80).length}
            </div>
            <div className="text-sm text-gray-600">Excellent Scores</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-yellow-600">
              {responses.filter(r => r.score >= 60 && r.score < 80).length}
            </div>
            <div className="text-sm text-gray-600">Good Scores</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-red-600">
              {responses.filter(r => r.score < 60).length}
            </div>
            <div className="text-sm text-gray-600">Needs Attention</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Form
              </label>
              <select
                value={selectedForm}
                onChange={(e) => setSelectedForm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Forms</option>
                {Object.values(forms).map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Score
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Scores</option>
                <option value="high">Excellent (80+)</option>
                <option value="medium">Good (60-79)</option>
                <option value="low">Needs Attention (&lt;60)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Responses List */}
        <div className="space-y-4">
          {filteredResponses.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-500 text-lg mb-2">No responses found</div>
              <p className="text-gray-400">
                {responses.length === 0 
                  ? "No form responses have been submitted yet."
                  : "No responses match your current filters."
                }
              </p>
            </div>
          ) : (
            filteredResponses.map((response) => (
              <div key={response.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {response.formTitle || forms[response.formId]?.title || 'Unknown Form'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Submitted: {formatDate(response.submittedAt)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Questions: {response.answeredQuestions}/{response.totalQuestions}
                    </p>
                  </div>
                  <div className="ml-4">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(response.score)}`}>
                      {response.score}% - {getScoreLabel(response.score)}
                    </div>
                  </div>
                </div>

                {/* Response Details */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Response Details:</h4>
                  <div className="space-y-2">
                    {Object.entries(response.responses).map(([questionId, answer]) => (
                      <div key={questionId} className="text-sm">
                        <span className="font-medium text-gray-600">Q{questionId}:</span>
                        <span className="ml-2 text-gray-900">
                          {typeof answer === 'boolean' ? (answer ? 'Yes' : 'No') : answer}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex space-x-3">
                    <Link
                      href={`/forms/${response.formId}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Form
                    </Link>
                    <button className="text-green-600 hover:text-green-800 text-sm font-medium">
                      Export Response
                    </button>
                    <button className="text-purple-600 hover:text-purple-800 text-sm font-medium">
                      Add Notes
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 