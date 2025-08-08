'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';

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
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');

  useEffect(() => {
    fetchCheckIns();
  }, []);

  const fetchCheckIns = async () => {
    try {
      // Mock data for demonstration
      const mockCheckins: CheckIn[] = [
        {
          id: '1',
          title: 'Weekly Wellness Check-in',
          description: 'Complete your weekly wellness assessment to track your progress',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          formId: 'form-001',
          assignedBy: 'Coach Sarah',
          assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          title: 'Monthly Progress Assessment',
          description: 'Comprehensive monthly review of your health and wellness goals',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          formId: 'form-002',
          assignedBy: 'Coach Sarah',
          assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '3',
          title: 'Initial Health Assessment',
          description: 'Your first health assessment to establish baseline metrics',
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'completed',
          formId: 'form-003',
          assignedBy: 'Coach Sarah',
          assignedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          score: 85
        },
        {
          id: '4',
          title: 'Nutrition Tracking Week 1',
          description: 'Track your nutrition habits for the first week',
          dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'overdue',
          formId: 'form-004',
          assignedBy: 'Coach Sarah',
          assignedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      setCheckins(mockCheckins);
    } catch (error) {
      console.error('Error fetching check-ins:', error);
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

  const filteredCheckins = checkins.filter(checkin => {
    if (filter === 'all') return true;
    return checkin.status === filter;
  });

  const stats = {
    total: checkins.length,
    pending: checkins.filter(c => c.status === 'pending').length,
    completed: checkins.filter(c => c.status === 'completed').length,
    overdue: checkins.filter(c => c.status === 'overdue').length
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  {[...Array(4)].map((_, i) => (
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

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gray-50 flex">
        <ClientNavigation />
        
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">My Check-ins</h1>
              <p className="text-gray-800 mt-2">
                Complete your assigned check-ins and track your progress
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Total</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                  <div className="p-3 bg-gray-100 rounded-full">
                    <span className="text-2xl">📋</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Pending</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <span className="text-2xl">⏳</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Completed</p>
                    <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <span className="text-2xl">✅</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Overdue</p>
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
                  { key: 'all', label: 'All', count: stats.total },
                  { key: 'pending', label: 'Pending', count: stats.pending },
                  { key: 'completed', label: 'Completed', count: stats.completed },
                  { key: 'overdue', label: 'Overdue', count: stats.overdue }
                ].map((filterOption) => (
                  <button
                    key={filterOption.key}
                    onClick={() => setFilter(filterOption.key as any)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      filter === filterOption.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {filterOption.label} ({filterOption.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Check-ins List */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {filter === 'all' ? 'All Check-ins' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Check-ins`}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredCheckins.length} check-in{filteredCheckins.length !== 1 ? 's' : ''} found
                </p>
              </div>
              
              <div className="p-6">
                {filteredCheckins.length > 0 ? (
                  <div className="space-y-6">
                    {filteredCheckins.map((checkin) => (
                      <div key={checkin.id} className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="text-2xl">{getStatusIcon(checkin.status)}</span>
                              <h3 className="text-lg font-semibold text-gray-900">{checkin.title}</h3>
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(checkin.status)}`}>
                                {checkin.status}
                              </span>
                            </div>
                            <p className="text-gray-600 mb-3">{checkin.description}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500">
                              <div>
                                <span className="font-medium">Assigned by:</span> {checkin.assignedBy}
                              </div>
                              <div>
                                <span className="font-medium">Assigned:</span> {formatDate(checkin.assignedAt)}
                              </div>
                              <div>
                                <span className="font-medium">Due:</span> {formatDate(checkin.dueDate)}
                              </div>
                            </div>

                            {checkin.status === 'completed' && checkin.score && (
                              <div className="mt-3">
                                <span className="text-lg font-semibold text-green-600">
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
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
                            >
                              Complete Check-in
                            </Link>
                          )}
                          {checkin.status === 'overdue' && (
                            <Link
                              href={`/client-portal/check-in/${checkin.id}`}
                              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
                            >
                              Complete Now
                            </Link>
                          )}
                          {checkin.status === 'completed' && (
                            <Link
                              href={`/client-portal/check-in/${checkin.id}/success`}
                              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
                            >
                              View Results
                            </Link>
                          )}
                          <button className="text-blue-600 hover:text-blue-800 font-medium">
                            View Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">
                      {filter === 'completed' ? '✅' : filter === 'overdue' ? '⚠️' : '📋'}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No {filter} check-ins
                    </h3>
                    <p className="text-gray-600">
                      {filter === 'completed' 
                        ? 'Complete your first check-in to see it here.'
                        : filter === 'overdue'
                        ? 'Great job staying on top of your check-ins!'
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