'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';

interface ClientStats {
  overallProgress: number;
  completedCheckins: number;
  totalCheckins: number;
  averageScore: number;
}

interface CheckIn {
  id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  formId: string;
}

interface RecentResponse {
  id: string;
  checkInTitle: string;
  submittedAt: string;
  score: number;
  status: 'completed' | 'pending';
}

export default function ClientPortalPage() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<ClientStats>({
    overallProgress: 0,
    completedCheckins: 0,
    totalCheckins: 0,
    averageScore: 0
  });
  const [assignedCheckins, setAssignedCheckins] = useState<CheckIn[]>([]);
  const [recentResponses, setRecentResponses] = useState<RecentResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientData();
  }, []);

  const fetchClientData = async () => {
    try {
      // Fetch client-specific data
      const clientId = userProfile?.uid || 'demo-client-id';
      
      // Fetch real data from API
      const response = await fetch(`/api/client-portal?clientId=${clientId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          const { stats: apiStats, assignedCheckins, recentResponses } = data.data;
          
          setStats(apiStats);
          setAssignedCheckins(assignedCheckins);
          setRecentResponses(recentResponses);
        } else {
          console.error('API returned error:', data.message);
          // Fallback to empty data
          setStats({
            overallProgress: 0,
            completedCheckins: 0,
            totalCheckins: 0,
            averageScore: 0
          });
          setAssignedCheckins([]);
          setRecentResponses([]);
        }
      } else {
        console.error('Failed to fetch client data:', response.status);
        // Fallback to empty data
        setStats({
          overallProgress: 0,
          completedCheckins: 0,
          totalCheckins: 0,
          averageScore: 0
        });
        setAssignedCheckins([]);
        setRecentResponses([]);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
      // Fallback to empty data
      setStats({
        overallProgress: 0,
        completedCheckins: 0,
        totalCheckins: 0,
        averageScore: 0
      });
      setAssignedCheckins([]);
      setRecentResponses([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'overdue':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gray-50 flex">
          <ClientNavigation />
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow p-6">
                      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-green-200 text-green-800';
    if (score >= 70) return 'bg-yellow-200 text-yellow-800';
    if (score >= 50) return 'bg-orange-200 text-orange-800';
    return 'bg-red-200 text-red-800';
  };

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-8 p-6">
          {/* Modern Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Client Portal
                </h1>
                <p className="text-gray-600 mt-2 text-lg">Welcome back, {userProfile?.firstName || 'Client'}!</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-2xl">
                    {userProfile?.firstName?.charAt(0) || 'C'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-500">Total Check-ins</span>
                </div>
              </div>
              <div className="p-6">
                <div className="text-3xl font-bold text-gray-900">{stats.totalCheckins}</div>
                <div className="text-sm text-gray-500 mt-1">Assigned to you</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-500">Completed</span>
                </div>
              </div>
              <div className="p-6">
                <div className="text-3xl font-bold text-gray-900">{stats.completedCheckins}</div>
                <div className="text-sm text-gray-500 mt-1">Successfully completed</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-500">Average Score</span>
                </div>
              </div>
              <div className="p-6">
                <div className="text-3xl font-bold text-gray-900">{stats.averageScore}%</div>
                <div className="text-sm text-gray-500 mt-1">Your performance</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-50 to-red-50 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-500">Last Activity</span>
                </div>
              </div>
              <div className="p-6">
                <div className="text-3xl font-bold text-gray-900">
                  {stats.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : 'N/A'}
                </div>
                <div className="text-sm text-gray-500 mt-1">Recent check-in</div>
              </div>
            </div>
          </div>

          {/* Main Content and Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Recent Responses */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-900">Recent Responses</h2>
                  <p className="text-gray-600 mt-1">Your latest check-in responses and feedback</p>
                </div>
                <div className="p-8">
                  {recentResponses.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-lg mb-4">No recent responses</p>
                      <p className="text-gray-400 text-sm">Your responses will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentResponses.map((response) => (
                        <div key={response.id} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-200 hover:border-gray-300">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-gray-900">{response.formTitle}</h3>
                                <p className="text-gray-600 text-sm">Submitted {new Date(response.submittedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`px-4 py-2 text-sm font-medium rounded-full ${getScoreColor(response.score)}`}>
                                {response.score}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-6 space-y-3">
                  <Link
                    href="/client-portal/check-ins"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                  >
                    View Check-ins
                  </Link>
                  <Link
                    href="/client-portal/progress"
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                  >
                    View Progress
                  </Link>
                  <Link
                    href="/client-portal/profile"
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                  >
                    Update Profile
                  </Link>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Progress Summary</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Completion Rate</span>
                    <span className="font-bold text-gray-900">
                      {stats.totalCheckins > 0 ? Math.round((stats.completedCheckins / stats.totalCheckins) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Performance</span>
                    <span className="font-bold text-gray-900">
                      {stats.averageScore >= 80 ? 'Excellent' : 
                       stats.averageScore >= 60 ? 'Good' : 'Needs Improvement'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Active Streak</span>
                    <span className="font-bold text-gray-900">
                      {stats.lastActivity ? 'Current' : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 