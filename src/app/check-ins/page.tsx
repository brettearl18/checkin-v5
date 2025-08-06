'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';

interface CheckIn {
  id: string;
  clientId: string;
  clientName?: string;
  formId: string;
  formTitle: string;
  responses: { [key: string]: any };
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  submittedAt: any;
  mood?: number;
  energy?: number;
}

interface Client {
  id: string;
  name: string;
  email: string;
  status: string;
}

export default function CheckInsPage() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [clients, setClients] = useState<{ [key: string]: Client }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedForm, setSelectedForm] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  useEffect(() => {
    const fetchCheckIns = async () => {
      try {
        // Fetch all form responses (check-ins)
        const responsesQuery = query(
          collection(db, 'form_responses'),
          orderBy('submittedAt', 'desc')
        );
        const responsesSnapshot = await getDocs(responsesQuery);
        
        const checkInsData: CheckIn[] = [];
        const clientIds = new Set<string>();
        const formIds = new Set<string>();

        responsesSnapshot.forEach((doc) => {
          const data = doc.data();
          checkInsData.push({
            id: doc.id,
            ...data
          } as CheckIn);
          
          // Extract client ID from form title or use a default
          const clientId = data.clientId || 'unknown';
          clientIds.add(clientId);
          formIds.add(data.formId);
        });

        setCheckIns(checkInsData);

        // Fetch client details
        const clientsData: { [key: string]: Client } = {};
        for (const clientId of clientIds) {
          if (clientId !== 'unknown') {
            try {
              const clientDoc = await getDoc(doc(db, 'clients', clientId));
              if (clientDoc.exists()) {
                clientsData[clientId] = { id: clientDoc.id, ...clientDoc.data() } as Client;
              }
            } catch (error) {
              console.log(`Client ${clientId} not found`);
            }
          }
        }
        setClients(clientsData);
      } catch (error) {
        console.error('Error fetching check-ins:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCheckIns();
  }, []);

  const filteredCheckIns = checkIns.filter(checkIn => {
    const clientMatch = selectedClient === 'all' || checkIn.clientId === selectedClient;
    const formMatch = selectedForm === 'all' || checkIn.formId === selectedForm;
    
    let dateMatch = true;
    if (dateRange !== 'all') {
      const checkInDate = checkIn.submittedAt?.toDate ? checkIn.submittedAt.toDate() : new Date(checkIn.submittedAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dateRange === 'today' && daysDiff > 0) dateMatch = false;
      if (dateRange === 'week' && daysDiff > 7) dateMatch = false;
      if (dateRange === 'month' && daysDiff > 30) dateMatch = false;
    }
    
    return clientMatch && formMatch && dateMatch;
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

  const getClientName = (clientId: string) => {
    return clients[clientId]?.name || 'Unknown Client';
  };

  const getUniqueForms = () => {
    const forms = new Set<string>();
    checkIns.forEach(checkIn => forms.add(checkIn.formTitle));
    return Array.from(forms);
  };

  const getUniqueClients = () => {
    return Object.values(clients);
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
          <h1 className="text-3xl font-bold text-gray-900">Client Check-ins</h1>
          <p className="mt-2 text-gray-600">
            Monitor client progress and engagement through their check-in submissions
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-blue-600">{checkIns.length}</div>
            <div className="text-sm text-gray-600">Total Check-ins</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">
              {checkIns.filter(c => c.score >= 80).length}
            </div>
            <div className="text-sm text-gray-600">High Performers</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-yellow-600">
              {getUniqueClients().length}
            </div>
            <div className="text-sm text-gray-600">Active Clients</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(checkIns.reduce((sum, c) => sum + c.score, 0) / checkIns.length || 0)}
            </div>
            <div className="text-sm text-gray-600">Avg Score</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Client
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Clients</option>
                {getUniqueClients().map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Form
              </label>
              <select
                value={selectedForm}
                onChange={(e) => setSelectedForm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Forms</option>
                {getUniqueForms().map((formTitle) => (
                  <option key={formTitle} value={formTitle}>
                    {formTitle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Check-ins List */}
        <div className="space-y-4">
          {filteredCheckIns.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-500 text-lg mb-2">No check-ins found</div>
              <p className="text-gray-400">
                {checkIns.length === 0 
                  ? "No check-ins have been submitted yet."
                  : "No check-ins match your current filters."
                }
              </p>
            </div>
          ) : (
            filteredCheckIns.map((checkIn) => (
              <div key={checkIn.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getClientName(checkIn.clientId)}
                      </h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {clients[checkIn.clientId]?.status || 'Active'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      Form: {checkIn.formTitle}
                    </p>
                    <p className="text-sm text-gray-500">
                      Submitted: {formatDate(checkIn.submittedAt)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Questions: {checkIn.answeredQuestions}/{checkIn.totalQuestions}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(checkIn.score)}`}>
                      {checkIn.score}% - {getScoreLabel(checkIn.score)}
                    </div>
                    {checkIn.mood && (
                      <div className="mt-2 text-sm text-gray-600">
                        Mood: {checkIn.mood}/10
                      </div>
                    )}
                    {checkIn.energy && (
                      <div className="text-sm text-gray-600">
                        Energy: {checkIn.energy}/10
                      </div>
                    )}
                  </div>
                </div>

                {/* Response Summary */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Check-in Summary:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      {Object.entries(checkIn.responses).slice(0, Math.ceil(Object.keys(checkIn.responses).length / 2)).map(([questionId, answer]) => (
                        <div key={questionId} className="text-sm">
                          <span className="font-medium text-gray-600">Q{questionId}:</span>
                          <span className="ml-2 text-gray-900">
                            {typeof answer === 'boolean' ? (answer ? 'Yes' : 'No') : answer}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {Object.entries(checkIn.responses).slice(Math.ceil(Object.keys(checkIn.responses).length / 2)).map(([questionId, answer]) => (
                        <div key={questionId} className="text-sm">
                          <span className="font-medium text-gray-600">Q{questionId}:</span>
                          <span className="ml-2 text-gray-900">
                            {typeof answer === 'boolean' ? (answer ? 'Yes' : 'No') : answer}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/client/${checkIn.clientId}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Client Profile
                    </Link>
                    <Link
                      href={`/forms/${checkIn.formId}`}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      View Form
                    </Link>
                    <button className="text-purple-600 hover:text-purple-800 text-sm font-medium">
                      Add Coach Notes
                    </button>
                    <button className="text-orange-600 hover:text-orange-800 text-sm font-medium">
                      Send Follow-up
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