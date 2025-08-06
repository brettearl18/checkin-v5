'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

interface CheckIn {
  id: string;
  formTitle: string;
  score: number;
  submittedAt: any;
  totalQuestions: number;
  answeredQuestions: number;
}

interface ClientStats {
  totalCheckIns: number;
  averageScore: number;
  lastCheckIn: string;
  currentStreak: number;
  bestScore: number;
}

export default function ClientPortal() {
  const { user } = useAuth();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [stats, setStats] = useState<ClientStats>({
    totalCheckIns: 0,
    averageScore: 0,
    lastCheckIn: 'Never',
    currentStreak: 0,
    bestScore: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientData = async () => {
      if (!user) return;

      try {
        // Fetch check-ins for this client
        const checkInsQuery = query(
          collection(db, 'form_responses'),
          where('clientId', '==', user.uid),
          orderBy('submittedAt', 'desc'),
          limit(10)
        );
        
        const checkInsSnapshot = await getDocs(checkInsQuery);
        const checkInsData: CheckIn[] = [];
        
        checkInsSnapshot.forEach((doc) => {
          const data = doc.data();
          checkInsData.push({
            id: doc.id,
            formTitle: data.formTitle || 'Unknown Form',
            score: data.score || 0,
            submittedAt: data.submittedAt,
            totalQuestions: data.totalQuestions || 0,
            answeredQuestions: data.answeredQuestions || 0
          });
        });
        
        setCheckIns(checkInsData);

        // Calculate stats
        if (checkInsData.length > 0) {
          const scores = checkInsData.map(c => c.score);
          const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
          const bestScore = Math.max(...scores);
          const lastCheckIn = checkInsData[0].submittedAt?.toDate?.() || new Date();
          
          // Calculate streak (simplified - just count recent check-ins)
          const recentCheckIns = checkInsData.filter(c => {
            const checkInDate = c.submittedAt?.toDate?.() || new Date();
            const daysDiff = (Date.now() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 7; // Within last 7 days
          });
          
          const statsData: ClientStats = {
            totalCheckIns: checkInsData.length,
            averageScore,
            lastCheckIn: lastCheckIn.toLocaleDateString(),
            currentStreak: recentCheckIns.length,
            bestScore
          };
          
          setStats(statsData);
        }
      } catch (error) {
        console.error('Error fetching client data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, [user]);

  if (loading) {
    return (
      <ProtectedRoute requiredRole="client">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="client">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="px-4 py-6 sm:px-0">
            <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.name}!</h1>
            <p className="mt-2 text-gray-600">Your personal health and wellness dashboard</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4 sm:px-0 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Check-ins</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.totalCheckIns}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Average Score</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.averageScore}%</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Best Score</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.bestScore}%</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Current Streak</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.currentStreak} days</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Check-ins */}
          <div className="bg-white shadow rounded-lg px-4 sm:px-0 mb-8">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Check-ins</h3>
              
              {checkIns.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No check-ins yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Complete your first check-in to see your progress here.</p>
                  <div className="mt-6">
                    <Link
                      href="/client-portal/check-ins"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Start Your First Check-in
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {checkIns.map((checkIn) => (
                    <div key={checkIn.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">{checkIn.formTitle}</h4>
                          <p className="text-sm text-gray-500">
                            {checkIn.submittedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            checkIn.score >= 80 ? 'bg-green-100 text-green-800' :
                            checkIn.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {checkIn.score}%
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {checkIn.answeredQuestions}/{checkIn.totalQuestions} questions
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-6 px-4 sm:px-0">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/client-portal/check-ins"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Complete Check-in
              </Link>
              <Link
                href="/client-portal/profile"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                View Profile
              </Link>
              <Link
                href="/client-portal/progress"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
              >
                View Progress
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 