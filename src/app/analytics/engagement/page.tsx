'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RoleProtected } from '@/components/ProtectedRoute';

interface EngagementMetrics {
  totalClients: number;
  activeClients: number;
  averageEngagementScore: number;
  engagementTrend: 'improving' | 'stable' | 'declining';
  retentionRate: number;
  churnRate: number;
  averageSessionDuration: number;
  responseRate: number;
  topEngagedClients: Array<{
    clientId: string;
    clientName: string;
    engagementScore: number;
    lastActivity: string;
  }>;
  lowEngagedClients: Array<{
    clientId: string;
    clientName: string;
    engagementScore: number;
    lastActivity: string;
  }>;
  engagementByCategory: Array<{
    category: string;
    averageScore: number;
    clientCount: number;
  }>;
  communicationEffectiveness: {
    emailOpenRate: number;
    checkInResponseRate: number;
    messageResponseTime: number;
    preferredChannels: Array<{
      channel: string;
      usage: number;
      effectiveness: number;
    }>;
  };
  activityPatterns: Array<{
    dayOfWeek: string;
    averageActivity: number;
    peakHours: string[];
  }>;
  retentionInsights: Array<{
    insight: string;
    impact: 'high' | 'medium' | 'low';
    recommendation: string;
  }>;
}

interface ClientEngagement {
  clientId: string;
  clientName: string;
  engagementScore: number;
  lastActivity: string;
  checkInStreak: number;
  totalCheckIns: number;
  averageResponseTime: number;
  preferredChannels: string[];
  engagementHistory: Array<{
    date: string;
    activity: string;
    score: number;
  }>;
  communicationPreferences: {
    email: boolean;
    sms: boolean;
    pushNotifications: boolean;
    preferredTime: string;
  };
  retentionRisk: 'low' | 'medium' | 'high';
  nextBestAction: string;
}

export default function EngagementMetricsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [engagementData, setEngagementData] = useState<ClientEngagement[]>([]); // Changed to ClientEngagement[]
  const [timeRange, setTimeRange] = useState('30d');
  const [category, setCategory] = useState('all'); // Changed from selectedCategory
  const [sortBy, setSortBy] = useState<'engagement' | 'name' | 'recent'>('engagement');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEngagementData();
  }, [timeRange]);

  const fetchEngagementData = async () => {
    try {
      setIsLoading(true);
      // Get coach ID from user context or use a default for testing
      const coachId = 'BYAUh1d6PwanHhIUhISsmZtgt0B2'; // This should come from auth context
      
      const response = await fetch(`/api/analytics/engagement?timeRange=${timeRange}&coachId=${coachId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEngagementData(data.clientEngagement || []); // Changed to setEngagementData
        } else {
          console.error('Failed to fetch engagement data:', data.message);
          setEngagementData([]); // Changed to setEngagementData
        }
      } else {
        console.error('Failed to fetch engagement data');
        setEngagementData([]); // Changed to setEngagementData
      }
    } catch (error) {
      console.error('Error fetching engagement data:', error);
      setEngagementData([]); // Changed to setEngagementData
    } finally {
      setIsLoading(false);
    }
  };

  const getEngagementColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEngagementBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-800 bg-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '↗️';
      case 'declining': return '↘️';
      case 'stable': return '→';
      default: return '→';
    }
  };

  const filteredClients = engagementData.filter(client => { // Changed to filteredClients
    const matchesCategory = category === 'all' || 
      client.preferredChannels.includes(category); // Changed to category
    const matchesSearch = client.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedData = [...filteredClients].sort((a, b) => { // Changed to sortedData
    switch (sortBy) {
      case 'engagement':
        return b.engagementScore - a.engagementScore;
      case 'name':
        return a.clientName.localeCompare(b.clientName);
      case 'recent':
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      default:
        return 0;
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-300 rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Modern Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Engagement Analytics
                </h1>
                <p className="text-gray-600 mt-2 text-lg">Track client engagement, communication effectiveness, and retention patterns</p>
              </div>
              <div className="flex items-center space-x-3">
                <Link
                  href="/analytics"
                  className="text-gray-700 hover:text-gray-900 font-medium px-6 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
                >
                  ← Back to Analytics
                </Link>
                <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  Export Report
                </button>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Filters & Search</h2>
            </div>
            <div className="p-8">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="1y">Last Year</option>
                </select>
                
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                >
                  <option value="all">All Categories</option>
                  <option value="health">Health</option>
                  <option value="fitness">Fitness</option>
                  <option value="nutrition">Nutrition</option>
                  <option value="wellness">Wellness</option>
                </select>
                
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                >
                  <option value="engagement">Sort by Engagement</option>
                  <option value="activity">Sort by Activity</option>
                  <option value="score">Sort by Score</option>
                </select>
                
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Client Engagement Cards */}
              {filteredClients.map((client) => (
                <div key={client.clientId} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-2xl">
                            {client.clientName.charAt(0)}{client.clientName.charAt(1)}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900">{client.clientName}</h3>
                          <p className="text-gray-600">Engagement Score: {client.engagementScore || 0}%</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${getEngagementColor(client.engagementScore || 0)}`}>
                          {client.engagementScore || 0}% Engaged
                        </span>
                        {client.engagementScore < 30 && (
                          <span className="px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800">
                            high risk
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="text-2xl font-bold text-blue-600 mb-1">{client.checkInStreak || 0}</div>
                        <div className="text-sm text-gray-600">Check-in Streak</div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                        <div className="text-2xl font-bold text-green-600 mb-1">{client.totalCheckIns || 0}</div>
                        <div className="text-sm text-gray-600">Total Check-ins</div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                        <div className="text-2xl font-bold text-purple-600 mb-1">{client.averageResponseTime || '24h'}</div>
                        <div className="text-sm text-gray-600">Avg Response Time</div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border border-orange-100">
                        <div className="text-2xl font-bold text-orange-600 mb-1">
                          {client.lastActivity ? new Date(client.lastActivity).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">Last Activity</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Communication Preferences */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-900">Communication Preferences</h4>
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded-full ${client.communicationPreferences?.email ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <span className="text-gray-700">Email</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded-full ${client.communicationPreferences?.sms ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                            <span className="text-gray-700">SMS</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Preferred time: {client.communicationPreferences?.preferredTime || '9:00 AM'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Recent Activity */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-gray-900">Recent Activity</h4>
                        <div className="space-y-2">
                          {client.engagementHistory && client.engagementHistory.length > 0 ? (
                            client.engagementHistory.map((activity, index) => (
                              <div key={index} className="flex items-center space-x-3 text-sm text-gray-600">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span>{activity.activity}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-500 text-sm">No recent activity</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Next Best Action */}
                    <div className="mt-8 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border border-yellow-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900">Next Best Action</h5>
                          <p className="text-gray-700 text-sm">
                            {client.engagementScore < 30 
                              ? 'Schedule intervention call to re-engage client'
                              : 'Send personalized check-in message'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="mt-6 flex space-x-4">
                      <Link
                        href={`/clients/${client.clientId}`}
                        className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        View Full Profile →
                      </Link>
                      <button className="text-green-600 hover:text-green-800 font-medium transition-colors">
                        Send Message
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 hover:shadow-lg transition-all duration-200 cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Send Engagement Campaign</h4>
                        <p className="text-sm text-gray-600">Re-engage low-activity clients</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 hover:shadow-lg transition-all duration-200 cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Schedule Retention Calls</h4>
                        <p className="text-sm text-gray-600">Reach out to at-risk clients</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 hover:shadow-lg transition-all duration-200 cursor-pointer">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Generate Engagement Report</h4>
                        <p className="text-sm text-gray-600">Export detailed analysis</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement Summary */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Engagement Summary</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total Clients</span>
                    <span className="font-bold text-gray-900">{engagementData.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">High Engagement</span>
                    <span className="font-bold text-green-600">
                      {engagementData.filter(c => (c.engagementScore || 0) >= 70).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">At Risk</span>
                    <span className="font-bold text-red-600">
                      {engagementData.filter(c => (c.engagementScore || 0) < 30).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Avg Engagement</span>
                    <span className="font-bold text-gray-900">
                      {engagementData.length > 0 
                        ? Math.round(engagementData.reduce((sum, c) => sum + (c.engagementScore || 0), 0) / engagementData.length)
                        : 0}%
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