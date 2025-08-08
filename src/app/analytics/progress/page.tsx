'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RoleProtected } from '@/components/ProtectedRoute';

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
      // Get coach ID from user context or use a default for testing
      const coachId = 'BYAUh1d6PwanHhIUhISsmZtgt0B2'; // This should come from auth context
      
      const response = await fetch(`/api/analytics/progress?timeRange=${timeRange}&coachId=${coachId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProgressData(data.progressReports || []);
          setMetrics(data.metrics || null);
        } else {
          console.error('Failed to fetch progress data:', data.message);
          setProgressData([]);
          setMetrics(null);
        }
      } else {
        console.error('Failed to fetch progress data');
        setProgressData([]);
        setMetrics(null);
      }
    } catch (error) {
      console.error('Error fetching progress data:', error);
      setProgressData([]);
      setMetrics(null);
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
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Modern Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Progress Reports
                </h1>
                <p className="text-gray-600 mt-2 text-lg">Track client progress, goal achievement, and performance trends</p>
              </div>
              <div className="flex items-center space-x-3">
                <Link
                  href="/analytics"
                  className="text-gray-700 hover:text-gray-900 font-medium px-6 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
                >
                  ← Back to Analytics
                </Link>
                <button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                  Export Report
                </button>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Filters & Search</h2>
            </div>
            <div className="p-8">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-sm"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="1y">Last Year</option>
                </select>
                
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-sm"
                >
                  <option value="all">All Clients</option>
                  {progressData.map((client) => (
                    <option key={client.clientId} value={client.clientId}>
                      {client.clientName}
                    </option>
                  ))}
                </select>
                
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-sm"
                >
                  <option value="progress">Sort by Progress</option>
                  <option value="name">Sort by Name</option>
                  <option value="recent">Sort by Recent</option>
                </select>
                
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Progress Metrics Overview */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-500">Total Clients</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">{metrics.totalClients}</div>
                  <div className="text-sm text-gray-500 mt-1">Active clients</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-500">Avg Progress</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">{metrics.averageOverallProgress}%</div>
                  <div className="text-sm text-gray-500 mt-1">Overall progress</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-500">On Track</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">{metrics.clientsOnTrack}</div>
                  <div className="text-sm text-gray-500 mt-1">Clients on track</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-red-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-500">Needs Attention</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">{metrics.clientsBehind}</div>
                  <div className="text-sm text-gray-500 mt-1">Behind schedule</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Progress Reports */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-900">Progress Reports</h2>
                </div>
                <div className="p-8">
                  {isLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                      <p className="text-gray-500 text-lg">Loading progress data...</p>
                    </div>
                  ) : progressData.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-lg mb-4">No progress data available</p>
                      <p className="text-gray-400 text-sm">Progress reports will appear here as clients engage with check-ins</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {progressData.map((report) => (
                        <div key={report.clientId} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-200 hover:border-gray-300">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-white font-bold text-lg">
                                  {report.clientName.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-gray-900">{report.clientName}</h3>
                                <p className="text-gray-600">Overall Progress: {report.overallProgress}%</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`px-4 py-2 text-sm font-medium rounded-full ${getProgressColor(report.overallProgress)}`}>
                                {report.overallProgress}%
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="text-2xl font-bold text-blue-600 mb-1">{report.performanceMetrics.averageScore}%</div>
                              <div className="text-sm text-gray-600">Average Score</div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="text-2xl font-bold text-green-600 mb-1">{report.performanceMetrics.completionRate}%</div>
                              <div className="text-sm text-gray-600">Completion Rate</div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="text-2xl font-bold text-purple-600 mb-1">{report.performanceMetrics.checkInStreak}</div>
                              <div className="text-sm text-gray-600">Check-in Streak</div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <h4 className="text-lg font-semibold text-gray-900">Goal Progress</h4>
                            <div className="space-y-3">
                              {report.goalProgress.map((goal) => (
                                <div key={goal.goalId} className="bg-white rounded-lg p-4 border border-gray-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-medium text-gray-900">{goal.title}</h5>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(goal.status)}`}>
                                      {goal.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div 
                                        className={`h-2 rounded-full ${getProgressBgColor(goal.progress)}`}
                                        style={{ width: `${goal.progress}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-900">{goal.progress}%</span>
                                  </div>
                                </div>
                              ))}
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
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-6 space-y-3">
                  <button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                    Generate Progress Report
                  </button>
                  <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                    Schedule Progress Review
                  </button>
                  <button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                    Set New Goals
                  </button>
                </div>
              </div>

              {/* Progress Summary */}
              {metrics && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Progress Summary</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Completed Goals</span>
                      <span className="font-bold text-green-600">{metrics.completedGoals}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Overdue Goals</span>
                      <span className="font-bold text-red-600">{metrics.overdueGoals}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Progress Trend</span>
                      <span className="font-bold text-gray-900 capitalize">{metrics.progressTrend}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 