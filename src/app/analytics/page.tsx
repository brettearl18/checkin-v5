'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import CoachNavigation from '@/components/CoachNavigation';

interface Client {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'at-risk';
  lastCheckIn?: string;
  completionRate: number;
  averageScore: number;
  scoringProfile: string;
  goals: string[];
}

interface FormAnalytics {
  totalForms: number;
  completionRate: number;
  averageResponseTime: number;
  popularTemplates: Array<{
    name: string;
    usage: number;
    completionRate: number;
  }>;
}

interface QuestionAnalytics {
  totalQuestions: number;
  mostUsed: Array<{
    text: string;
    usage: number;
    effectiveness: number;
  }>;
  weightedQuestions: number;
}

interface PerformanceMetrics {
  overallAverage: number;
  scoreDistribution: {
    green: number;
    yellow: number;
    red: number;
  };
  topPerformers: Client[];
  needsAttention: Client[];
  trendData: Array<{
    date: string;
    averageScore: number;
    activeClients: number;
  }>;
}

interface GoalProgress {
  overallProgress: number;
  achievementRate: number;
  trendingGoals: Array<{
    goal: string;
    progress: number;
    clients: number;
  }>;
}

export default function AnalyticsPage() {
  const { userProfile, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [selectedPerformanceType, setSelectedPerformanceType] = useState<'high' | 'average' | 'needs-attention' | null>(null);
  
  const [analyticsData, setAnalyticsData] = useState({
    clientStats: {
      total: 0,
      active: 0,
      atRisk: 0,
      newThisMonth: 0,
      completionRate: 0
    },
    performanceMetrics: {
      overallAverage: 0,
      scoreDistribution: {
        green: 0,
        yellow: 0,
        red: 0
      },
      topPerformers: [],
      needsAttention: [],
      trendData: []
    },
    formAnalytics: {
      totalForms: 0,
      completionRate: 0,
      averageResponseTime: 0,
      popularTemplates: []
    },
    questionAnalytics: {
      totalQuestions: 0,
      mostUsed: [],
      weightedQuestions: 0
    },
    goalProgress: {
      overallProgress: 0,
      achievementRate: 0,
      trendingGoals: []
    },
    areasOfConcern: {
      groupLevel: [],
      individual: []
    }
  });

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      // Wait for userProfile to be loaded
      if (!userProfile?.uid) {
        // Don't set loading to false yet - wait for profile to load
        return;
      }
      
      try {
        setIsLoading(true);
        const coachId = userProfile.uid;
        
        const response = await fetch(`/api/analytics/overview?timeRange=${timeRange}&coachId=${coachId}`);
        const result = await response.json();
        
        if (result.success) {
          setAnalyticsData(result.data);
        } else {
          console.error('Failed to fetch analytics data:', result.message);
        }
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [timeRange, userProfile?.uid]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#34C759]';
    if (score >= 60) return 'text-orange-600';
    return 'text-[#FF3B30]';
  };

  const getScoreStatus = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Attention';
  };

  const handlePerformanceClick = (type: 'high' | 'average' | 'needs-attention') => {
    setSelectedPerformanceType(type);
    setShowPerformanceModal(true);
  };

  const getPerformanceTitle = (type: 'high' | 'average' | 'needs-attention') => {
    switch (type) {
      case 'high': return 'High Performers';
      case 'average': return 'Average Performers';
      case 'needs-attention': return 'Clients Needing Attention';
      default: return '';
    }
  };

  const getPerformanceClients = (type: 'high' | 'average' | 'needs-attention') => {
    switch (type) {
      case 'high': return analyticsData.performanceMetrics?.topPerformers || [];
      case 'average': return analyticsData.performanceMetrics?.needsAttention?.filter(c => c.averageScore >= 60 && c.averageScore < 80) || [];
      case 'needs-attention': return analyticsData.performanceMetrics?.needsAttention?.filter(c => c.averageScore < 60) || [];
      default: return [];
    }
  };

  const getPerformanceColor = (type: 'high' | 'average' | 'needs-attention') => {
    switch (type) {
      case 'high': return 'text-[#34C759]';
      case 'average': return 'text-orange-600';
      case 'needs-attention': return 'text-[#FF3B30]';
      default: return '';
    }
  };

  if (isLoading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-white flex">
          <CoachNavigation />
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-4 text-gray-800">Loading Analytics Dashboard...</p>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-white flex">
        <CoachNavigation />

        {/* Main Content */}
        <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <div className="max-w-7xl mx-auto w-full">
            {/* Modern Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">
                    Analytics Dashboard
                  </h1>
                  <p className="text-gray-600 mt-2 text-lg">Comprehensive insights into your coaching business</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="bg-orange-50 px-6 py-4 border-b-2 border-orange-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Total Clients</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">{analyticsData.clientStats?.total || 0}</div>
                  <div className="text-sm text-gray-600 mt-1">Active clients</div>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="bg-orange-50 px-6 py-4 border-b-2 border-orange-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Avg Score</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">{analyticsData.performanceMetrics?.overallAverage || 0}%</div>
                  <div className="text-sm text-gray-600 mt-1">Client performance</div>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="bg-orange-50 px-6 py-4 border-b-2 border-orange-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Total Forms</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">{analyticsData.formAnalytics?.totalForms || 0}</div>
                  <div className="text-sm text-gray-600 mt-1">Available forms</div>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="bg-orange-50 px-6 py-4 border-b-2 border-orange-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700">Goal Progress</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">{analyticsData.goalProgress?.overallProgress || 0}%</div>
                  <div className="text-sm text-gray-600 mt-1">Overall progress</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-8">
                {/* Performance Metrics */}
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                    <h2 className="text-2xl font-bold text-gray-900">Performance Metrics</h2>
                  </div>
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <button 
                        onClick={() => handlePerformanceClick('high')}
                        className="text-center group hover:bg-orange-50 rounded-2xl p-4 transition-all duration-200 hover:shadow-md"
                      >
                        <div className="text-3xl font-bold text-[#34C759] mb-2 group-hover:scale-110 transition-transform duration-200">
                          {analyticsData.performanceMetrics?.scoreDistribution?.green || 0}
                        </div>
                        <div className="text-sm text-gray-600 group-hover:text-gray-900">High Performers</div>
                        <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">Click to view details</div>
                      </button>
                      <button 
                        onClick={() => handlePerformanceClick('average')}
                        className="text-center group hover:bg-orange-50 rounded-2xl p-4 transition-all duration-200 hover:shadow-md"
                      >
                        <div className="text-3xl font-bold text-orange-600 mb-2 group-hover:scale-110 transition-transform duration-200">
                          {analyticsData.performanceMetrics?.scoreDistribution?.yellow || 0}
                        </div>
                        <div className="text-sm text-gray-600 group-hover:text-gray-900">Average Performers</div>
                        <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">Click to view details</div>
                      </button>
                      <button 
                        onClick={() => handlePerformanceClick('needs-attention')}
                        className="text-center group hover:bg-orange-50 rounded-2xl p-4 transition-all duration-200 hover:shadow-md"
                      >
                        <div className="text-3xl font-bold text-[#FF3B30] mb-2 group-hover:scale-110 transition-transform duration-200">
                          {analyticsData.performanceMetrics?.scoreDistribution?.red || 0}
                        </div>
                        <div className="text-sm text-gray-600 group-hover:text-gray-900">Needs Attention</div>
                        <div className="text-xs text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">Click to view details</div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Top Performers */}
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                    <h2 className="text-2xl font-bold text-gray-900">Top Performers</h2>
                  </div>
                  <div className="p-8">
                    {analyticsData.performanceMetrics?.topPerformers && analyticsData.performanceMetrics.topPerformers.length > 0 ? (
                      <div className="space-y-4">
                        {analyticsData.performanceMetrics.topPerformers.map((performer, index) => (
                          <div key={performer.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#34C759] to-[#30D158] rounded-2xl flex items-center justify-center shadow-sm">
                                  <span className="text-white font-bold text-lg">{index + 1}</span>
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-gray-900">{performer.name}</h3>
                                  <p className="text-gray-600 text-sm">Completion Rate: {performer.completionRate}%</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-[#34C759]">{performer.averageScore}%</div>
                                <div className="text-sm text-gray-600">Average Score</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-600">No top performers data available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-8">
                {/* Quick Navigation */}
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-orange-50 px-6 py-4 border-b-2 border-orange-200">
                    <h3 className="text-lg font-bold text-gray-900">Analytics Sections</h3>
                  </div>
                  <div className="p-6 space-y-3">
                    <Link
                      href="/analytics/engagement"
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm block"
                    >
                      Engagement Analytics
                    </Link>
                    <Link
                      href="/analytics/progress"
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm block"
                    >
                      Progress Reports
                    </Link>
                    <Link
                      href="/analytics/risk"
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm block"
                    >
                      Risk Analysis
                    </Link>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-orange-50 px-6 py-4 border-b-2 border-orange-200">
                    <h3 className="text-lg font-bold text-gray-900">Summary</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Active Clients</span>
                      <span className="font-bold text-gray-900">{analyticsData.clientStats?.active || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">At Risk</span>
                      <span className="font-bold text-gray-900">{analyticsData.clientStats?.atRisk || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">New This Month</span>
                      <span className="font-bold text-gray-900">{analyticsData.clientStats?.newThisMonth || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Completion Rate</span>
                      <span className="font-bold text-gray-900">{analyticsData.clientStats?.completionRate || 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Areas of Concern */}
            {(analyticsData.areasOfConcern?.groupLevel?.length > 0 || analyticsData.areasOfConcern?.individual?.length > 0) && (
              <div className="mt-8 space-y-6">
                {/* Group Level Concerns */}
                {analyticsData.areasOfConcern?.groupLevel && analyticsData.areasOfConcern.groupLevel.length > 0 && (
                  <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                      <h2 className="text-2xl font-bold text-gray-900">Group-Level Areas of Concern</h2>
                      <p className="text-gray-600 mt-1 text-sm">Issues affecting multiple clients that may need systemic attention</p>
                    </div>
                    <div className="p-8">
                      <div className="space-y-4">
                        {analyticsData.areasOfConcern.groupLevel.map((concern: any, index: number) => (
                          <div key={index} className={`border-l-4 rounded-r-xl p-5 ${
                            concern.severity === 'high' ? 'border-red-500 bg-red-50' :
                            concern.severity === 'medium' ? 'border-orange-500 bg-orange-50' :
                            'border-yellow-500 bg-yellow-50'
                          }`}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h3 className="text-lg font-bold text-gray-900">{concern.category}</h3>
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    concern.severity === 'high' ? 'bg-red-200 text-red-800' :
                                    concern.severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                                    'bg-yellow-200 text-yellow-800'
                                  }`}>
                                    {concern.severity.toUpperCase()}
                                  </span>
                                </div>
                                <p className="text-gray-700 mb-2">{concern.description}</p>
                                <p className="text-sm text-gray-600 italic">💡 {concern.recommendation}</p>
                              </div>
                              <div className="ml-4 text-right">
                                <div className="text-2xl font-bold text-gray-900">{concern.affectedClients}</div>
                                <div className="text-xs text-gray-600">Affected</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Individual Client Concerns */}
                {analyticsData.areasOfConcern?.individual && analyticsData.areasOfConcern.individual.length > 0 && (
                  <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                      <h2 className="text-2xl font-bold text-gray-900">Individual Client Concerns</h2>
                      <p className="text-gray-600 mt-1 text-sm">Clients who may need individual attention</p>
                    </div>
                    <div className="p-8">
                      <div className="space-y-6">
                        {analyticsData.areasOfConcern.individual.map((client: any) => (
                          <div key={client.clientId} className="border border-gray-200 rounded-2xl p-6 bg-gray-50 hover:shadow-lg transition-all duration-200">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h3 className="text-xl font-bold text-gray-900">{client.clientName}</h3>
                                <p className="text-sm text-gray-600">Client ID: {client.clientId}</p>
                              </div>
                              <Link
                                href={`/clients/${client.clientId}`}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-medium transition-all duration-200 shadow-sm"
                              >
                                View Profile
                              </Link>
                            </div>
                            <div className="space-y-3">
                              {client.concerns.map((concern: any, concernIndex: number) => (
                                <div key={concernIndex} className={`border-l-4 rounded-r-lg p-4 bg-white ${
                                  concern.severity === 'high' ? 'border-red-500' :
                                  concern.severity === 'medium' ? 'border-orange-500' :
                                  'border-yellow-500'
                                }`}>
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <span className="font-semibold text-gray-900">{concern.category}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                          concern.severity === 'high' ? 'bg-red-100 text-red-700' :
                                          concern.severity === 'medium' ? 'bg-orange-100 text-orange-700' :
                                          'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {concern.severity.toUpperCase()}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 mb-2">{concern.description}</p>
                                      <p className="text-xs text-gray-600 italic">💡 {concern.recommendation}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Details Modal */}
      {showPerformanceModal && selectedPerformanceType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  {getPerformanceTitle(selectedPerformanceType)}
                </h2>
                <button
                  onClick={() => setShowPerformanceModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
              {getPerformanceClients(selectedPerformanceType).length > 0 ? (
                <div className="space-y-4">
                  {getPerformanceClients(selectedPerformanceType).map((client, index) => (
                    <div key={client.id} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 bg-gradient-to-br ${getPerformanceColor(selectedPerformanceType).replace('text-', 'from-').replace('-600', '-500')} to-${selectedPerformanceType === 'high' ? 'emerald' : selectedPerformanceType === 'average' ? 'yellow' : 'red'}-600 rounded-xl flex items-center justify-center shadow-lg`}>
                            <span className="text-white font-bold text-lg">{index + 1}</span>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{client.name}</h3>
                            <p className="text-gray-600">{client.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-bold ${getPerformanceColor(selectedPerformanceType)}`}>
                            {client.averageScore}%
                          </div>
                          <div className="text-sm text-gray-500">Average Score</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="text-sm text-gray-500 mb-1">Completion Rate</div>
                          <div className="text-lg font-bold text-gray-900">{client.completionRate}%</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="text-sm text-gray-500 mb-1">Status</div>
                          <div className={`text-lg font-bold ${client.status === 'active' ? 'text-[#34C759]' : client.status === 'at-risk' ? 'text-[#FF3B30]' : 'text-gray-600'}`}>
                            {client.status ? client.status.charAt(0).toUpperCase() + client.status.slice(1) : 'Unknown'}
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="text-sm text-gray-500 mb-1">Last Activity</div>
                          <div className="text-lg font-bold text-gray-900">
                            {client.lastCheckIn ? new Date(client.lastCheckIn).toLocaleDateString() : 'Never'}
                          </div>
                        </div>
                      </div>
                      
                      {client.goals && client.goals.length > 0 && (
                        <div className="mt-4">
                          <div className="text-sm text-gray-500 mb-2">Goals</div>
                          <div className="flex flex-wrap gap-2">
                            {client.goals.map((goal, goalIndex) => (
                              <span key={goalIndex} className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full border border-orange-200">
                                {goal}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-4 flex space-x-3">
                        <Link
                          href={`/clients/${client.id}`}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 shadow-sm"
                        >
                          View Profile
                        </Link>
                        <button className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 shadow-sm">
                          Send Message
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg mb-4">No {getPerformanceTitle(selectedPerformanceType).toLowerCase()} found</p>
                  <p className="text-gray-400">All clients are performing well in this category.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </RoleProtected>
  );
} 