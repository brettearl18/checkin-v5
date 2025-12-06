'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';

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

interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialization?: string;
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
  const [coach, setCoach] = useState<Coach | null>(null);
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
          const { client, coach, checkInAssignments, summary } = data.data;
          
          // Calculate stats from the summary data
          const calculatedStats = {
            overallProgress: summary.completedAssignments > 0 ? Math.round((summary.completedAssignments / summary.totalAssignments) * 100) : 0,
            completedCheckins: summary.completedAssignments || 0,
            totalCheckins: summary.totalAssignments || 0,
            averageScore: 0 // This would need to be calculated from actual responses
          };
          
          setStats(calculatedStats);
          setAssignedCheckins(checkInAssignments || []);
          setRecentResponses([]); // API doesn't provide this yet
          setCoach(coach);
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
          setCoach(null);
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
        setCoach(null);
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
      setCoach(null);
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
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Welcome Back!</h1>
                <p className="text-gray-600 mt-2">Track your progress and stay connected with your coach</p>
              </div>
              <div className="flex items-center space-x-4">
                <NotificationBell />
                {coach ? (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Your Coach</p>
                    <p className="text-lg font-semibold text-gray-900">{coach.firstName} {coach.lastName}</p>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">No coach assigned</p>
                    <p className="text-lg font-semibold text-gray-900">N/A</p>
                  </div>
                )}
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
                <div className="text-3xl font-bold text-gray-900">{stats?.totalCheckins || 0}</div>
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
                <div className="text-3xl font-bold text-gray-900">{stats?.completedCheckins || 0}</div>
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
                <div className="text-3xl font-bold text-gray-900">{stats?.averageScore || 0}%</div>
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
                  {stats?.lastActivity ? new Date(stats.lastActivity).toLocaleDateString() : 'N/A'}
                </div>
                <div className="text-sm text-gray-500 mt-1">Recent check-in</div>
              </div>
            </div>
          </div>

          {/* Upcoming Check-ins Section - Front and Centre */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 rounded-2xl shadow-xl border border-orange-200 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-6 border-b border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">This Week's Check-ins</h2>
                      <p className="text-orange-100 text-sm">Complete these to stay on track with your wellness journey</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white text-sm font-medium">Due This Week</div>
                    <div className="text-2xl font-bold text-white">
                      {assignedCheckins.filter(checkIn => {
                        const dueDate = new Date(checkIn.dueDate);
                        const now = new Date();
                        const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        return daysDiff >= 0 && daysDiff <= 7 && checkIn.status === 'pending';
                      }).length}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-8">
                {(() => {
                  const upcomingCheckins = assignedCheckins.filter(checkIn => {
                    const dueDate = new Date(checkIn.dueDate);
                    const now = new Date();
                    const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return daysDiff >= 0 && daysDiff <= 7 && checkIn.status === 'pending';
                  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                  if (upcomingCheckins.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-orange-600 text-lg font-medium mb-2">All caught up!</p>
                        <p className="text-orange-500 text-sm">No check-ins due this week. Great job staying on top of your wellness goals!</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {upcomingCheckins.map((checkIn) => {
                        const dueDate = new Date(checkIn.dueDate);
                        const now = new Date();
                        const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        const isToday = daysDiff === 0;
                        const isTomorrow = daysDiff === 1;
                        const isUrgent = daysDiff <= 2;

                        return (
                          <div 
                            key={checkIn.id} 
                            className={`bg-white rounded-xl p-6 border-2 transition-all duration-200 hover:shadow-lg ${
                              isUrgent ? 'border-red-300 bg-red-50' : 'border-orange-200 hover:border-orange-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    isUrgent ? 'bg-red-100' : 'bg-orange-100'
                                  }`}>
                                    <svg className={`w-4 h-4 ${isUrgent ? 'text-red-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <h3 className="text-lg font-semibold text-gray-900">{checkIn.title}</h3>
                                </div>
                                <div className="flex items-center space-x-4 text-sm">
                                  <div className={`flex items-center space-x-1 ${
                                    isUrgent ? 'text-red-600' : 'text-orange-600'
                                  }`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-medium">
                                      {isToday ? 'Due Today!' : 
                                       isTomorrow ? 'Due Tomorrow' : 
                                       `Due in ${daysDiff} days`}
                                    </span>
                                  </div>
                                  <span className="text-gray-500">
                                    {dueDate.toLocaleDateString('en-US', { 
                                      weekday: 'long', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  isUrgent ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {isUrgent ? 'Urgent' : 'Upcoming'}
                                </div>
                                <Link
                                  href={`/client-portal/check-in/${checkIn.id}`}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    isUrgent 
                                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl' 
                                      : 'bg-orange-600 hover:bg-orange-700 text-white shadow-md hover:shadow-lg'
                                  }`}
                                >
                                  {isUrgent ? 'Complete Now' : 'Start Check-in'}
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
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
              {/* Coach Information */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Your Coach</h3>
                </div>
                <div className="p-6">
                  {coach ? (
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <span className="text-white font-bold text-xl">
                          {coach.firstName?.charAt(0) || 'C'}
                        </span>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">
                        {coach.firstName} {coach.lastName}
                      </h4>
                      <p className="text-gray-600 text-sm mb-3">{coach.email}</p>
                      {coach.specialization && (
                        <p className="text-gray-500 text-xs mb-4">{coach.specialization}</p>
                      )}
                      <Link
                        href="/client-portal/messages"
                        className="inline-flex items-center justify-center w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Message Coach
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm mb-3">No coach assigned</p>
                      <p className="text-gray-400 text-xs">Contact support to get assigned to a coach</p>
                    </div>
                  )}
                </div>
              </div>

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