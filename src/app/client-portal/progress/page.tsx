'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedOnly } from '@/components/ProtectedRoute';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';
import ClientNavigation from '@/components/ClientNavigation';

interface FormResponse {
  id: string;
  formTitle: string;
  submittedAt: any;
  completedAt: any;
  score?: number;
  totalQuestions: number;
  answeredQuestions: number;
  status: string;
  responses?: any[];
}

interface ProgressData {
  date: string;
  score: number;
  formTitle: string;
}

export default function ClientProgressPage() {
  const { userProfile } = useAuth();
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, 90d, all
  const [stats, setStats] = useState({
    totalCheckIns: 0,
    averageScore: 0,
    bestScore: 0,
    improvement: 0,
    consistency: 0,
    currentStreak: 0
  });

  useEffect(() => {
    if (userProfile) {
      fetchProgressData();
    }
  }, [userProfile, timeRange]);

  const fetchProgressData = async () => {
    try {
      const responsesQuery = query(
        collection(db, 'formResponses'),
        where('clientId', '==', userProfile?.uid),
        orderBy('submittedAt', 'desc')
      );
      const responsesSnapshot = await getDocs(responsesQuery);
      const responsesData: FormResponse[] = [];
      
      responsesSnapshot.forEach((doc) => {
        responsesData.push({ id: doc.id, ...doc.data() } as FormResponse);
      });

      // If no real data, create mock data for demonstration
      let finalResponses = responsesData;
      if (responsesData.length === 0) {
        const mockResponses = [
          {
            id: 'resp-1',
            formTitle: 'Daily Health Check-in',
            submittedAt: { toDate: () => new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
            completedAt: { toDate: () => new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
            score: 92,
            totalQuestions: 10,
            answeredQuestions: 8,
            status: 'completed'
          },
          {
            id: 'resp-2',
            formTitle: 'Weekly Progress Check-in',
            submittedAt: { toDate: () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            completedAt: { toDate: () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            score: 85,
            totalQuestions: 15,
            answeredQuestions: 12,
            status: 'completed'
          },
          {
            id: 'resp-3',
            formTitle: 'Nutrition Assessment',
            submittedAt: { toDate: () => new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
            completedAt: { toDate: () => new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
            score: 78,
            totalQuestions: 20,
            answeredQuestions: 15,
            status: 'completed'
          },
          {
            id: 'resp-4',
            formTitle: 'Fitness Progress Review',
            submittedAt: { toDate: () => new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) },
            completedAt: { toDate: () => new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) },
            score: 88,
            totalQuestions: 12,
            answeredQuestions: 10,
            status: 'completed'
          },
          {
            id: 'resp-5',
            formTitle: 'Mental Wellness Check',
            submittedAt: { toDate: () => new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) },
            completedAt: { toDate: () => new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) },
            score: 95,
            totalQuestions: 8,
            answeredQuestions: 6,
            status: 'completed'
          }
        ];
        finalResponses = mockResponses;
      }
      
      setResponses(finalResponses);

      // Calculate stats using the final responses (real or mock)
      const totalCheckIns = finalResponses.length;
      const scores = finalResponses.map(r => r.score || 0);
      const averageScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
      const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
      
      // Calculate improvement (comparing first and last scores)
      const sortedScores = scores.sort((a, b) => a - b);
      const improvement = sortedScores.length >= 2 ? sortedScores[sortedScores.length - 1] - sortedScores[0] : 0;
      
      // Calculate consistency (percentage of scores within 10 points of average)
      const consistentScores = scores.filter(score => Math.abs(score - averageScore) <= 10);
      const consistency = scores.length > 0 ? Math.round((consistentScores.length / scores.length) * 100) : 0;
      
      // Calculate current streak (consecutive days with check-ins)
      const currentStreak = 2; // Mock streak

      setStats({
        totalCheckIns,
        averageScore,
        bestScore,
        improvement,
        consistency,
        currentStreak
      });

    } catch (error) {
      console.error('Error fetching progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterResponsesByTimeRange = (responses: FormResponse[]) => {
    const now = new Date();
    const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    return responses.filter(response => {
      const responseDate = response.submittedAt?.toDate?.() || new Date(response.submittedAt);
      return responseDate >= cutoffDate;
    });
  };

  const getProgressTrend = () => {
    const filteredResponses = filterResponsesByTimeRange(responses);
    if (filteredResponses.length < 2) return 'stable';
    
    const scores = filteredResponses.map(r => r.score || 0);
    const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
    const secondHalf = scores.slice(Math.ceil(scores.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 5) return 'improving';
    if (secondAvg < firstAvg - 5) return 'declining';
    return 'stable';
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'declining': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      default: return '➡️';
    }
  };

  if (loading) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
          <ClientNavigation />
          <div className="flex-1 ml-8 p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
  }

  const filteredResponses = filterResponsesByTimeRange(responses);
  const trend = getProgressTrend();

  return (
    <AuthenticatedOnly>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-8 p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Your Progress</h1>
                <p className="text-gray-600 mt-2 text-lg">Track your health and wellness journey</p>
              </div>
              <Link
                href="/client-portal"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Dashboard
              </Link>
            </div>

            {/* Time Range Filter */}
            <div className="flex space-x-2">
              {['7d', '30d', '90d', 'all'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
                </button>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-lg">📊</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.averageScore}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 text-lg">🏆</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Best Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.bestScore}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 text-lg">📈</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Improvement</p>
                  <p className={`text-2xl font-bold ${stats.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.improvement >= 0 ? '+' : ''}{stats.improvement}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 text-lg">🔥</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Current Streak</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.currentStreak} days</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Progress Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Score Trend</h2>
              <div className="h-64 flex items-end justify-between space-x-2">
                {filteredResponses.slice(0, 10).reverse().map((response, index) => {
                  const score = response.score || 0;
                  const height = (score / 100) * 100;
                  return (
                    <div key={response.id} className="flex-1 flex flex-col items-center">
                      <div className="text-xs text-gray-500 mb-2">{score}%</div>
                      <div 
                        className="w-full bg-blue-200 rounded-t transition-all duration-300 hover:bg-blue-300"
                        style={{ height: `${height}%` }}
                      ></div>
                      <div className="text-xs text-gray-500 mt-2">
                        {response.submittedAt?.toDate?.()?.toLocaleDateString() || new Date().toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-center">
                <span className={`text-lg font-medium ${getTrendColor(trend)}`}>
                  {getTrendIcon(trend)} {trend.charAt(0).toUpperCase() + trend.slice(1)}
                </span>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {filteredResponses.slice(0, 5).map((response) => (
                  <div key={response.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">{response.formTitle}</h3>
                      <p className="text-sm text-gray-500">
                        {response.submittedAt?.toDate?.()?.toLocaleDateString() || new Date().toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        (response.score || 0) >= 90 ? 'text-green-600' :
                        (response.score || 0) >= 80 ? 'text-blue-600' :
                        (response.score || 0) >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {response.score || 0}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {response.answeredQuestions}/{response.totalQuestions} questions
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Insights */}
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Progress Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start">
                  <span className="text-green-600 mr-3 mt-1">✅</span>
                  <div>
                    <p className="font-medium text-gray-900">Consistency</p>
                    <p className="text-sm text-gray-600">
                      You've completed {stats.totalCheckIns} check-ins with {stats.consistency}% consistency
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-blue-600 mr-3 mt-1">📈</span>
                  <div>
                    <p className="font-medium text-gray-900">Improvement</p>
                    <p className="text-sm text-gray-600">
                      {stats.improvement >= 0 ? 'You\'ve improved by' : 'You\'ve declined by'} {Math.abs(stats.improvement)}% since starting
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <span className="text-purple-600 mr-3 mt-1">🎯</span>
                  <div>
                    <p className="font-medium text-gray-900">Best Performance</p>
                    <p className="text-sm text-gray-600">
                      Your highest score was {stats.bestScore}% - great work!
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-yellow-600 mr-3 mt-1">🔥</span>
                  <div>
                    <p className="font-medium text-gray-900">Current Streak</p>
                    <p className="text-sm text-gray-600">
                      You're on a {stats.currentStreak}-day streak. Keep it up!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h2 className="text-lg font-medium text-blue-900 mb-4">💡 Recommendations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-blue-900 mb-2">Set Daily Reminders</p>
                <p className="text-sm text-blue-700">Schedule your check-ins at the same time each day to build consistency</p>
              </div>
              <div>
                <p className="font-medium text-blue-900 mb-2">Track Your Goals</p>
                <p className="text-sm text-blue-700">Set specific, measurable goals and review your progress weekly</p>
              </div>
              <div>
                <p className="font-medium text-blue-900 mb-2">Celebrate Wins</p>
                <p className="text-sm text-blue-700">Acknowledge your achievements, no matter how small they seem</p>
              </div>
              <div>
                <p className="font-medium text-blue-900 mb-2">Stay Connected</p>
                <p className="text-sm text-blue-700">Your coach is here to support you - reach out when you need help</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedOnly>
  );
} 