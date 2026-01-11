'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: 'admin' | 'coach' | 'client';
  action: string;
  resourceType?: string;
  resourceId?: string;
  description: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

interface AuditLogData {
  logs: AuditLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  stats: {
    total: number;
    byAction: Record<string, number>;
    byRole: Record<string, number>;
    byResourceType: Record<string, number>;
    last7Days: number;
    last30Days: number;
  };
}

export default function AuditLogPage() {
  const { userProfile, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AuditLogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    action: '',
    userEmail: '',
    userRole: '',
    resourceType: '',
  });
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get auth token
      let idToken: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          const { auth } = await import('@/lib/firebase-client');
          if (auth?.currentUser) {
            idToken = await auth.currentUser.getIdToken();
          }
        } catch (authError) {
          console.warn('Could not get auth token:', authError);
        }
      }

      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.action) params.append('action', filters.action);
      if (filters.userEmail) params.append('userEmail', filters.userEmail);
      if (filters.userRole) params.append('userRole', filters.userRole);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);
      params.append('limit', pageSize.toString());
      params.append('offset', (currentPage * pageSize).toString());

      const headers: HeadersInit = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/admin/audit-log?${params}`, {
        headers,
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to fetch audit logs');
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Error fetching audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [currentPage]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(0); // Reset to first page when filters change
  };

  const handleApplyFilters = () => {
    setCurrentPage(0);
    fetchAuditLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      action: '',
      userEmail: '',
      userRole: '',
      resourceType: '',
    });
    setCurrentPage(0);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      'login': 'bg-green-100 text-green-800',
      'logout': 'bg-gray-100 text-gray-800',
      'check_in_submitted': 'bg-blue-100 text-blue-800',
      'check_in_updated': 'bg-blue-100 text-blue-800',
      'check_in_deleted': 'bg-red-100 text-red-800',
      'check_in_cleared': 'bg-orange-100 text-orange-800',
      'measurement_submitted': 'bg-purple-100 text-purple-800',
      'measurement_updated': 'bg-purple-100 text-purple-800',
      'measurement_deleted': 'bg-red-100 text-red-800',
      'profile_updated': 'bg-yellow-100 text-yellow-800',
      'client_created': 'bg-green-100 text-green-800',
      'client_updated': 'bg-blue-100 text-blue-800',
      'client_deleted': 'bg-red-100 text-red-800',
      'form_created': 'bg-indigo-100 text-indigo-800',
      'form_updated': 'bg-indigo-100 text-indigo-800',
      'form_deleted': 'bg-red-100 text-red-800',
      'check_in_assigned': 'bg-teal-100 text-teal-800',
      'check_in_assignment_deleted': 'bg-red-100 text-red-800',
      'user_created': 'bg-green-100 text-green-800',
      'user_updated': 'bg-blue-100 text-blue-800',
      'user_deleted': 'bg-red-100 text-red-800',
    };
    return colors[action] || 'bg-gray-100 text-gray-800';
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'admin': 'bg-purple-100 text-purple-800',
      'coach': 'bg-blue-100 text-blue-800',
      'client': 'bg-green-100 text-green-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  return (
    <RoleProtected requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="px-4 py-6 sm:px-0 flex justify-between items-start">
            <div>
              <Link href="/admin" className="text-[#daa450] hover:text-orange-600 mb-2 inline-block">
                ← Back to Admin Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Audit Log</h1>
              <p className="mt-2 text-gray-600">Track all user actions and system events</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>

          {/* Stats Summary */}
          {data && data.stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-4 sm:px-0 mb-6">
              <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <p className="text-sm text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">{data.stats.total}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <p className="text-sm text-gray-600">Last 7 Days</p>
                <p className="text-2xl font-bold text-gray-900">{data.stats.last7Days}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <p className="text-sm text-gray-600">Last 30 Days</p>
                <p className="text-2xl font-bold text-gray-900">{data.stats.last30Days}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <p className="text-sm text-gray-600">Actions</p>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(data.stats.byAction).length}</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#daa450]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#daa450]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#daa450]"
                >
                  <option value="">All Actions</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="check_in_submitted">Check-in Submitted</option>
                  <option value="check_in_deleted">Check-in Deleted</option>
                  <option value="check_in_cleared">Check-in Cleared</option>
                  <option value="measurement_submitted">Measurement Submitted</option>
                  <option value="measurement_updated">Measurement Updated</option>
                  <option value="profile_updated">Profile Updated</option>
                  <option value="client_created">Client Created</option>
                  <option value="client_updated">Client Updated</option>
                  <option value="client_deleted">Client Deleted</option>
                  <option value="form_created">Form Created</option>
                  <option value="form_updated">Form Updated</option>
                  <option value="form_deleted">Form Deleted</option>
                  <option value="check_in_assigned">Check-in Assigned</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Role
                </label>
                <select
                  value={filters.userRole}
                  onChange={(e) => handleFilterChange('userRole', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#daa450]"
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="coach">Coach</option>
                  <option value="client">Client</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Email
                </label>
                <input
                  type="text"
                  value={filters.userEmail}
                  onChange={(e) => handleFilterChange('userEmail', e.target.value)}
                  placeholder="Search by email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#daa450]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resource Type
                </label>
                <select
                  value={filters.resourceType}
                  onChange={(e) => handleFilterChange('resourceType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#daa450]"
                >
                  <option value="">All Resources</option>
                  <option value="check_in">Check-in</option>
                  <option value="measurement">Measurement</option>
                  <option value="client">Client</option>
                  <option value="form">Form</option>
                  <option value="user">User</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 bg-[#daa450] text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-[#daa450]"
              >
                Apply Filters
              </button>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Action Breakdown */}
          {data && data.stats && Object.keys(data.stats.byAction).length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions by Type</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Object.entries(data.stats.byAction)
                  .sort(([, a], [, b]) => b - a)
                  .map(([action, count]) => (
                    <div key={action} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <span className="text-sm font-medium text-gray-700">{action.replace(/_/g, ' ')}</span>
                      <span className="text-lg font-bold text-gray-900">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Audit Logs Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Audit Logs</h2>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#daa450]"></div>
              </div>
            )}

            {error && (
              <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {!loading && data && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Resource
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            No audit logs found for the selected filters.
                          </td>
                        </tr>
                      ) : (
                        data.logs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(log.timestamp)}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="space-y-1">
                                <div className="font-medium text-gray-900">{log.userName || 'Unknown'}</div>
                                <div className="text-gray-500">{log.userEmail}</div>
                                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(log.userRole)}`}>
                                  {log.userRole}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {log.description}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {log.resourceType && (
                                <div>
                                  <div className="font-medium">{log.resourceType}</div>
                                  {log.resourceId && (
                                    <div className="text-xs text-gray-400">{log.resourceId.substring(0, 20)}...</div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.pagination.total > pageSize && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {data.pagination.offset + 1} to {Math.min(data.pagination.offset + pageSize, data.pagination.total)} of {data.pagination.total} events
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                        disabled={currentPage === 0}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        disabled={!data.pagination.hasMore}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

