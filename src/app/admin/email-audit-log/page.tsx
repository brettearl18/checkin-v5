'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface EmailLog {
  id: string;
  originalRecipients: string[];
  actualRecipients: string[];
  subject: string;
  emailType: string;
  metadata: Record<string, any>;
  testMode: boolean;
  sentAt: string;
  createdAt: string;
  opened?: boolean;
  openedAt?: string;
  openedCount?: number;
  clicked?: boolean;
  clickedAt?: string;
  clickedCount?: number;
  delivered?: boolean;
  deliveredAt?: string;
  failed?: boolean;
  bounced?: boolean;
}

interface EmailAuditLogData {
  logs: EmailLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  stats: {
    total: number;
    byType: Record<string, number>;
    byRecipient: Record<string, number>;
    testModeCount: number;
    last7Days: number;
    last30Days: number;
  };
}

export default function EmailAuditLogPage() {
  const { userProfile, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EmailAuditLogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    emailType: '',
    recipient: '',
  });
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  const fetchEmailLogs = async () => {
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
      if (filters.emailType) params.append('emailType', filters.emailType);
      if (filters.recipient) params.append('recipient', filters.recipient);
      params.append('limit', pageSize.toString());
      params.append('offset', (currentPage * pageSize).toString());

      const headers: HeadersInit = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/admin/email-audit-log?${params}`, {
        headers,
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to fetch email logs');
      }
    } catch (err) {
      console.error('Error fetching email logs:', err);
      setError('Error fetching email logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailLogs();
  }, [currentPage]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(0); // Reset to first page when filters change
  };

  const handleApplyFilters = () => {
    setCurrentPage(0);
    fetchEmailLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      emailType: '',
      recipient: '',
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

  const getEmailTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'onboarding': 'bg-blue-100 text-blue-800',
      'check-in-assigned': 'bg-green-100 text-green-800',
      'check-in-window-open': 'bg-purple-100 text-purple-800',
      'check-in-due-reminder': 'bg-yellow-100 text-yellow-800',
      'check-in-overdue': 'bg-red-100 text-red-800',
      'credentials': 'bg-indigo-100 text-indigo-800',
      'issue-report': 'bg-orange-100 text-orange-800',
      'unknown': 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors['unknown'];
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
              <h1 className="text-3xl font-bold text-gray-900">Email Audit Log</h1>
              <p className="mt-2 text-gray-600">Track all emails sent from the platform</p>
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
                <p className="text-sm text-gray-600">Total Emails</p>
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
                <p className="text-sm text-gray-600">Test Mode</p>
                <p className="text-2xl font-bold text-orange-600">{data.stats.testModeCount}</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  Email Type
                </label>
                <select
                  value={filters.emailType}
                  onChange={(e) => handleFilterChange('emailType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#daa450]"
                >
                  <option value="">All Types</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="check-in-assigned">Check-in Assigned</option>
                  <option value="check-in-window-open">Check-in Window Open</option>
                  <option value="check-in-due-reminder">Check-in Due Reminder</option>
                  <option value="check-in-overdue">Check-in Overdue</option>
                  <option value="credentials">Credentials</option>
                  <option value="issue-report">Issue Report</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email
                </label>
                <input
                  type="text"
                  value={filters.recipient}
                  onChange={(e) => handleFilterChange('recipient', e.target.value)}
                  placeholder="Search by email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#daa450]"
                />
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

          {/* Email Type Breakdown */}
          {data && data.stats && Object.keys(data.stats.byType).length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Emails by Type</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(data.stats.byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <span className="text-sm font-medium text-gray-700">{type}</span>
                      <span className="text-lg font-bold text-gray-900">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Email Logs Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Email Logs</h2>
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
                          Sent At
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recipients
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Subject
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tracking
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.logs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            No emails found for the selected filters.
                          </td>
                        </tr>
                      ) : (
                        data.logs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(log.sentAt)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="space-y-1">
                                {log.actualRecipients.map((email, idx) => (
                                  <div key={idx} className="font-medium">{email}</div>
                                ))}
                                {log.testMode && log.originalRecipients.length > 0 && (
                                  <div className="text-xs text-gray-500">
                                    Original: {log.originalRecipients.join(', ')}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {log.subject}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getEmailTypeColor(log.emailType)}`}>
                                {log.emailType}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {log.testMode ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                                  Test Mode
                                </span>
                              ) : log.failed || log.bounced ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                  Failed
                                </span>
                              ) : log.delivered === true ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                  Delivered
                                </span>
                              ) : typeof log.delivered === 'undefined' ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800" title="Delivery status unknown - webhooks may not be configured or domain may be in sandbox mode">
                                  Sent (Status Unknown)
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                  Sent
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex flex-col gap-1">
                                {log.opened ? (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                    📧 Opened {log.openedCount > 1 ? `(${log.openedCount}x)` : ''}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                    Not Opened
                                  </span>
                                )}
                                {log.clicked && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                    🔗 Clicked {log.clickedCount > 1 ? `(${log.clickedCount}x)` : ''}
                                  </span>
                                )}
                              </div>
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
                      Showing {data.pagination.offset + 1} to {Math.min(data.pagination.offset + pageSize, data.pagination.total)} of {data.pagination.total} emails
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

