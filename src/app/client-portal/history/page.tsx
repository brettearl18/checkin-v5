'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';

interface ResponseHistory {
  id: string;
  checkInTitle: string;
  formTitle: string;
  submittedAt: string;
  score: number;
  status: 'completed' | 'pending';
  responses: any[];
}

export default function ClientHistoryPage() {
  const { userProfile } = useAuth();
  const [history, setHistory] = useState<ResponseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, recent, high-score, low-score

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const clientId = userProfile?.uid;
      if (!clientId) return;

      const response = await fetch(`/api/client-portal/history?clientId=${clientId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setHistory(data.history);
        }
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const filteredHistory = history.filter(item => {
    switch (filter) {
      case 'recent':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return new Date(item.submittedAt) > thirtyDaysAgo;
      case 'high-score':
        return item.score >= 80;
      case 'low-score':
        return item.score < 60;
      default:
        return true;
    }
  });

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-8 p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Response History</h1>
            <p className="text-gray-600">Track your completed check-ins and responses</p>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <div className="flex space-x-4">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                All Responses
              </button>
              <button
                onClick={() => setFilter('recent')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'recent' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setFilter('high-score')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'high-score' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                High Scores (80%+)
              </button>
              <button
                onClick={() => setFilter('low-score')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'low-score' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Needs Attention (under 60%)
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Responses</p>
                  <p className="text-2xl font-bold text-gray-900">{history.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {history.length > 0 
                      ? Math.round(history.reduce((sum, item) => sum + item.score, 0) / history.length)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">High Scores</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {history.filter(item => item.score >= 80).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-red-100 rounded-lg">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Needs Attention</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {history.filter(item => item.score < 60).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* History List */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">
                {filter === 'all' && 'All Responses'}
                {filter === 'recent' && 'Recent Responses (Last 30 Days)'}
                {filter === 'high-score' && 'High Score Responses'}
                {filter === 'low-score' && 'Responses Needing Attention'}
              </h2>
              <p className="text-gray-600 mt-1">
                {filteredHistory.length} response{filteredHistory.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading your history...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No responses found</h3>
                <p className="text-gray-600">
                  {filter === 'all' && "You haven't completed any check-ins yet."}
                  {filter === 'recent' && "No responses in the last 30 days."}
                  {filter === 'high-score' && "No high score responses yet."}
                  {filter === 'low-score' && "Great job! No responses need attention."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredHistory.map((item) => (
                  <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {item.checkInTitle}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getScoreBadge(item.score)}`}>
                            {item.score}%
                          </span>
                        </div>
                        <p className="text-gray-600 mt-1">{item.formTitle}</p>
                        <p className="text-sm text-gray-500 mt-2">
                          Completed on {formatDate(item.submittedAt)}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className={`text-2xl font-bold ${getScoreColor(item.score)}`}>
                          {item.score}%
                        </div>
                        <Link
                          href={`/client-portal/history/${item.id}`}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          View Details
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
    </RoleProtected>
  );
} 