'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  
  const [analyticsData, setAnalyticsData] = useState({
    clientStats: {
      total: 11,
      active: 7,
      atRisk: 2,
      newThisMonth: 3,
      completionRate: 78.5
    },
    performanceMetrics: {
      overallAverage: 82.3,
      scoreDistribution: {
        green: 5,
        yellow: 3,
        red: 2
      },
      topPerformers: [
        { id: 'client-001', name: 'Sarah Johnson', averageScore: 94.2, completionRate: 95 },
        { id: 'client-002', name: 'Mike Chen', averageScore: 91.8, completionRate: 88 },
        { id: 'client-003', name: 'Emma Davis', averageScore: 89.5, completionRate: 92 }
      ],
      needsAttention: [
        { id: 'client-004', name: 'Alex Thompson', averageScore: 65.2, completionRate: 45 },
        { id: 'client-005', name: 'Jordan Lee', averageScore: 58.9, completionRate: 32 }
      ],
      trendData: [
        { date: '2024-01-01', averageScore: 78.2, activeClients: 6 },
        { date: '2024-01-08', averageScore: 79.1, activeClients: 7 },
        { date: '2024-01-15', averageScore: 81.5, activeClients: 7 },
        { date: '2024-01-22', averageScore: 82.3, activeClients: 7 }
      ]
    },
    formAnalytics: {
      totalForms: 8,
      completionRate: 78.5,
      averageResponseTime: 2.3,
      popularTemplates: [
        { name: 'Weekly Wellness Check-in', usage: 45, completionRate: 85 },
        { name: 'Fitness Progress Assessment', usage: 32, completionRate: 78 },
        { name: 'Nutrition & Hydration Tracker', usage: 28, completionRate: 72 }
      ]
    },
    questionAnalytics: {
      totalQuestions: 99,
      mostUsed: [
        { text: 'How would you rate your overall energy level this week?', usage: 67, effectiveness: 8.2 },
        { text: 'Did you meet your nutrition goals this week?', usage: 58, effectiveness: 7.8 },
        { text: 'How many days did you exercise this week?', usage: 52, effectiveness: 8.5 }
      ],
      weightedQuestions: 45
    },
    goalProgress: {
      overallProgress: 76.8,
      achievementRate: 68.2,
      trendingGoals: [
        { goal: 'Weight Loss', progress: 82, clients: 5 },
        { goal: 'Muscle Gain', progress: 71, clients: 3 },
        { goal: 'Stress Management', progress: 68, clients: 4 }
      ]
    }
  });

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        const response = await fetch(`/api/analytics/overview?timeRange=${timeRange}`);
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
  }, [timeRange]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreStatus = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Attention';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Analytics Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📊 Analytics Dashboard</h1>
              <p className="text-gray-600 mt-2">Comprehensive insights into client progress and coaching effectiveness</p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors">
                Export Report
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.clientStats.total}</p>
                <p className="text-xs text-green-600">+{analyticsData.clientStats.newThisMonth} this month</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Clients</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.clientStats.active}</p>
                <p className="text-xs text-gray-600">{analyticsData.clientStats.completionRate}% completion rate</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">At Risk</p>
                <p className="text-2xl font-bold text-gray-900">{analyticsData.clientStats.atRisk}</p>
                <p className="text-xs text-red-600">Needs attention</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Performance</p>
                <p className={`text-2xl font-bold ${getScoreColor(analyticsData.performanceMetrics.overallAverage)}`}>
                  {analyticsData.performanceMetrics.overallAverage}%
                </p>
                <p className="text-xs text-gray-600">{getScoreStatus(analyticsData.performanceMetrics.overallAverage)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Performance & Trends */}
          <div className="lg:col-span-2 space-y-8">
            {/* Performance Overview */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Performance Overview</h2>
                <Link href="/analytics/performance" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View Details →
                </Link>
              </div>
              
              {/* Score Distribution */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{analyticsData.performanceMetrics.scoreDistribution.green}</div>
                  <div className="text-sm text-gray-600">Green (80%+)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{analyticsData.performanceMetrics.scoreDistribution.yellow}</div>
                  <div className="text-sm text-gray-600">Yellow (60-79%)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{analyticsData.performanceMetrics.scoreDistribution.red}</div>
                  <div className="text-sm text-gray-600">Red (&lt;60%)</div>
                </div>
              </div>

              {/* Top Performers */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Top Performers</h3>
                <div className="space-y-2">
                  {analyticsData.performanceMetrics.topPerformers.map((client, index) => (
                    <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900 mr-2">#{index + 1}</span>
                        <span className="text-sm text-gray-700">{client.name}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`text-sm font-medium ${getScoreColor(client.averageScore)}`}>
                          {client.averageScore}%
                        </span>
                        <span className="text-xs text-gray-500">{client.completionRate}% completion</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Needs Attention */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Needs Attention</h3>
                <div className="space-y-2">
                  {analyticsData.performanceMetrics.needsAttention.map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <span className="text-sm text-gray-700">{client.name}</span>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-red-600">{client.averageScore}%</span>
                        <Link 
                          href={`/client/${client.id}`}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View Profile →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form Analytics */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Form Analytics</h2>
                <Link href="/analytics/forms" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View Details →
                </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{analyticsData.formAnalytics.totalForms}</div>
                  <div className="text-sm text-gray-600">Total Forms</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{analyticsData.formAnalytics.completionRate}%</div>
                  <div className="text-sm text-gray-600">Completion Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{analyticsData.formAnalytics.averageResponseTime}d</div>
                  <div className="text-sm text-gray-600">Avg Response Time</div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Popular Templates</h3>
                <div className="space-y-3">
                  {analyticsData.formAnalytics.popularTemplates.map((template, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900 mr-2">#{index + 1}</span>
                        <span className="text-sm text-gray-700">{template.name}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600">{template.usage} uses</span>
                        <span className="text-sm font-medium text-green-600">{template.completionRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Quick Actions & Insights */}
          <div className="space-y-8">
            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  href="/clients/new"
                  className="flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm font-medium text-blue-900">Add New Client</span>
                </Link>
                
                <Link
                  href="/check-ins/send"
                  className="flex items-center p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span className="text-sm font-medium text-green-900">Send Check-in</span>
                </Link>
                
                <Link
                  href="/templates"
                  className="flex items-center p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-purple-900">View Templates</span>
                </Link>
                
                <Link
                  href="/analytics/risk"
                  className="flex items-center p-3 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-sm font-medium text-red-900">Risk Analysis</span>
                </Link>
              </div>
            </div>

            {/* Question Analytics */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Question Insights</h2>
                <Link href="/analytics/questions" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View Details →
                </Link>
              </div>
              
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{analyticsData.questionAnalytics.totalQuestions}</div>
                  <div className="text-sm text-gray-600">Total Questions</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{analyticsData.questionAnalytics.weightedQuestions}</div>
                  <div className="text-sm text-gray-600">Weighted Questions</div>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Most Effective Questions</h3>
                <div className="space-y-2">
                  {analyticsData.questionAnalytics.mostUsed.slice(0, 3).map((question, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-700 mb-1 line-clamp-2">{question.text}</div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{question.usage} uses</span>
                        <span className="font-medium text-green-600">{question.effectiveness}/10 effectiveness</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Goal Progress */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Goal Progress</h2>
                <Link href="/analytics/progress" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View Details →
                </Link>
              </div>
              
              <div className="text-center p-4 bg-blue-50 rounded-lg mb-4">
                <div className="text-2xl font-bold text-blue-600">{analyticsData.goalProgress.overallProgress}%</div>
                <div className="text-sm text-gray-600">Overall Progress</div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Trending Goals</h3>
                <div className="space-y-3">
                  {analyticsData.goalProgress.trendingGoals.map((goal, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{goal.goal}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${goal.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500">{goal.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 