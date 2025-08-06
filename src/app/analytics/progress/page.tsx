'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'at-risk';
  goals?: Array<{
    id: string;
    title: string;
    progress: number;
    targetDate: string;
    category: string;
  }>;
  averageScore?: number;
  completionRate?: number;
  lastCheckIn?: string;
}

interface ProgressReport {
  clientId: string;
  clientName: string;
  overallProgress: number;
  goalProgress: Array<{
    goalId: string;
    title: string;
    progress: number;
    targetDate: string;
    status: 'on-track' | 'behind' | 'completed' | 'overdue';
    trend: 'improving' | 'stable' | 'declining';
  }>;
  performanceMetrics: {
    averageScore: number;
    completionRate: number;
    checkInStreak: number;
    totalCheckIns: number;
  };
  recentActivity: Array<{
    date: string;
    action: string;
    score?: number;
    notes?: string;
  }>;
  recommendations: string[];
}

interface ProgressMetrics {
  totalClients: number;
  activeClients: number;
  averageOverallProgress: number;
  clientsOnTrack: number;
  clientsBehind: number;
  completedGoals: number;
  overdueGoals: number;
  progressTrend: 'improving' | 'stable' | 'declining';
  topPerformers: Array<{ clientId: string; clientName: string; progress: number }>;
  needsAttention: Array<{ clientId: string; clientName: string; progress: number }>;
}

export default function ProgressReportsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [progressData, setProgressData] = useState<ProgressReport[]>([]);
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('30d');
  const [sortBy, setSortBy] = useState<'progress' | 'name' | 'recent'>('progress');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProgressData();
  }, [timeRange]);

  const fetchProgressData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/analytics/progress?timeRange=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setProgressData(data.progressReports || []);
        setMetrics(data.metrics || null);
      } else {
        console.error('Failed to fetch progress data');
        setMockData();
      }
    } catch (error) {
      console.error('Error fetching progress data:', error);
      setMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const setMockData = () => {
    const mockProgressReports: ProgressReport[] = [
      {
        clientId: '1',
        clientName: 'Sarah Johnson',
        overallProgress: 78,
        goalProgress: [
          {
            goalId: 'goal-1',
            title: 'Lose 20 pounds',
            progress: 65,
            targetDate: '2024-06-15',
            status: 'on-track',
            trend: 'improving'
          },
          {
            goalId: 'goal-2',
            title: 'Run a 5K',
            progress: 80,
            targetDate: '2024-05-01',
            status: 'on-track',
            trend: 'improving'
          },
          {
            goalId: 'goal-3',
            title: 'Reduce stress levels',
            progress: 90,
            targetDate: '2024-04-30',
            status: 'completed',
            trend: 'stable'
          }
        ],
        performanceMetrics: {
          averageScore: 82,
          completionRate: 95,
          checkInStreak: 12,
          totalCheckIns: 45
        },
        recentActivity: [
          { date: '2024-01-15', action: 'Completed weekly check-in', score: 85 },
          { date: '2024-01-14', action: 'Updated goal progress', notes: 'Weight loss on track' },
          { date: '2024-01-13', action: 'Completed weekly check-in', score: 78 }
        ],
        recommendations: ['Continue current exercise routine', 'Monitor stress levels']
      },
      {
        clientId: '2',
        clientName: 'Mike Chen',
        overallProgress: 92,
        goalProgress: [
          {
            goalId: 'goal-1',
            title: 'Build muscle mass',
            progress: 85,
            targetDate: '2024-07-01',
            status: 'on-track',
            trend: 'improving'
          },
          {
            goalId: 'goal-2',
            title: 'Improve sleep quality',
            progress: 70,
            targetDate: '2024-05-15',
            status: 'on-track',
            trend: 'improving'
          }
        ],
        performanceMetrics: {
          averageScore: 91,
          completionRate: 98,
          checkInStreak: 20,
          totalCheckIns: 52
        },
        recentActivity: [
          { date: '2024-01-15', action: 'Completed weekly check-in', score: 94 },
          { date: '2024-01-14', action: 'Achieved new PR', notes: 'Bench press increased' },
          { date: '2024-01-13', action: 'Completed weekly check-in', score: 88 }
        ],
        recommendations: ['Excellent progress, consider increasing intensity']
      },
      {
        clientId: '3',
        clientName: 'Emma Davis',
        overallProgress: 45,
        goalProgress: [
          {
            goalId: 'goal-1',
            title: 'Reduce stress levels',
            progress: 30,
            targetDate: '2024-06-30',
            status: 'behind',
            trend: 'declining'
          },
          {
            goalId: 'goal-2',
            title: 'Establish morning routine',
            progress: 20,
            targetDate: '2024-04-15',
            status: 'overdue',
            trend: 'declining'
          }
        ],
        performanceMetrics: {
          averageScore: 58,
          completionRate: 65,
          checkInStreak: 0,
          totalCheckIns: 22
        },
        recentActivity: [
          { date: '2024-01-10', action: 'Missed weekly check-in' },
          { date: '2024-01-08', action: 'Completed weekly check-in', score: 45 },
          { date: '2024-01-05', action: 'Missed weekly check-in' }
        ],
        recommendations: ['Schedule intervention call', 'Simplify goals', 'Increase support']
      }
    ];

    const mockMetrics: ProgressMetrics = {
      totalClients: 24,
      activeClients: 18,
      averageOverallProgress: 72,
      clientsOnTrack: 12,
      clientsBehind: 6,
      completedGoals: 8,
      overdueGoals: 3,
      progressTrend: 'improving',
      topPerformers: [
        { clientId: '2', clientName: 'Mike Chen', progress: 92 },
        { clientId: '1', clientName: 'Sarah Johnson', progress: 78 },
        { clientId: '4', clientName: 'David Wilson', progress: 75 }
      ],
      needsAttention: [
        { clientId: '3', clientName: 'Emma Davis', progress: 45 },
        { clientId: '5', clientName: 'Lisa Wang', progress: 52 },
        { clientId: '6', clientName: 'Alex Thompson', progress: 58 }
      ]
    };

    setProgressData(mockProgressReports);
    setMetrics(mockMetrics);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'text-green-600';
    if (progress >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressBgColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-100';
    if (progress >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track': return 'bg-green-100 text-green-800';
      case 'behind': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const filteredData = progressData.filter(client => {
    const matchesClient = selectedClient === 'all' || client.clientId === selectedClient;
    const matchesSearch = client.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClient && matchesSearch;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    switch (sortBy) {
      case 'progress':
        return b.overallProgress - a.overallProgress;
      case 'name':
        return a.clientName.localeCompare(b.clientName);
      case 'recent':
        const aRecent = a.recentActivity[0]?.date || '';
        const bRecent = b.recentActivity[0]?.date || '';
        return new Date(bRecent).getTime() - new Date(aRecent).getTime();
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Progress Reports</h1>
            <p className="text-gray-600">Track client progress, goal achievement, and performance trends</p>
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

        {/* Progress Metrics Overview */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Clients</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.activeClients}</p>
                  <p className="text-xs text-gray-500">of {metrics.totalClients} total</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-blue-600 text-xl">👥</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Progress</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.averageOverallProgress}%</p>
                  <p className="text-xs text-gray-500">Overall goal achievement</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-green-600 text-xl">📈</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">On Track</p>
                  <p className="text-2xl font-bold text-green-600">{metrics.clientsOnTrack}</p>
                  <p className="text-xs text-gray-500">Meeting goals</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-green-600 text-xl">✅</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Needs Attention</p>
                  <p className="text-2xl font-bold text-orange-600">{metrics.clientsBehind}</p>
                  <p className="text-xs text-gray-500">Behind on goals</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <span className="text-orange-600 text-xl">⚠️</span>
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
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="progress">Sort by Progress</option>
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
          {/* Main Progress Reports */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {sortedData.map((client) => (
                <div key={client.clientId} className="bg-white rounded-lg shadow-sm border">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{client.clientName}</h3>
                        <p className="text-sm text-gray-600">Overall Progress: {client.overallProgress}%</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getProgressBgColor(client.overallProgress)} ${getProgressColor(client.overallProgress)}`}>
                        {client.overallProgress}% Complete
                      </div>
                    </div>

                    {/* Goal Progress */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Goal Progress</h4>
                      <div className="space-y-3">
                        {client.goalProgress.map((goal) => (
                          <div key={goal.goalId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900">{goal.title}</span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(goal.status)}`}>
                                  {goal.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex-1 mr-4">
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full ${getProgressColor(goal.progress).replace('text-', 'bg-')}`}
                                      style={{ width: `${goal.progress}%` }}
                                    ></div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm text-gray-600">{goal.progress}%</span>
                                  <span className="text-sm">{getTrendIcon(goal.trend)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-lg font-bold text-blue-600">{client.performanceMetrics.averageScore}%</div>
                        <div className="text-xs text-gray-600">Avg Score</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-lg font-bold text-green-600">{client.performanceMetrics.completionRate}%</div>
                        <div className="text-xs text-gray-600">Completion Rate</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-600">{client.performanceMetrics.checkInStreak}</div>
                        <div className="text-xs text-gray-600">Check-in Streak</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <div className="text-lg font-bold text-orange-600">{client.performanceMetrics.totalCheckIns}</div>
                        <div className="text-xs text-gray-600">Total Check-ins</div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Activity</h4>
                      <div className="space-y-2">
                        {client.recentActivity.slice(0, 3).map((activity, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-3">
                              <span className="text-gray-500">{activity.date}</span>
                              <span className="text-gray-900">{activity.action}</span>
                              {activity.score && (
                                <span className="text-blue-600 font-medium">{activity.score}%</span>
                              )}
                            </div>
                            {activity.notes && (
                              <span className="text-gray-500 text-xs italic">{activity.notes}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendations */}
                    {client.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Recommendations</h4>
                        <div className="space-y-2">
                          {client.recommendations.map((rec, index) => (
                            <div key={index} className="flex items-start space-x-2 text-sm">
                              <span className="text-blue-600">💡</span>
                              <span className="text-gray-700">{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                        Schedule Check-in
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {sortedData.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">📊</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No progress data found</h3>
                  <p className="text-gray-500">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Top Performers */}
            {metrics && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 Top Performers</h3>
                <div className="space-y-3">
                  {metrics.topPerformers.map((performer, index) => (
                    <div key={performer.clientId} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">#{index + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{performer.clientName}</p>
                          <p className="text-xs text-gray-600">{performer.progress}% progress</p>
                        </div>
                      </div>
                      <Link 
                        href={`/clients/${performer.clientId}`}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Needs Attention */}
            {metrics && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Needs Attention</h3>
                <div className="space-y-3">
                  {metrics.needsAttention.map((client, index) => (
                    <div key={client.clientId} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">#{index + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{client.clientName}</p>
                          <p className="text-xs text-gray-600">{client.progress}% progress</p>
                        </div>
                      </div>
                      <Link 
                        href={`/clients/${client.clientId}`}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Intervene →
                      </Link>
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
                    <span className="text-blue-600 mr-3">📊</span>
                    <div>
                      <p className="text-sm font-medium text-blue-900">Generate Progress Report</p>
                      <p className="text-xs text-blue-700">Export detailed analysis</p>
                    </div>
                  </div>
                </button>
                
                <button className="w-full text-left p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-3">📞</span>
                    <div>
                      <p className="text-sm font-medium text-green-900">Schedule Progress Calls</p>
                      <p className="text-xs text-green-700">Reach out to clients</p>
                    </div>
                  </div>
                </button>
                
                <button className="w-full text-left p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                  <div className="flex items-center">
                    <span className="text-purple-600 mr-3">🎯</span>
                    <div>
                      <p className="text-sm font-medium text-purple-900">Update Goals</p>
                      <p className="text-xs text-purple-700">Adjust client objectives</p>
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