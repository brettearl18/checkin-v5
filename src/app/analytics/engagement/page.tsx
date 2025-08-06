'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  const [engagementData, setEngagementData] = useState<EngagementMetrics | null>(null);
  const [clientEngagement, setClientEngagement] = useState<ClientEngagement[]>([]);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'engagement' | 'name' | 'recent'>('engagement');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEngagementData();
  }, [timeRange]);

  const fetchEngagementData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/analytics/engagement?timeRange=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setEngagementData(data.metrics || null);
        setClientEngagement(data.clientEngagement || []);
      } else {
        console.error('Failed to fetch engagement data');
        setMockData();
      }
    } catch (error) {
      console.error('Error fetching engagement data:', error);
      setMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const setMockData = () => {
    const mockMetrics: EngagementMetrics = {
      totalClients: 24,
      activeClients: 18,
      averageEngagementScore: 72,
      engagementTrend: 'improving',
      retentionRate: 85,
      churnRate: 15,
      averageSessionDuration: 12.5,
      responseRate: 78,
      topEngagedClients: [
        { clientId: '1', clientName: 'Sarah Johnson', engagementScore: 94, lastActivity: '2024-01-15' },
        { clientId: '2', clientName: 'Mike Chen', engagementScore: 91, lastActivity: '2024-01-14' },
        { clientId: '3', clientName: 'Emma Davis', engagementScore: 88, lastActivity: '2024-01-13' }
      ],
      lowEngagedClients: [
        { clientId: '4', clientName: 'Alex Thompson', engagementScore: 35, lastActivity: '2024-01-08' },
        { clientId: '5', clientName: 'Jordan Lee', engagementScore: 42, lastActivity: '2024-01-10' },
        { clientId: '6', clientName: 'Lisa Wang', engagementScore: 28, lastActivity: '2024-01-05' }
      ],
      engagementByCategory: [
        { category: 'Fitness', averageScore: 78, clientCount: 8 },
        { category: 'Nutrition', averageScore: 72, clientCount: 6 },
        { category: 'Wellness', averageScore: 68, clientCount: 4 },
        { category: 'Weight Loss', averageScore: 75, clientCount: 6 }
      ],
      communicationEffectiveness: {
        emailOpenRate: 68,
        checkInResponseRate: 82,
        messageResponseTime: 4.2,
        preferredChannels: [
          { channel: 'Email', usage: 45, effectiveness: 78 },
          { channel: 'SMS', usage: 30, effectiveness: 85 },
          { channel: 'Push Notifications', usage: 25, effectiveness: 72 }
        ]
      },
      activityPatterns: [
        { dayOfWeek: 'Monday', averageActivity: 85, peakHours: ['9:00 AM', '6:00 PM'] },
        { dayOfWeek: 'Tuesday', averageActivity: 78, peakHours: ['8:00 AM', '5:00 PM'] },
        { dayOfWeek: 'Wednesday', averageActivity: 82, peakHours: ['10:00 AM', '7:00 PM'] },
        { dayOfWeek: 'Thursday', averageActivity: 75, peakHours: ['9:00 AM', '6:00 PM'] },
        { dayOfWeek: 'Friday', averageActivity: 70, peakHours: ['8:00 AM', '5:00 PM'] },
        { dayOfWeek: 'Saturday', averageActivity: 45, peakHours: ['10:00 AM', '2:00 PM'] },
        { dayOfWeek: 'Sunday', averageActivity: 35, peakHours: ['11:00 AM', '3:00 PM'] }
      ],
      retentionInsights: [
        {
          insight: 'Clients who respond within 24 hours have 40% higher retention',
          impact: 'high',
          recommendation: 'Implement automated follow-up for non-responders'
        },
        {
          insight: 'Weekly check-ins improve engagement by 25%',
          impact: 'medium',
          recommendation: 'Increase check-in frequency for low-engaged clients'
        },
        {
          insight: 'Personalized messages increase response rates by 35%',
          impact: 'high',
          recommendation: 'Use client-specific messaging templates'
        }
      ]
    };

    const mockClientEngagement: ClientEngagement[] = [
      {
        clientId: '1',
        clientName: 'Sarah Johnson',
        engagementScore: 94,
        lastActivity: '2024-01-15',
        checkInStreak: 12,
        totalCheckIns: 45,
        averageResponseTime: 2.1,
        preferredChannels: ['Email', 'SMS'],
        engagementHistory: [
          { date: '2024-01-15', activity: 'Completed check-in', score: 95 },
          { date: '2024-01-14', activity: 'Viewed progress report', score: 92 },
          { date: '2024-01-13', activity: 'Completed check-in', score: 88 }
        ],
        communicationPreferences: {
          email: true,
          sms: true,
          pushNotifications: false,
          preferredTime: '9:00 AM'
        },
        retentionRisk: 'low',
        nextBestAction: 'Continue current engagement strategy'
      },
      {
        clientId: '2',
        clientName: 'Mike Chen',
        engagementScore: 91,
        lastActivity: '2024-01-14',
        checkInStreak: 8,
        totalCheckIns: 32,
        averageResponseTime: 3.5,
        preferredChannels: ['SMS', 'Push Notifications'],
        engagementHistory: [
          { date: '2024-01-14', activity: 'Completed check-in', score: 94 },
          { date: '2024-01-13', activity: 'Updated goals', score: 89 },
          { date: '2024-01-12', activity: 'Completed check-in', score: 87 }
        ],
        communicationPreferences: {
          email: false,
          sms: true,
          pushNotifications: true,
          preferredTime: '7:00 AM'
        },
        retentionRisk: 'low',
        nextBestAction: 'Send motivational message'
      },
      {
        clientId: '4',
        clientName: 'Alex Thompson',
        engagementScore: 35,
        lastActivity: '2024-01-08',
        checkInStreak: 0,
        totalCheckIns: 8,
        averageResponseTime: 24.5,
        preferredChannels: ['Email'],
        engagementHistory: [
          { date: '2024-01-08', activity: 'Missed check-in', score: 30 },
          { date: '2024-01-05', activity: 'Completed check-in', score: 45 },
          { date: '2024-01-02', activity: 'Missed check-in', score: 25 }
        ],
        communicationPreferences: {
          email: true,
          sms: false,
          pushNotifications: false,
          preferredTime: '6:00 PM'
        },
        retentionRisk: 'high',
        nextBestAction: 'Schedule intervention call'
      }
    ];

    setEngagementData(mockMetrics);
    setClientEngagement(mockClientEngagement);
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
      default: return 'text-gray-600 bg-gray-100';
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

  const filteredData = clientEngagement.filter(client => {
    const matchesCategory = selectedCategory === 'all' || 
      client.preferredChannels.includes(selectedCategory);
    const matchesSearch = client.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedData = [...filteredData].sort((a, b) => {
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Engagement Metrics</h1>
            <p className="text-gray-600">Track client engagement, communication effectiveness, and retention patterns</p>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            <Link 
              href="/analytics"
              className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back to Analytics
            </Link>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Export Report
            </button>
          </div>
        </div>

        {/* Engagement Metrics Overview */}
        {engagementData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Engagement</p>
                  <p className="text-2xl font-bold text-gray-900">{engagementData.averageEngagementScore}%</p>
                  <p className="text-xs text-gray-500">Overall engagement score</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-blue-600 text-xl">📊</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Retention Rate</p>
                  <p className="text-2xl font-bold text-green-600">{engagementData.retentionRate}%</p>
                  <p className="text-xs text-gray-500">Client retention</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-green-600 text-xl">📈</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Response Rate</p>
                  <p className="text-2xl font-bold text-purple-600">{engagementData.responseRate}%</p>
                  <p className="text-xs text-gray-500">Check-in responses</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <span className="text-purple-600 text-xl">💬</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Session</p>
                  <p className="text-2xl font-bold text-orange-600">{engagementData.averageSessionDuration}m</p>
                  <p className="text-xs text-gray-500">Session duration</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <span className="text-orange-600 text-xl">⏱️</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
              </select>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="Email">Email</option>
                <option value="SMS">SMS</option>
                <option value="Push Notifications">Push Notifications</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="engagement">Sort by Engagement</option>
                <option value="name">Sort by Name</option>
                <option value="recent">Sort by Recent Activity</option>
              </select>
            </div>
            
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Client Engagement */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {sortedData.map((client) => (
                <div key={client.clientId} className="bg-white rounded-lg shadow-sm border">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{client.clientName}</h3>
                        <p className="text-sm text-gray-600">Engagement Score: {client.engagementScore}%</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEngagementBgColor(client.engagementScore)} ${getEngagementColor(client.engagementScore)}`}>
                          {client.engagementScore}% Engaged
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(client.retentionRisk)}`}>
                          {client.retentionRisk} risk
                        </span>
                      </div>
                    </div>

                    {/* Engagement Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-lg font-bold text-blue-600">{client.checkInStreak}</div>
                        <div className="text-xs text-gray-600">Check-in Streak</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-lg font-bold text-green-600">{client.totalCheckIns}</div>
                        <div className="text-xs text-gray-600">Total Check-ins</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-600">{client.averageResponseTime}h</div>
                        <div className="text-xs text-gray-600">Avg Response Time</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <div className="text-lg font-bold text-orange-600">{client.lastActivity}</div>
                        <div className="text-xs text-gray-600">Last Activity</div>
                      </div>
                    </div>

                    {/* Communication Preferences */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Communication Preferences</h4>
                      <div className="flex flex-wrap gap-2">
                        {client.preferredChannels.map((channel) => (
                          <span key={channel} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {channel}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        Preferred time: {client.communicationPreferences.preferredTime}
                      </div>
                    </div>

                    {/* Recent Engagement History */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Activity</h4>
                      <div className="space-y-2">
                        {client.engagementHistory.slice(0, 3).map((activity, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-3">
                              <span className="text-gray-500">{activity.date}</span>
                              <span className="text-gray-900">{activity.activity}</span>
                            </div>
                            <span className={`font-medium ${getEngagementColor(activity.score)}`}>
                              {activity.score}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Next Best Action */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Next Best Action</h4>
                      <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg">
                        💡 {client.nextBestAction}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <Link 
                        href={`/clients/${client.clientId}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Full Profile →
                      </Link>
                      <button className="text-green-600 hover:text-green-800 text-sm font-medium">
                        Send Message
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {sortedData.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">📊</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No engagement data found</h3>
                  <p className="text-gray-500">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Communication Effectiveness */}
            {engagementData && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">💬 Communication Effectiveness</h3>
                <div className="space-y-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-lg font-bold text-blue-600">{engagementData.communicationEffectiveness.emailOpenRate}%</div>
                    <div className="text-sm text-gray-600">Email Open Rate</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">{engagementData.communicationEffectiveness.checkInResponseRate}%</div>
                    <div className="text-sm text-gray-600">Check-in Response Rate</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-lg font-bold text-purple-600">{engagementData.communicationEffectiveness.messageResponseTime}h</div>
                    <div className="text-sm text-gray-600">Avg Response Time</div>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Preferred Channels</h4>
                  <div className="space-y-2">
                    {engagementData.communicationEffectiveness.preferredChannels.map((channel) => (
                      <div key={channel.channel} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700">{channel.channel}</span>
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-900">{channel.usage}% usage</div>
                          <div className="text-xs text-gray-500">{channel.effectiveness}% effective</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Activity Patterns */}
            {engagementData && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 Activity Patterns</h3>
                <div className="space-y-3">
                  {engagementData.activityPatterns.map((pattern) => (
                    <div key={pattern.dayOfWeek} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">{pattern.dayOfWeek}</span>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-900">{pattern.averageActivity}% activity</div>
                        <div className="text-xs text-gray-500">Peak: {pattern.peakHours.join(', ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Retention Insights */}
            {engagementData && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Retention Insights</h3>
                <div className="space-y-3">
                  {engagementData.retentionInsights.map((insight, index) => (
                    <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <span className="text-yellow-600">💡</span>
                        <div>
                          <p className="text-sm text-gray-700 mb-1">{insight.insight}</p>
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                              insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {insight.impact} impact
                            </span>
                            <span className="text-xs text-gray-500">{insight.recommendation}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full text-left p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3">📧</span>
                    <div>
                      <p className="text-sm font-medium text-blue-900">Send Engagement Campaign</p>
                      <p className="text-xs text-blue-700">Re-engage low-activity clients</p>
                    </div>
                  </div>
                </button>
                
                <button className="w-full text-left p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-3">📞</span>
                    <div>
                      <p className="text-sm font-medium text-green-900">Schedule Retention Calls</p>
                      <p className="text-xs text-green-700">Reach out to at-risk clients</p>
                    </div>
                  </div>
                </button>
                
                <button className="w-full text-left p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                  <div className="flex items-center">
                    <span className="text-purple-600 mr-3">📊</span>
                    <div>
                      <p className="text-sm font-medium text-purple-900">Generate Engagement Report</p>
                      <p className="text-xs text-purple-700">Export detailed analysis</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 