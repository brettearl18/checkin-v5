'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import CoachNavigation from '@/components/CoachNavigation';
import NotificationBell from '@/components/NotificationBell';
import NoticeBoard from '@/components/NoticeBoard';

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  pendingClients: number;
  checkInsToReview: number;
}

interface ClientListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage?: string;
  status: 'active' | 'pending' | 'paused' | 'archived';
  lastCheckIn?: string;
  pendingCheckInsCount?: number;
  unreadMessagesCount?: number;
  averageScore?: number;
  totalResponses?: number;
}

interface ActivityItem {
  id: string;
  clientId: string;
  clientName: string;
  type: 'check-in' | 'client-added' | 'form-response';
  description: string;
  timestamp: string;
  score?: number;
  status?: string;
}

interface TrendDataPoint {
  date: string;
  activeClients: number;
  averageScore: number;
}

export default function Dashboard2Page() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeClients: 0,
    pendingClients: 0,
    checkInsToReview: 0
  });
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [checkInsPerWeek, setCheckInsPerWeek] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'check-ins' | 'responses' | 'messages' | 'notices'>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'lastCheckIn' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const pageSize = 10;

  useEffect(() => {
    if (userProfile?.uid) {
      fetchDashboardData();
    }
  }, [userProfile?.uid]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const coachId = userProfile?.uid;
      if (!coachId) return;

      // Fetch all data in parallel
      const [
        clientsResponse,
        activityResponse,
        analyticsResponse,
        checkInsResponse
      ] = await Promise.all([
        fetch(`/api/clients?coachId=${coachId}`),
        fetch(`/api/dashboard/recent-activity?coachId=${coachId}`),
        fetch(`/api/analytics/overview?coachId=${coachId}&timeRange=1y`),
        fetch(`/api/dashboard/check-ins-to-review?coachId=${coachId}`)
      ]);

      // Process clients
      const clientsData = await clientsResponse.json();
      const clientsList = (clientsData.clients || []).map((client: any) => {
        // Handle profile image - check multiple possible field names
        let profileImage = client.profileImage || client.profile?.image || client.profileImageUrl || null;
        
        // Validate profile image URL
        if (profileImage && typeof profileImage === 'string') {
          // Check if it's a valid URL format
          try {
            new URL(profileImage);
          } catch {
            // Not a valid URL, might be a path or invalid - set to null
            profileImage = null;
          }
        } else {
          profileImage = null;
        }

        // Handle lastCheckIn date
        let lastCheckIn: string | undefined;
        if (client.lastCheckIn) {
          try {
            if (typeof client.lastCheckIn === 'string') {
              lastCheckIn = client.lastCheckIn;
            } else if (client.lastCheckIn.toDate) {
              lastCheckIn = client.lastCheckIn.toDate().toISOString();
            } else if (client.lastCheckIn.toISOString) {
              lastCheckIn = client.lastCheckIn.toISOString();
            } else {
              const date = new Date(client.lastCheckIn);
              if (!isNaN(date.getTime())) {
                lastCheckIn = date.toISOString();
              }
            }
          } catch {
            lastCheckIn = undefined;
          }
        }

        return {
          id: client.id,
          firstName: client.firstName || '',
          lastName: client.lastName || '',
          email: client.email || '',
          profileImage: profileImage || undefined,
          status: client.status || 'active',
          lastCheckIn,
          pendingCheckInsCount: 0, // Will be calculated
          unreadMessagesCount: 0, // Will be calculated
          averageScore: 0, // Will be calculated
          totalResponses: 0 // Will be calculated
        };
      }).filter((c: ClientListItem) => c.status !== 'archived');

      setClients(clientsList);

      // Process activities
      const activityData = await activityResponse.json();
      if (activityData.success && activityData.data) {
        setActivities(activityData.data);
      }

      // Process analytics for trend data
      const analyticsData = await analyticsResponse.json();
      if (analyticsData.success && analyticsData.data?.performanceMetrics?.trendData) {
        setTrendData(analyticsData.data.performanceMetrics.trendData);
      }

      // Calculate check-ins per week
      const checkInsData = await checkInsResponse.json();
      if (checkInsData.success && checkInsData.data?.checkIns) {
        // Calculate average check-ins per week from recent data
        const recentCheckIns = checkInsData.data.checkIns.slice(0, 20);
        const weeksOfData = Math.max(1, 4); // Assume 4 weeks for now
        setCheckInsPerWeek(recentCheckIns.length / weeksOfData);
      }

      // Calculate stats
      setStats({
        totalClients: clientsList.length,
        activeClients: clientsList.filter((c: ClientListItem) => c.status === 'active').length,
        pendingClients: clientsList.filter((c: ClientListItem) => c.status === 'pending').length,
        checkInsToReview: checkInsData.success && checkInsData.data?.checkIns ? checkInsData.data.checkIns.length : 0
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort clients
  const filteredClients = clients
    .filter(client => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        client.firstName.toLowerCase().includes(query) ||
        client.lastName.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'lastCheckIn':
          const dateA = a.lastCheckIn ? new Date(a.lastCheckIn).getTime() : 0;
          const dateB = b.lastCheckIn ? new Date(b.lastCheckIn).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / pageSize);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '-';
      }
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return '-';
    }
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gray-50 flex">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-64 bg-white border-r border-gray-200 flex-shrink-0">
          <CoachNavigation />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1">Overview of your business</p>
              </div>
              <div className="flex items-center space-x-4">
                <NotificationBell />
                <Link
                  href="/clients/create"
                  className="px-4 py-2 bg-[#daa450] hover:bg-[#c89440] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  + Add Client
                </Link>
              </div>
            </div>
          </div>

              {/* Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              {/* Notice Board Tab */}
              {activeTab === 'notices' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <NoticeBoard coachId={userProfile?.uid} />
                </div>
              )}

              {/* Other Tabs Content */}
              {activeTab !== 'notices' && (
                <>
              {/* Business Analytics Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Business Growth Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Growth (Past 12 Months)</h3>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    {trendData.length > 0 ? (
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Chart will be rendered here</p>
                        <p className="text-xs text-gray-500 mt-2">{trendData.length} data points available</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No data available</p>
                    )}
                  </div>
                </div>

                {/* Average Check-ins Per Week Chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Check-ins Per Week</h3>
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">{checkInsPerWeek.toFixed(2)}</p>
                      <p className="text-sm text-gray-600 mt-2">check-ins/week</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs and Client Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                {/* Tabs */}
                <div className="border-b border-gray-200">
                  <nav className="flex space-x-1 px-6">
                    {[
                      { id: 'summary', label: 'Summary' },
                      { id: 'check-ins', label: 'Check-ins' },
                      { id: 'responses', label: 'Responses' },
                      { id: 'messages', label: 'Messages' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setActiveTab('notices')}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'notices'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      Notice Board
                    </button>
                  </nav>
                </div>

                {/* Table Header with Search and Filters */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <input
                      type="text"
                      placeholder="Search clients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="name">Sort by Name</option>
                      <option value="lastCheckIn">Sort by Last Check-in</option>
                      <option value="status">Sort by Status</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>

                {/* Client Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Last Check-in</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedClients.length > 0 ? (
                        paginatedClients.map((client) => (
                          <tr
                            key={client.id}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => window.location.href = `/clients/${client.id}`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                                  {client.profileImage && !imageErrors.has(client.id) ? (
                                    <>
                                      <img 
                                        src={client.profileImage} 
                                        alt={`${client.firstName} ${client.lastName}`}
                                        className="absolute inset-0 w-full h-full rounded-full object-cover"
                                        style={{ objectFit: 'cover', objectPosition: 'center' }}
                                        onError={() => {
                                          // Fallback to initials if image fails to load
                                          setImageErrors(prev => new Set(prev).add(client.id));
                                        }}
                                        onLoad={(e) => {
                                          // Validate image actually loaded
                                          const img = e.target as HTMLImageElement;
                                          if (!img.naturalWidth || !img.naturalHeight) {
                                            setImageErrors(prev => new Set(prev).add(client.id));
                                          }
                                        }}
                                      />
                                      {/* Fallback initials (hidden but ready) */}
                                      <span className="absolute inset-0 flex items-center justify-center text-gray-600 font-medium text-sm bg-gray-200" style={{ display: imageErrors.has(client.id) ? 'flex' : 'none' }}>
                                        {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-gray-600 font-medium text-sm">
                                      {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {client.firstName} {client.lastName}
                                  </div>
                                  <div className="text-sm text-gray-500">{client.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                client.status === 'active' ? 'bg-green-100 text-green-800' :
                                client.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {formatDate(client.lastCheckIn)}
                            </td>
                            <td className="px-6 py-4">
                              <Link
                                href={`/clients/${client.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                OPEN
                              </Link>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            No clients found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredClients.length)} of {filteredClients.length} clients
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Recent Activities */}
        <div className="hidden xl:block w-80 bg-white border-l border-gray-200 flex-shrink-0">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">RECENT ACTIVITIES</h2>
            <div className="space-y-4">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-600 font-medium text-sm">
                        {activity.clientName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{activity.clientName}</span>
                        {' '}{activity.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">No recent activities</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}
