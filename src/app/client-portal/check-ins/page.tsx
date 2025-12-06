'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface CheckIn {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  formId: string;
  assignedBy: string;
  assignedAt: string;
  completedAt?: string;
  score?: number;
}

export default function ClientCheckInsPage() {
  const { userProfile } = useAuth();
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'pending' | 'completed' | 'overdue'>('upcoming');
  const [clientId, setClientId] = useState<string | null>(null);
  const [coachTimezone, setCoachTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    fetchClientId();
  }, [userProfile?.email]);

  useEffect(() => {
    if (clientId) {
      fetchCheckIns();
    }
  }, [clientId]);

  useEffect(() => {
    fetchCoachTimezone();
  }, [userProfile?.uid]);

  const fetchClientId = async () => {
    try {
      if (!userProfile?.email) {
        console.error('No user email available');
        setLoading(false);
        return;
      }

      // Fetch client ID from clients collection using email
      const response = await fetch(`/api/client-portal?clientEmail=${userProfile.email}`);
      const result = await response.json();

      if (result.success && result.data.client) {
        setClientId(result.data.client.id);
      } else {
        console.error('Failed to fetch client ID:', result.message);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching client ID:', error);
      setLoading(false);
    }
  };

  const fetchCoachTimezone = async () => {
    try {
      if (!userProfile?.uid) return;

      // Fetch coach's timezone setting
      const coachDoc = await getDoc(doc(db, 'coaches', userProfile.uid));
      if (coachDoc.exists()) {
        const coachData = coachDoc.data();
        if (coachData.timezone) {
          setCoachTimezone(coachData.timezone);
        }
      }
    } catch (error) {
      console.error('Error fetching coach timezone:', error);
    }
  };

  const fetchCheckIns = async () => {
    try {
      if (!clientId) {
        console.error('No client ID available');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/client-portal/check-ins?clientId=${clientId}`);
      const result = await response.json();

      if (result.success) {
        setCheckins(result.data.checkins);
      } else {
        console.error('Failed to fetch check-ins:', result.message);
        setCheckins([]);
      }
    } catch (error) {
      console.error('Error fetching check-ins:', error);
      setCheckins([]);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'pending':
        return '⏳';
      case 'overdue':
        return '⚠️';
      default:
        return '📋';
    }
  };

  // Filter check-ins based on next 7 days and status
  const getUpcomingCheckins = () => {
    const now = new Date();
    
    // Calculate start of today and end of next 7 days
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    const endOfNextWeek = new Date(now);
    endOfNextWeek.setDate(now.getDate() + 7);
    endOfNextWeek.setHours(23, 59, 59, 999);

    return checkins.filter(checkin => {
      const dueDate = new Date(checkin.dueDate);
      
      // Check if the due date is within the next 7 days and not completed
      return dueDate >= startOfToday && dueDate <= endOfNextWeek && checkin.status !== 'completed';
    });
  };

  const filteredCheckins = (() => {
    switch (filter) {
      case 'upcoming':
        return getUpcomingCheckins();
      case 'pending':
        return checkins.filter(c => c.status === 'pending');
      case 'completed':
        return checkins.filter(c => c.status === 'completed');
      case 'overdue':
        return checkins.filter(c => c.status === 'overdue');
      default:
        return checkins;
    }
  })();

  const stats = {
    upcoming: getUpcomingCheckins().length,
    pending: checkins.filter(c => c.status === 'pending').length,
    completed: checkins.filter(c => c.status === 'completed').length,
    overdue: checkins.filter(c => c.status === 'overdue').length
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
          <ClientNavigation />
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl shadow-lg p-6">
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

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <ClientNavigation />
        
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                My Check-ins
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Complete your assigned check-ins and track your progress
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 hover:shadow-2xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">This Week</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.upcoming}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <span className="text-2xl">📅</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 hover:shadow-2xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Pending</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <span className="text-2xl">⏳</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 hover:shadow-2xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Completed</p>
                    <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <span className="text-2xl">✅</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 hover:shadow-2xl transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Overdue</p>
                    <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-full">
                    <span className="text-2xl">⚠️</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6">
              <div className="flex space-x-2">
                {[
                  { key: 'upcoming', label: 'This Week', count: stats.upcoming },
                  { key: 'pending', label: 'Pending', count: stats.pending },
                  { key: 'completed', label: 'Completed', count: stats.completed },
                  { key: 'overdue', label: 'Overdue', count: stats.overdue }
                ].map((filterOption) => (
                  <button
                    key={filterOption.key}
                    onClick={() => setFilter(filterOption.key as any)}
                    className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      filter === filterOption.key
                        ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:shadow-md'
                    }`}
                  >
                    {filterOption.label} ({filterOption.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Check-ins List */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="text-2xl font-bold text-gray-900">
                  {filter === 'upcoming' ? 'This Week\'s Check-ins' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Check-ins`}
                </h2>
                <p className="text-gray-600 mt-1">
                  {filteredCheckins.length} check-in{filteredCheckins.length !== 1 ? 's' : ''} found
                </p>
              </div>
              
              <div className="p-6">
                {filteredCheckins.length > 0 ? (
                  <div className="space-y-6">
                    {filteredCheckins.map((checkin) => (
                      <div key={checkin.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow bg-gradient-to-r from-white to-gray-50">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <span className="text-3xl">{getStatusIcon(checkin.status)}</span>
                              <h3 className="text-xl font-bold text-gray-900">{checkin.title}</h3>
                              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(checkin.status)}`}>
                                {checkin.status}
                              </span>
                            </div>
                            <p className="text-gray-600 mb-4 text-lg">{checkin.description}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500 bg-white p-4 rounded-lg border border-gray-100">
                              <div>
                                <span className="font-semibold text-gray-700">Assigned by:</span> {checkin.assignedBy}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-700">Assigned:</span> {formatDate(checkin.assignedAt)}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-700">Due:</span> {formatDate(checkin.dueDate)}
                              </div>
                            </div>

                            {checkin.status === 'completed' && checkin.score && (
                              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                                <span className="text-xl font-bold text-green-600">
                                  Score: {checkin.score}%
                                </span>
                                <span className="text-sm text-gray-500 ml-2">
                                  Completed: {checkin.completedAt ? formatDate(checkin.completedAt) : 'N/A'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex space-x-3">
                          {checkin.status === 'pending' && (
                            <Link
                              href={`/client-portal/check-in/${checkin.id}`}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                            >
                              Complete Check-in
                            </Link>
                          )}
                          {checkin.status === 'overdue' && (
                            <Link
                              href={`/client-portal/check-in/${checkin.id}`}
                              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                            >
                              Complete Now
                            </Link>
                          )}
                          {checkin.status === 'completed' && (
                            <Link
                              href={`/client-portal/check-in/${checkin.id}/success`}
                              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                            >
                              View Results
                            </Link>
                          )}
                          <button className="text-blue-600 hover:text-blue-800 font-semibold hover:underline">
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="text-gray-400 text-8xl mb-6">
                      {filter === 'completed' ? '✅' : filter === 'overdue' ? '⚠️' : filter === 'upcoming' ? '📅' : '📋'}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      No {filter} check-ins
                    </h3>
                    <p className="text-gray-600 text-lg max-w-md mx-auto">
                      {filter === 'completed' 
                        ? 'Complete your first check-in to see it here.'
                        : filter === 'overdue'
                        ? 'Great job staying on top of your check-ins!'
                        : filter === 'upcoming'
                        ? 'No check-ins scheduled for this week. Check back later!'
                        : 'No check-ins have been assigned yet.'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 