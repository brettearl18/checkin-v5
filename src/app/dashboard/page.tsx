'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import CoachNavigation from '@/components/CoachNavigation';
import NotificationBell from '@/components/NotificationBell';

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  pendingClients: number;
  totalForms: number;
  recentCheckIns: number;
  avgProgress: number;
  avgEngagement: number;
  monthlyGrowth: number;
}

interface CheckInToReview {
  id: string;
  clientId: string;
  clientName: string;
  formTitle: string;
  submittedAt: string;
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  status: string;
  formId: string;
  assignmentId: string;
}

interface CompletedCheckIn {
  id: string;
  clientId: string;
  clientName: string;
  formTitle: string;
  submittedAt: string;
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  status: string;
  formId: string;
  assignmentId: string;
}

interface RecentActivity {
  id: string;
  type: 'check-in' | 'form-response' | 'client-added' | 'goal-achieved';
  clientName: string;
  description: string;
  timestamp: string;
}

interface CoachData {
  shortUID: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Form {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: string[];
  estimatedTime: number;
  isStandard: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ClientPhoto {
  id: string;
  clientId: string;
  clientName: string;
  photoUrl: string;
  photoType: 'profile' | 'before' | 'after' | 'progress';
  uploadedAt: string;
  caption?: string;
}

export default function DashboardPage() {
  const { userProfile, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeClients: 0,
    pendingClients: 0,
    totalForms: 0,
    recentCheckIns: 0,
    avgProgress: 0,
    avgEngagement: 0,
    monthlyGrowth: 0
  });
  const [checkInsToReview, setCheckInsToReview] = useState<CheckInToReview[]>([]);
  const [completedCheckIns, setCompletedCheckIns] = useState<CompletedCheckIn[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [coachData, setCoachData] = useState<CoachData | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [clientPhotos, setClientPhotos] = useState<ClientPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [clearingNotifications, setClearingNotifications] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [sortBy, setSortBy] = useState<'submittedAt' | 'clientName' | 'score'>('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [completedSortBy, setCompletedSortBy] = useState<'submittedAt' | 'clientName' | 'score'>('submittedAt');
  const [completedSortOrder, setCompletedSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'review' | 'completed'>('review');

  // Refresh dashboard data when notifications change
  useEffect(() => {
    if (userProfile?.uid) {
      fetchDashboardData();
    }
  }, [userProfile?.uid]);

  // Add manual refresh capability for real-time updates
  const handleManualRefresh = () => {
    fetchDashboardData(true);
  };

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const coachId = userProfile?.uid || 'demo-coach-id';
      
      // Fetch all data in parallel for better performance
      const [
        coachResponse,
        clientsResponse,
        formsResponse,
        analyticsResponse,
        checkInsResponse,
        completedCheckInsResponse,
        activityResponse
      ] = await Promise.all([
        fetch(`/api/coaches/${coachId}`).catch(err => ({ ok: false, json: () => ({ success: false }) })),
        fetch(`/api/clients?coachId=${coachId}`).catch(err => ({ ok: false, json: () => ({ clients: [] }) })),
        fetch(`/api/forms?coachId=${coachId}`).catch(err => ({ ok: false, json: () => ({ success: false, forms: [] }) })),
        fetch(`/api/analytics/overview?coachId=${coachId}&timeRange=30d`).catch(err => ({ ok: false, json: () => ({}) })),
        fetch(`/api/dashboard/check-ins-to-review?coachId=${coachId}&sortBy=${sortBy}&sortOrder=${sortOrder}`).catch(err => ({ ok: false, json: () => ({ success: false, data: { checkIns: [] } }) })),
        fetch(`/api/check-ins?coachId=${coachId}&status=completed&sortBy=${completedSortBy}&sortOrder=${completedSortOrder}`).catch(err => ({ ok: false, json: () => ({ success: false, data: { checkIns: [] } }) })),
        fetch(`/api/dashboard/recent-activity?coachId=${coachId}`).catch(err => ({ ok: false, json: () => ({ success: false, data: [] }) }))
      ]);

      // Process coach data
      let coachData = null;
      if (coachResponse.ok) {
        const coachDataResponse = await coachResponse.json();
        if (coachDataResponse.success) {
          coachData = coachDataResponse.data;
          setCoachData(coachData);
        }
      }

      // Process clients data
      const clientsData = await clientsResponse.json();
      const clients = clientsData.clients || [];

      // Process forms data with enhanced error handling
      let forms: Form[] = [];
      if (formsResponse.ok) {
        const formsData = await formsResponse.json();
        if (formsData.success) {
          forms = formsData.forms || [];
          console.log(`Found ${forms.length} forms for coach ${coachId}`);
        } else {
          console.warn('Forms API returned success: false:', formsData.message);
        }
      } else {
        console.warn('Failed to fetch forms:', formsResponse.status, formsResponse.statusText);
      }

      // Process analytics data
      const analyticsData = await analyticsResponse.json();

      // Process check-ins data
      const checkInsData = await checkInsResponse.json();
      console.log('Check-ins API response:', checkInsData);
      let checkIns = [];
      if (checkInsData.success) {
        if (checkInsData.data?.checkIns) {
          checkIns = checkInsData.data.checkIns;
        } else if (checkInsData.checkIns) {
          checkIns = checkInsData.checkIns;
        }
      }

      // Process completed check-ins data
      const completedCheckInsData = await completedCheckInsResponse.json();
      console.log('Completed check-ins API response:', completedCheckInsData);
      let completedCheckIns = [];
      if (completedCheckInsData.success) {
        if (completedCheckInsData.data?.checkIns) {
          completedCheckIns = completedCheckInsData.data.checkIns;
        } else if (completedCheckInsData.checkIns) {
          completedCheckIns = completedCheckInsData.checkIns;
        }
      }

      // Process activity data
      const activityData = await activityResponse.json();
      console.log('Activity API response:', activityData);
      let realActivity = [];
      if (activityData.success) {
        if (activityData.data) {
          realActivity = activityData.data;
        } else if (activityData.activity) {
          realActivity = activityData.activity;
        }
      }

      // Calculate comprehensive stats
      const totalClients = clients.length;
      const activeClients = clients.filter((c: any) => c.status === 'active').length;
      const pendingClients = clients.filter((c: any) => c.status === 'pending').length;
      const recentCheckIns = clients.filter((c: any) => 
        c.lastCheckIn && new Date(c.lastCheckIn) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length;

      // Enhanced forms statistics
      const totalForms = forms.length;
      const standardForms = forms.filter((f: Form) => f.isStandard).length;
      const customForms = totalForms - standardForms;
      
      // Calculate average progress from clients
      const avgProgress = clients.length > 0 
        ? Math.round(clients.reduce((sum: number, c: any) => sum + (c.progressScore || 0), 0) / clients.length)
        : 0;
      
      // Calculate engagement metrics
      const avgEngagement = clients.length > 0 
        ? Math.round(clients.reduce((sum: number, c: any) => sum + (c.engagementScore || 0), 0) / clients.length)
        : 78;
      
      const monthlyGrowth = 15;

      setStats({
        totalClients,
        activeClients,
        pendingClients,
        totalForms,
        recentCheckIns,
        avgProgress,
        avgEngagement,
        monthlyGrowth
      });
      
      setCheckInsToReview(checkIns);
      setCompletedCheckIns(completedCheckIns);
      setRecentActivity(realActivity);
      
      // Sample client photos data - Replace with real API call when available
      const samplePhotos: ClientPhoto[] = [
        {
          id: 'photo-1',
          clientId: 'client-1',
          clientName: 'Sarah Johnson',
          photoUrl: '/api/photos/client-1/profile',
          photoType: 'profile',
          uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          caption: 'Updated profile photo'
        },
        {
          id: 'photo-2',
          clientId: 'client-2',
          clientName: 'Mike Chen',
          photoUrl: '/api/photos/client-2/before',
          photoType: 'before',
          uploadedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
          caption: 'Starting point photo'
        },
        {
          id: 'photo-3',
          clientId: 'client-1',
          clientName: 'Sarah Johnson',
          photoUrl: '/api/photos/client-1/progress',
          photoType: 'progress',
          uploadedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          caption: 'Week 4 progress'
        },
        {
          id: 'photo-4',
          clientId: 'client-3',
          clientName: 'Emma Davis',
          photoUrl: '/api/photos/client-3/profile',
          photoType: 'profile',
          uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          caption: 'New profile photo'
        }
      ];
      setClientPhotos(samplePhotos);
      
      // Log summary for debugging
      console.log(`Dashboard loaded: ${totalClients} clients, ${totalForms} forms, ${checkIns.length} check-ins to review, ${completedCheckIns.length} completed check-ins`);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Set empty activity on error but keep existing data
      setRecentActivity([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (isRefresh) {
        setRefreshed(true);
        setTimeout(() => setRefreshed(false), 3000);
      }
    }
  };

  const clearNotifications = async () => {
    if (!userProfile?.uid) return;
    
    setClearingNotifications(true);
    
    // Clear the local state immediately for better UX
    setRecentActivity([]);
    
    try {
      const response = await fetch('/api/dashboard/clear-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coachId: userProfile.uid
        }),
      });

      if (response.ok) {
        console.log('Notifications cleared successfully');
      } else {
        const errorData = await response.json();
        console.error('Failed to clear notifications:', errorData.error);
        // Optionally show an error message to the user
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      // Optionally show an error message to the user
    } finally {
      setClearingNotifications(false);
    }
  };

  const handleSortChange = async (newSortBy: 'submittedAt' | 'clientName' | 'score') => {
    const newSortOrder = sortBy === newSortBy && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    
    try {
      const response = await fetch(`/api/dashboard/check-ins-to-review?coachId=${userProfile?.uid || 'demo-coach-id'}&sortBy=${newSortBy}&sortOrder=${newSortOrder}`);
      const data = await response.json();
      if (data.success) {
        setCheckInsToReview(data.data.checkIns);
      }
    } catch (error) {
      console.error('Error fetching sorted check-ins:', error);
    }
  };

  const handleCompletedSortChange = async (newSortBy: 'submittedAt' | 'clientName' | 'score') => {
    const newSortOrder = completedSortBy === newSortBy && completedSortOrder === 'desc' ? 'asc' : 'desc';
    setCompletedSortBy(newSortBy);
    setCompletedSortOrder(newSortOrder);
    
    try {
      const response = await fetch(`/api/check-ins?coachId=${userProfile?.uid || 'demo-coach-id'}&status=completed&sortBy=${newSortBy}&sortOrder=${newSortOrder}`);
      const data = await response.json();
      if (data.success) {
        setCompletedCheckIns(data.data.checkIns);
      }
    } catch (error) {
      console.error('Error fetching sorted completed check-ins:', error);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'check-in': return '✅';
      case 'form-response': return '📝';
      case 'client-added': return '👤';
      case 'goal-achieved': return '🎯';
      default: return '📊';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'check-in': return 'text-green-600 bg-green-100';
      case 'form-response': return 'text-blue-600 bg-blue-100';
      case 'client-added': return 'text-purple-600 bg-purple-100';
      case 'goal-achieved': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex">
        {/* Modern Sidebar */}
        <div className="w-64 bg-white shadow-xl border-r border-gray-100">
          {/* Sidebar Header */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-6 py-8">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Coach Hub</h1>
                <p className="text-blue-100 text-sm">Dashboard</p>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="px-4 py-6">
            <div className="space-y-2">
              {/* Dashboard */}
              <Link
                href="/dashboard"
                className="flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-xl font-medium transition-all duration-200 shadow-sm border border-blue-100"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                  </svg>
                </div>
                <span>Dashboard</span>
              </Link>

              {/* Clients */}
              <Link
                href="/clients"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <span>Clients</span>
              </Link>

              {/* Messages */}
              <Link
                href="/messages"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span>Messages</span>
              </Link>

              {/* Check-ins */}
              <Link
                href="/check-ins"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span>Check-ins</span>
              </Link>

              {/* Responses */}
              <Link
                href="/responses"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span>Responses</span>
              </Link>

              {/* Analytics */}
              <Link
                href="/analytics"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span>Analytics</span>
              </Link>

              {/* Forms */}
              <Link
                href="/forms"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span>Forms</span>
              </Link>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-gray-200"></div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <h3 className="px-4 text-sm font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</h3>
              
              <Link
                href="/clients/create"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:text-green-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <span>Add Client</span>
              </Link>

              <Link
                href="/forms/create"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:text-purple-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <span>Create Form</span>
              </Link>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-gray-200"></div>

            {/* User Profile */}
            <div className="px-4">
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {userProfile?.firstName?.charAt(0) || 'C'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {userProfile?.firstName} {userProfile?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">Coach</p>
                </div>
                <button
                  onClick={logout}
                  className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center hover:bg-red-200 transition-colors"
                >
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Modern Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                  <p className="text-gray-600 mt-2">Welcome back, {coachData?.firstName || 'Coach'}!</p>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className={`p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors ${
                      refreshing ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Refresh Dashboard"
                  >
                    <svg className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <NotificationBell />
                  {coachData?.shortUID && (
                    <div className="flex items-center space-x-3 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Verification Code</p>
                        <p className="text-lg font-mono font-semibold text-blue-600 tracking-wider">{coachData.shortUID}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(coachData.shortUID);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                      >
                        {copiedCode ? (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* New Check-ins Notification Alert */}
              {unreadCount > 0 && (
                <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-blue-900 font-medium">
                        You have {unreadCount} new notification{unreadCount !== 1 ? 's' : ''} including completed check-ins!
                      </p>
                      <p className="text-blue-700 text-sm">Click the notification bell to view details</p>
                    </div>
                    <Link
                      href="/notifications"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      View All
                    </Link>
                  </div>
                </div>
              )}
              
              {/* Refresh Success Message */}
              {refreshed && (
                <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-green-900 font-medium">Dashboard refreshed successfully!</p>
                      <p className="text-green-700 text-sm">All data has been updated with the latest information</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Quick Summary Cards - Optimized */}
              <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Priority Actions */}
                <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-600 text-sm font-medium">Priority Actions</p>
                      <p className="text-2xl font-bold text-orange-900">{checkInsToReview.length}</p>
                      <p className="text-xs text-orange-700 mt-1">Check-ins to review</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Client Engagement */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-medium">Client Engagement</p>
                      <p className="text-2xl font-bold text-blue-900">{stats.activeClients}</p>
                      <p className="text-xs text-blue-700 mt-1">Active clients</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Platform Resources */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-600 text-sm font-medium">Platform Resources</p>
                      <p className="text-2xl font-bold text-purple-900">{stats.totalForms}</p>
                      <p className="text-xs text-purple-700 mt-1">Available forms</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Recent Activity */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm font-medium">Recent Activity</p>
                      <p className="text-2xl font-bold text-green-900">{completedCheckIns.length}</p>
                      <p className="text-xs text-green-700 mt-1">Completed this week</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-8">
                {/* Unified Check-ins Management */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-gray-900">Check-ins Management</h2>
                      <div className="flex items-center space-x-2">
                        {/* Tab Navigation */}
                        <div className="flex bg-white rounded-lg p-1 shadow-sm">
                          <button
                            onClick={() => setActiveTab('review')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              activeTab === 'review'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            To Review ({checkInsToReview.length})
                          </button>
                          <button
                            onClick={() => setActiveTab('completed')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              activeTab === 'completed'
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Completed ({completedCheckIns.length})
                          </button>
                        </div>
                        
                        {/* Sort Dropdown */}
                        <select
                          value={`${activeTab === 'review' ? sortBy : completedSortBy}-${activeTab === 'review' ? sortOrder : completedSortOrder}`}
                          onChange={(e) => {
                            const [newSortBy, newSortOrder] = e.target.value.split('-') as ['submittedAt' | 'clientName' | 'score', 'asc' | 'desc'];
                            if (activeTab === 'review') {
                              handleSortChange(newSortBy);
                            } else {
                              handleCompletedSortChange(newSortBy);
                            }
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="submittedAt-desc">Newest First</option>
                          <option value="submittedAt-asc">Oldest First</option>
                          <option value="clientName-asc">Client Name A-Z</option>
                          <option value="clientName-desc">Client Name Z-A</option>
                          <option value="score-desc">Highest Score</option>
                          <option value="score-asc">Lowest Score</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-8">
                    {/* To Review Tab */}
                    {activeTab === 'review' && (
                      <>
                        {checkInsToReview.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <p className="text-gray-500 text-lg mb-4">No check-ins to review</p>
                            <p className="text-gray-400 text-sm">Completed check-ins will appear here for your review</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {checkInsToReview.map((checkIn) => (
                              <div key={checkIn.id} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-200 hover:border-gray-300">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shadow-lg">
                                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-bold text-gray-900">{checkIn.clientName}</h3>
                                      <p className="text-gray-600">{checkIn.formTitle}</p>
                                      <p className="text-sm text-gray-500 mt-1">{formatTimeAgo(checkIn.submittedAt)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <div className="text-right">
                                      <div className="text-2xl font-bold text-gray-900">{checkIn.score}%</div>
                                      <div className="text-sm text-gray-500">Score</div>
                                    </div>
                                    <Link
                                      href={`/responses/${checkIn.id}`}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                    >
                                      Review
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Completed Tab */}
                    {activeTab === 'completed' && (
                      <>
                        {completedCheckIns.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-gray-500 text-lg mb-4">No completed check-ins yet</p>
                            <p className="text-gray-400 text-sm">Completed check-ins will appear here with scores and form details</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {completedCheckIns.slice(0, 10).map((checkIn) => (
                              <div key={checkIn.id} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 hover:shadow-lg transition-all duration-200 hover:border-green-300">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shadow-lg">
                                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-bold text-gray-900">{checkIn.clientName}</h3>
                                      <p className="text-gray-600 font-medium">{checkIn.formTitle}</p>
                                      <p className="text-sm text-gray-500 mt-1">{formatTimeAgo(checkIn.submittedAt)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <div className="text-right">
                                      <div className={`text-2xl font-bold ${
                                        checkIn.score >= 80 ? 'text-green-600' : 
                                        checkIn.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                                      }`}>
                                        {checkIn.score}%
                                      </div>
                                      <div className="text-sm text-gray-500">Score</div>
                                      <div className="text-xs text-gray-400 mt-1">
                                        {checkIn.answeredQuestions}/{checkIn.totalQuestions} questions
                                      </div>
                                    </div>
                                    <Link
                                      href={`/responses/${checkIn.id}`}
                                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                    >
                                      View Details
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {completedCheckIns.length > 10 && (
                              <div className="text-center pt-4">
                                <Link
                                  href="/check-ins"
                                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                                >
                                  View all {completedCheckIns.length} completed check-ins →
                                </Link>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Latest Client Photos */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-pink-50 to-rose-50 px-8 py-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-gray-900">Latest Client Photos</h2>
                      <Link
                        href="/clients"
                        className="text-pink-600 hover:text-pink-700 text-sm font-medium"
                      >
                        View All Clients
                      </Link>
                    </div>
                  </div>
                  <div className="p-8">
                    {clientPhotos.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 text-lg mb-4">No client photos yet</p>
                        <p className="text-gray-400 text-sm">Client photos will appear here as they're uploaded</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {clientPhotos.slice(0, 8).map((photo) => (
                          <div key={photo.id} className="group relative">
                            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden border border-gray-200 hover:border-pink-300 transition-all duration-200 hover:shadow-lg">
                              {/* Photo Placeholder - Replace with actual photo when available */}
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50">
                                <div className="text-center">
                                  <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                  <p className="text-xs text-pink-600 font-medium">{photo.clientName}</p>
                                </div>
                              </div>
                              
                              {/* Photo Type Badge */}
                              <div className="absolute top-2 left-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  photo.photoType === 'profile' ? 'bg-blue-100 text-blue-800' :
                                  photo.photoType === 'before' ? 'bg-orange-100 text-orange-800' :
                                  photo.photoType === 'after' ? 'bg-green-100 text-green-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                  {photo.photoType === 'profile' ? 'Profile' :
                                   photo.photoType === 'before' ? 'Before' :
                                   photo.photoType === 'after' ? 'After' :
                                   'Progress'}
                                </span>
                              </div>
                              
                              {/* Upload Time */}
                              <div className="absolute bottom-2 right-2">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-black bg-opacity-50 text-white">
                                  {formatTimeAgo(photo.uploadedAt)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <Link
                                href={`/clients/${photo.clientId}`}
                                className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                              >
                                View Client
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {clientPhotos.length > 8 && (
                      <div className="text-center pt-6">
                        <Link
                          href="/clients"
                          className="text-pink-600 hover:text-pink-700 text-sm font-medium"
                        >
                          View all {clientPhotos.length} client photos →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-8">
                {/* Forms Summary */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900">Forms Summary</h3>
                      <Link
                        href="/forms"
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                      >
                        View All
                      </Link>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total Forms</span>
                        <span className="text-lg font-bold text-gray-900">{stats.totalForms}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Standard Forms</span>
                        <span className="text-sm font-medium text-green-600">2</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Custom Forms</span>
                        <span className="text-sm font-medium text-blue-600">{Math.max(0, stats.totalForms - 2)}</span>
                      </div>
                      <div className="pt-4 border-t border-gray-100">
                        <Link
                          href="/forms/create"
                          className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Create New Form
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
                  </div>
                  <div className="p-6 space-y-3">
                    <Link
                      href="/clients/create"
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                    >
                      Add New Client
                    </Link>
                    <Link
                      href="/forms"
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                    >
                      Manage Forms
                    </Link>
                    <Link
                      href="/analytics"
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                    >
                      View Analytics
                    </Link>
                  </div>
                </div>

                {/* Performance Summary */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Performance Summary</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Monthly Growth</span>
                      <span className="font-bold text-gray-900">+{stats.monthlyGrowth}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Avg Engagement</span>
                      <span className="font-bold text-gray-900">{stats.avgEngagement}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Recent Check-ins</span>
                      <span className="font-bold text-gray-900">{stats.recentCheckIns}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 