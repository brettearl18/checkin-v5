'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import Image from 'next/image';
import CoachNavigation from '@/components/CoachNavigation';
import NotificationBell from '@/components/NotificationBell';
import AggregateMeasurementsPanel from '@/components/AggregateMeasurementsPanel';

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
  coachResponded?: boolean;
  workflowStatus?: 'completed' | 'reviewed' | 'responded';
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
  orientation?: 'front' | 'back' | 'side';
  uploadedAt: string;
  caption?: string;
}

interface QuestionResponse {
  questionId: string;
  question: string;
  answer: any;
  type: string;
  weight?: number;
  score?: number;
}

interface FormResponse {
  id: string;
  formTitle: string;
  submittedAt: any;
  completedAt: any;
  score?: number;
  totalQuestions: number;
  answeredQuestions: number;
  status: string;
  responses?: QuestionResponse[];
}

interface QuestionProgress {
  questionId: string;
  questionText: string;
  weeks: {
    week: number;
    date: string;
    score: number;
    status: 'red' | 'orange' | 'green';
    answer: any;
    type: string;
  }[];
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
  const [allClients, setAllClients] = useState<any[]>([]);
  const [clientTableSortBy, setClientTableSortBy] = useState<string>('name');
  const [clientTableSortOrder, setClientTableSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedClientForProgress, setSelectedClientForProgress] = useState<string | null>(null);
  const [questionProgress, setQuestionProgress] = useState<any[]>([]);
  const [loadingQuestionProgress, setLoadingQuestionProgress] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<{
    question: string;
    answer: any;
    score: number;
    date: string;
    week: number;
    type: string;
  } | null>(null);

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
      if (!userProfile?.uid) {
        console.error('No user profile found');
        return;
      }
      const coachId = userProfile.uid;
      
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
      setAllClients(clients);
      setAllClients(clients);

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
        if ('status' in formsResponse && 'statusText' in formsResponse) {
          console.warn('Failed to fetch forms:', formsResponse.status, formsResponse.statusText);
        } else {
          console.warn('Failed to fetch forms');
        }
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
      
      // Fetch real progress images for coach's clients
      try {
        const photosResponse = await fetch(`/api/progress-images?coachId=${coachId}&limit=8`);
        if (photosResponse.ok) {
          const photosData = await photosResponse.json();
          if (photosData.success && photosData.data) {
            const realPhotos: ClientPhoto[] = photosData.data.map((img: any) => ({
              id: img.id,
              clientId: img.clientId,
              clientName: img.clientName || 'Client',
              photoUrl: img.imageUrl,
              photoType: img.imageType,
              orientation: img.orientation,
              uploadedAt: img.uploadedAt || new Date().toISOString(),
              caption: img.caption || ''
            }));
            setClientPhotos(realPhotos);
          } else {
            setClientPhotos([]);
          }
        } else {
          setClientPhotos([]);
        }
      } catch (error) {
        console.error('Error fetching progress images:', error);
        setClientPhotos([]);
      }
      
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

  // Fetch question progress when a client is selected
  useEffect(() => {
    if (selectedClientForProgress) {
      fetchQuestionProgress(selectedClientForProgress);
    } else {
      // Auto-select first client with recent check-ins if available
      if (completedCheckIns.length > 0 && !selectedClientForProgress) {
        const firstClientId = completedCheckIns[0]?.clientId;
        if (firstClientId) {
          setSelectedClientForProgress(firstClientId);
        }
      }
    }
  }, [selectedClientForProgress, completedCheckIns]);

  const fetchQuestionProgress = async (clientId: string) => {
    if (!clientId) return;
    
    try {
      setLoadingQuestionProgress(true);
      const response = await fetch(`/api/client-portal/history?clientId=${clientId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch question progress data');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch question progress data');
      }

      const responsesData: FormResponse[] = data.history || [];
      processQuestionProgress(responsesData);
    } catch (error) {
      console.error('Error fetching question progress:', error);
      setQuestionProgress([]);
    } finally {
      setLoadingQuestionProgress(false);
    }
  };

  const processQuestionProgress = (responses: FormResponse[]) => {
    // Group responses by week
    const sortedResponses = [...responses]
      .filter(r => r.responses && Array.isArray(r.responses) && r.responses.length > 0)
      .sort((a, b) => {
        const dateA = new Date(a.submittedAt);
        const dateB = new Date(b.submittedAt);
        return dateA.getTime() - dateB.getTime();
      });

    if (sortedResponses.length === 0) {
      setQuestionProgress([]);
      return;
    }

    // Get all unique questions
    const questionMap = new Map<string, { questionId: string; questionText: string }>();
    
    sortedResponses.forEach(response => {
      if (response.responses && Array.isArray(response.responses)) {
        response.responses.forEach((qResp: QuestionResponse) => {
          if (qResp.questionId && !questionMap.has(qResp.questionId)) {
            questionMap.set(qResp.questionId, {
              questionId: qResp.questionId,
              questionText: qResp.question || `Question ${qResp.questionId.slice(0, 8)}`
            });
          }
        });
      }
    });

    // Create progress data for each question
    const progress: QuestionProgress[] = Array.from(questionMap.values()).map(question => {
      const weeks = sortedResponses.map((response, index) => {
        // Find this question's response in this check-in
        const qResponse = response.responses?.find(
          (r: QuestionResponse) => r.questionId === question.questionId
        );

        if (!qResponse) {
          return null;
        }

        // Get score (0-10 scale typically)
        const score = qResponse.score || 0;
        
        // Determine status based on score
        // Green: 7-10, Orange: 4-6, Red: 0-3
        let status: 'red' | 'orange' | 'green';
        if (score >= 7) {
          status = 'green';
        } else if (score >= 4) {
          status = 'orange';
        } else {
          status = 'red';
        }

        const responseDate = new Date(response.submittedAt);
        
        return {
          week: index + 1,
          date: responseDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          score: score,
          status: status,
          answer: qResponse.answer,
          type: qResponse.type || 'text'
        };
      }).filter(w => w !== null) as { week: number; date: string; score: number; status: 'red' | 'orange' | 'green'; answer: any; type: string }[];

      return {
        questionId: question.questionId,
        questionText: question.questionText,
        weeks: weeks
      };
    });

    setQuestionProgress(progress);
  };

  const getStatusColor = (status: 'red' | 'orange' | 'green') => {
    switch (status) {
      case 'green':
        return 'bg-green-500';
      case 'orange':
        return 'bg-orange-500';
      case 'red':
        return 'bg-red-500';
    }
  };

  const getStatusBorder = (status: 'red' | 'orange' | 'green') => {
    switch (status) {
      case 'green':
        return 'border-green-600';
      case 'orange':
        return 'border-orange-600';
      case 'red':
        return 'border-red-600';
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
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col lg:flex-row">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between px-4 py-4 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm lg:hidden">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-semibold">
              CH
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Coach Hub</p>
              <p className="text-xs text-gray-500">Dashboard</p>
            </div>
          </div>
          {/* Notification + Hamburger on mobile */}
          <div className="flex items-center space-x-1">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label="Open navigation menu"
            >
              <span className="sr-only">Open menu</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile slide-in navigation */}
        {isMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="w-64 bg-white shadow-2xl h-full flex flex-col p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-9 h-9 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-semibold">
                    CH
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Coach Hub</p>
                    <p className="text-xs text-gray-500">Navigation</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Close navigation menu"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="mt-6 space-y-2 flex-1">
                <Link
                  href="/dashboard"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-2xl text-sm font-medium text-gray-900 bg-orange-50 border-l-4 border-orange-500"
                >
                  Dashboard
                </Link>
                <Link
                  href="/clients"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-2xl text-sm font-medium text-gray-700 hover:bg-orange-50 transition-colors"
                >
                  Clients
                </Link>
                <Link
                  href="/check-ins"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-2xl text-sm font-medium text-gray-700 hover:bg-orange-50 transition-colors"
                >
                  Check-ins
                </Link>
                <Link
                  href="/forms"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-2xl text-sm font-medium text-gray-700 hover:bg-orange-50 transition-colors"
                >
                  Forms
                </Link>
                <Link
                  href="/analytics"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-2xl text-sm font-medium text-gray-700 hover:bg-orange-50 transition-colors"
                >
                  Analytics
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-2 rounded-2xl text-sm font-medium text-gray-700 hover:bg-orange-50 transition-colors"
                >
                  Settings
                </Link>
              </nav>

              {/* Verification code in mobile menu footer */}
              {coachData?.shortUID && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Verification code</p>
                  <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                    <p className="text-sm font-mono font-semibold text-blue-700 tracking-widest">
                      {coachData.shortUID}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(coachData.shortUID);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="ml-2 px-2 py-1 text-xs font-medium rounded-xl bg-orange-500 text-white hover:bg-orange-600"
                    >
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Backdrop */}
            <button
              type="button"
              className="flex-1 bg-black/30"
              aria-label="Close navigation menu"
              onClick={() => setIsMenuOpen(false)}
            />
          </div>
        )}

        {/* Desktop sidebar */}
        <div className={`hidden lg:flex ${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-r border-gray-100 flex-col transition-all duration-300 ease-in-out`}>
          {/* Sidebar Header */}
          <div className={`bg-[#daa450] ${isSidebarCollapsed ? 'px-2 py-4' : 'px-6 py-8'} relative`}>
            {!isSidebarCollapsed ? (
              <>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-white font-bold text-lg">Coach Hub</h1>
                    <p className="text-orange-100 text-sm">Dashboard</p>
                  </div>
                </div>
                {/* Collapse/Expand Toggle Button - Expanded State */}
                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="absolute top-4 right-4 w-8 h-8 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg flex items-center justify-center transition-all duration-200"
                  title="Collapse sidebar"
                >
                  <svg 
                    className="w-5 h-5 text-white" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                {/* Collapsed State - Logo and Toggle Button Stacked */}
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  {/* Collapse/Expand Toggle Button - Collapsed State */}
                  <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="w-8 h-8 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg flex items-center justify-center transition-all duration-200"
                    title="Expand sidebar"
                  >
                    <svg 
                      className="w-5 h-5 text-white rotate-180" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="px-4 py-6 flex-1 flex flex-col">
            <div className="space-y-2 flex-1">
              {/* Dashboard */}
              <Link
                href="/dashboard"
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 bg-orange-50 text-orange-700 rounded-2xl font-medium transition-all duration-200 border-l-4 border-orange-500 group relative`}
                title={isSidebarCollapsed ? 'Dashboard' : ''}
              >
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span>Dashboard</span>}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    Dashboard
                  </div>
                )}
              </Link>

              {/* Clients */}
              <Link
                href="/clients"
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200 group relative`}
                title={isSidebarCollapsed ? 'Clients' : ''}
              >
                <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span>Clients</span>}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    Clients
                  </div>
                )}
              </Link>

              {/* Messages */}
              <Link
                href="/messages"
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200 group relative`}
                title={isSidebarCollapsed ? 'Messages' : ''}
              >
                <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span>Messages</span>}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    Messages
                  </div>
                )}
              </Link>

              {/* Check-ins */}
              <Link
                href="/check-ins"
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200 group relative`}
                title={isSidebarCollapsed ? 'Check-ins' : ''}
              >
                <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span>Check-ins</span>}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    Check-ins
                  </div>
                )}
              </Link>

              {/* Responses */}
              <Link
                href="/responses"
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200 group relative`}
                title={isSidebarCollapsed ? 'Responses' : ''}
              >
                <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span>Responses</span>}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    Responses
                  </div>
                )}
              </Link>

              {/* Analytics */}
              <Link
                href="/analytics"
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200 group relative`}
                title={isSidebarCollapsed ? 'Analytics' : ''}
              >
                <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span>Analytics</span>}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    Analytics
                  </div>
                )}
              </Link>

              {/* Forms */}
              <Link
                href="/forms"
                className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200 group relative`}
                title={isSidebarCollapsed ? 'Forms' : ''}
              >
                <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                {!isSidebarCollapsed && <span>Forms</span>}
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    Forms
                  </div>
                )}
              </Link>
            </div>

            {/* Divider */}
            {!isSidebarCollapsed && <div className="my-6 border-t border-gray-200"></div>}

            {/* Quick Actions */}
            {!isSidebarCollapsed && (
              <div className="space-y-2">
                <h3 className="px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Quick Actions</h3>
                
                <Link
                  href="/clients/create"
                  className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200 group relative"
                  title={isSidebarCollapsed ? 'Add Client' : ''}
                >
                  <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <span>Add Client</span>
                </Link>

                <Link
                  href="/forms/create"
                  className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200 group relative"
                  title={isSidebarCollapsed ? 'Create Form' : ''}
                >
                  <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <span>Create Form</span>
                </Link>
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="space-y-2">
                <Link
                  href="/clients/create"
                  className="flex items-center justify-center px-2 py-3 text-gray-700 hover:bg-[#fef9e7] hover:text-[#daa450] rounded-xl font-medium transition-all duration-200 group relative"
                  title="Add Client"
                >
                  <div className="w-8 h-8 bg-[#fef9e7] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#daa450] transition-all duration-200">
                    <svg className="w-4 h-4 text-[#daa450] group-hover:text-white transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    Add Client
                  </div>
                </Link>

                <Link
                  href="/forms/create"
                  className="flex items-center justify-center px-2 py-3 text-gray-700 hover:bg-[#fef9e7] hover:text-[#daa450] rounded-xl font-medium transition-all duration-200 group relative"
                  title="Create Form"
                >
                  <div className="w-8 h-8 bg-[#fef9e7] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-[#daa450] transition-all duration-200">
                    <svg className="w-4 h-4 text-[#daa450] group-hover:text-white transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                    Create Form
                  </div>
                </Link>
              </div>
            )}

            {/* Divider */}
            {!isSidebarCollapsed && <div className="my-6 border-t border-gray-200"></div>}

            {/* User Profile */}
            <div className={`${isSidebarCollapsed ? 'px-2' : 'px-4'} mt-auto`}>
              <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} p-3 bg-gradient-to-r from-gray-50 to-[#fef9e7] rounded-xl border border-gray-200 transition-all duration-200`}>
                <div className="w-10 h-10 bg-[#daa450] rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200">
                  <span className="text-white font-bold text-sm">
                    {userProfile?.firstName?.charAt(0) || 'C'}
                  </span>
                </div>
                {!isSidebarCollapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {userProfile?.firstName} {userProfile?.lastName}
                      </p>
                      <p className="text-xs text-gray-700">Coach</p>
                    </div>
                    <button
                      onClick={logout}
                      className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center hover:bg-red-200 transition-colors flex-shrink-0"
                      title="Logout"
                    >
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                  </>
                )}
                {isSidebarCollapsed && (
                  <button
                    onClick={logout}
                    className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center hover:bg-red-200 transition-colors flex-shrink-0"
                    title="Logout"
                  >
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <div className="max-w-6xl mx-auto w-full">
            {/* Modern Header */}
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Dashboard</h1>
                  <p className="text-gray-600 mt-1 text-sm sm:text-base">
                    Welcome back, {coachData?.firstName || 'Coach'}!
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  {/* Coach's Code */}
                  {coachData?.shortUID && (
                    <div className="hidden md:flex items-center space-x-2 bg-[#fef9e7] border border-[#daa450]/20 rounded-xl px-4 py-2 shadow-sm">
                      <span className="text-xs font-semibold text-[#daa450]">Coach's Code:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono font-bold text-gray-900 tracking-wider">
                          {coachData.shortUID}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(coachData.shortUID);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          className="p-1.5 hover:bg-[#daa450]/10 rounded-lg transition-colors duration-200"
                          title="Copy code"
                        >
                          {copiedCode ? (
                            <svg className="w-4 h-4 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-[#daa450]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className={`p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-2xl transition-colors ${
                      refreshing ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Refresh Dashboard"
                  >
                    <svg
                      className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  {/* Desktop-only bell (mobile uses top bar) */}
                  <div className="hidden lg:block">
                    <NotificationBell />
                  </div>
                </div>
              </div>
              
              {/* Quick Summary – mobile: compact row of 4 buttons */}
              <div className="mb-6 flex gap-3 overflow-x-auto pb-1 md:hidden">
                <button className="flex-shrink-0 min-w-[150px] bg-orange-50 border border-orange-200 rounded-2xl px-4 py-4 text-left">
                  <p className="text-xs font-medium text-orange-700">Needs response</p>
                  <p className="mt-1 text-xl font-bold text-orange-900">
                    {checkInsToReview.filter(ci => !ci.coachResponded).length}
                  </p>
                </button>

                <button className="flex-shrink-0 min-w-[150px] bg-white border border-gray-200 rounded-2xl px-4 py-4 text-left">
                  <p className="text-xs font-medium text-gray-700">Active clients</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {stats.activeClients}
                  </p>
                </button>

                <button className="flex-shrink-0 min-w-[150px] bg-white border border-gray-200 rounded-2xl px-4 py-4 text-left">
                  <p className="text-xs font-medium text-gray-700">Forms</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {stats.totalForms}
                  </p>
                </button>

                <button className="flex-shrink-0 min-w-[150px] bg-[#34C759]/10 border border-[#34C759]/20 rounded-2xl px-4 py-4 text-left">
                  <p className="text-xs font-medium text-[#34C759]">Completed this week</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">
                    {completedCheckIns.length}
                  </p>
                </button>
              </div>

              {/* Desktop summary – keep rich cards */}
              <div className="hidden md:grid mb-8 grid-cols-4 gap-6">
                {/* Priority Actions */}
                <div className="bg-orange-50 border border-orange-200 rounded-3xl p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-600 text-sm font-medium">Needs Response</p>
                      <p className="text-2xl font-bold text-orange-900">
                        {checkInsToReview.filter(ci => !ci.coachResponded).length}
                      </p>
                      <p className="text-xs text-orange-700 mt-1">Awaiting your feedback</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Client Engagement */}
                <div className="bg-white border border-gray-200 rounded-3xl p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Client Engagement</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.activeClients}</p>
                      <p className="text-xs text-gray-500 mt-1">Active clients</p>
                    </div>
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Platform Resources */}
                <div className="bg-white border border-gray-200 rounded-3xl p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">Platform Resources</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalForms}</p>
                      <p className="text-xs text-gray-500 mt-1">Available forms</p>
                    </div>
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Recent Activity */}
                <div className="bg-[#34C759]/10 border border-[#34C759]/20 rounded-3xl p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#34C759] text-sm font-medium">Recent Activity</p>
                      <p className="text-2xl font-bold text-gray-900">{completedCheckIns.length}</p>
                      <p className="text-xs text-gray-500 mt-1">Completed this week</p>
                    </div>
                    <div className="w-12 h-12 bg-[#34C759]/20 rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-10">
              {/* Main Content */}
              <div className="space-y-10">
                {/* Weight & Measurements Tracking */}
                {userProfile?.uid && (
                  <AggregateMeasurementsPanel coachId={userProfile.uid} />
                )}

                {/* Unified Check-ins Management */}
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
                  <div className="bg-[#fef9e7] px-10 py-8 border-b-2 border-[#daa450]/20">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-gray-900">Check-ins Management</h2>
                      <div className="flex items-center space-x-2">
                        {/* Tab Navigation */}
                        <div className="flex bg-white rounded-2xl p-1 shadow-sm text-xs md:text-sm">
                          <button
                            onClick={() => setActiveTab('review')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                              activeTab === 'review'
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                          >
                            To Review ({checkInsToReview.length})
                          </button>
                          <button
                            onClick={() => setActiveTab('completed')}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                              activeTab === 'completed'
                                ? 'bg-[#34C759] text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
                          className="px-3 py-2 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
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
                  
                  <div className="p-4 md:p-8">
                    {/* To Review Tab */}
                    {activeTab === 'review' && (
                      <>
                        {checkInsToReview.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <p className="text-gray-700 text-lg mb-4">No check-ins to review</p>
                            <p className="text-gray-600 text-sm">Completed check-ins will appear here for your review</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {checkInsToReview.map((checkIn) => {
                              const needsResponse = !checkIn.coachResponded;
                              // consider a check-in overdue if it's older than 24h and still needs a response
                              const submittedAtDate = checkIn.submittedAt ? new Date(checkIn.submittedAt as any) : null;
                              const hoursSince =
                                submittedAtDate ? Math.floor((Date.now() - submittedAtDate.getTime()) / (1000 * 60 * 60)) : 0;
                              const isOverdue = needsResponse && hoursSince >= 24;

                              return (
                                <div
                                  key={checkIn.id}
                                  className={`rounded-2xl p-5 md:p-6 border hover:shadow-sm transition-all duration-200 ${
                                    needsResponse 
                                      ? 'bg-orange-50 border-orange-200 hover:border-orange-300' 
                                      : 'bg-white border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 md:space-x-4 flex-1">
                                      <div
                                        className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center ${
                                          isOverdue
                                            ? 'bg-[#FF3B30]/10'
                                            : needsResponse
                                            ? 'bg-orange-100'
                                            : 'bg-[#34C759]/10'
                                        }`}
                                      >
                                        {isOverdue ? (
                                          <svg
                                            className="w-5 h-5 md:w-6 md:h-6 text-[#FF3B30]"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M12 9v4m0 4h.01M12 5a7 7 0 00-7 7v0a7 7 0 0014 0v0a7 7 0 00-7-7z"
                                            />
                                          </svg>
                                        ) : needsResponse ? (
                                          <svg
                                            className="w-5 h-5 md:w-6 h-6 text-orange-600"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M12 8v4l2 2m-2-2H9m3-7a7 7 0 00-7 7v3l-1.5 1.5M19.5 19.5L18 17"
                                            />
                                          </svg>
                                        ) : (
                                          <svg
                                            className="w-5 h-5 md:w-6 md:h-6 text-[#34C759]"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                          </svg>
                                        )}
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                          <h3 className="text-sm md:text-base font-semibold text-gray-900">
                                            {checkIn.clientName}
                                          </h3>
                                        </div>
                                        <p className="text-gray-600 text-xs md:text-sm">
                                          {checkIn.formTitle}
                                        </p>
                                        <p className="text-[11px] md:text-xs text-gray-700 mt-1">
                                          {formatTimeAgo(checkIn.submittedAt)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-3 md:space-x-4">
                                      <div className="text-right">
                                        <div className="text-lg md:text-xl font-bold text-gray-900">
                                          {checkIn.score}%
                                        </div>
                                        <div className="text-[11px] md:text-xs text-gray-700">Score</div>
                                      </div>
                                      <Link
                                        href={`/responses/${checkIn.id}`}
                                        className={`px-4 py-2 rounded-2xl hover:opacity-90 transition-all duration-200 text-xs md:text-sm font-medium shadow-sm ${
                                          needsResponse 
                                            ? 'bg-orange-500 text-white hover:bg-orange-600' 
                                            : 'bg-[#007AFF] text-white hover:bg-[#0051D5]'
                                        }`}
                                      >
                                        {needsResponse ? 'Respond' : 'View'}
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
                            <p className="text-gray-700 text-lg mb-4">No completed check-ins yet</p>
                            <p className="text-gray-600 text-sm">Completed check-ins will appear here with scores and form details</p>
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
                                      <p className="text-sm text-gray-700 mt-1">{formatTimeAgo(checkIn.submittedAt)}</p>
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
                                      <div className="text-sm text-gray-700">Score</div>
                                      <div className="text-xs text-gray-600 mt-1">
                                        {checkIn.answeredQuestions}/{checkIn.totalQuestions} questions
                                      </div>
                                    </div>
                                    <Link
                                      href={`/responses/${checkIn.id}`}
                                      className="px-4 py-2 bg-[#007AFF] text-white rounded-2xl hover:bg-[#0051D5] transition-all duration-200 text-sm font-medium shadow-sm"
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
                                  className="text-orange-600 hover:text-orange-700 text-sm font-medium"
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
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-orange-50 px-10 py-8 border-b-2 border-orange-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-gray-900">Latest Client Photos</h2>
                      <Link
                        href="/clients/photos"
                        className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                      >
                        View All Photos
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
                        <p className="text-gray-700 text-lg mb-4">No client photos yet</p>
                        <p className="text-gray-400 text-sm">Client photos will appear here as they're uploaded</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
                        {clientPhotos.slice(0, 16).map((photo) => (
                          <div key={photo.id} className="group relative">
                            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden border border-gray-200 hover:border-orange-300 transition-all duration-200 hover:shadow-sm">
                              {/* Actual Photo Thumbnail */}
                              <Image
                                src={photo.photoUrl}
                                alt={`${photo.clientName} - ${photo.photoType}`}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                unoptimized={photo.photoUrl?.includes('firebase') ? false : undefined}
                                onError={(e) => {
                                  // Fallback to placeholder if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const placeholder = target.nextElementSibling as HTMLElement;
                                  if (placeholder) {
                                    placeholder.style.display = 'flex';
                                  }
                                }}
                              />
                              {/* Fallback Placeholder - Hidden by default, shown if image fails */}
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50 absolute inset-0" style={{ display: 'none' }}>
                                <div className="text-center">
                                  <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                  <p className="text-xs text-pink-600 font-medium">{photo.clientName}</p>
                                </div>
                              </div>
                              
                              {/* Photo Type and Orientation Badges */}
                              <div className="absolute top-2 left-2 flex flex-col gap-1">
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
                                {photo.orientation && (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    photo.orientation === 'front' ? 'bg-pink-100 text-pink-800' :
                                    photo.orientation === 'back' ? 'bg-indigo-100 text-indigo-800' :
                                    'bg-teal-100 text-teal-800'
                                  }`}>
                                    {photo.orientation.charAt(0).toUpperCase() + photo.orientation.slice(1)}
                                  </span>
                                )}
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
                    
                    {clientPhotos.length > 16 && (
                      <div className="text-center pt-6">
                        <Link
                          href="/clients/photos"
                          className="text-pink-600 hover:text-pink-700 text-sm font-medium"
                        >
                          View all {clientPhotos.length} client photos →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary Cards Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Forms Summary */}
                  <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">Forms Summary</h3>
                        <Link
                          href="/forms"
                          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                        >
                          View All
                        </Link>
                      </div>
                    </div>
                    <div className="p-8">
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Total Forms</span>
                          <span className="text-xl font-bold text-gray-900">{stats.totalForms}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Standard Forms</span>
                          <span className="text-sm font-medium text-[#34C759]">2</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Custom Forms</span>
                          <span className="text-sm font-medium text-[#007AFF]">{Math.max(0, stats.totalForms - 2)}</span>
                        </div>
                        <div className="pt-5 border-t border-gray-100">
                          <Link
                            href="/forms/create"
                            className="w-full flex items-center justify-center px-4 py-3 bg-orange-500 text-white rounded-2xl hover:bg-orange-600 transition-all duration-200 text-sm font-medium shadow-sm"
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
                  <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                      <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
                    </div>
                    <div className="p-8 space-y-4">
                      <Link
                        href="/clients/create"
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm block"
                      >
                        Add New Client
                      </Link>
                      <Link
                        href="/forms"
                        className="w-full bg-white border-2 border-gray-200 hover:border-orange-300 text-gray-700 hover:text-orange-700 px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 block"
                      >
                        Manage Forms
                      </Link>
                      <Link
                        href="/analytics"
                        className="w-full bg-white border-2 border-gray-200 hover:border-orange-300 text-gray-700 hover:text-orange-700 px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 block"
                      >
                        View Analytics
                      </Link>
                    </div>
                  </div>

                  {/* Performance Summary */}
                  <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                      <h3 className="text-lg font-bold text-gray-900">Performance Summary</h3>
                    </div>
                    <div className="p-8 space-y-5">
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

                {/* Question Progress Grid */}
                {questionProgress.length > 0 && (
                  <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="bg-orange-50 px-10 py-8 border-b-2 border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">Question Progress Over Time</h2>
                          <p className="text-sm text-gray-600 mt-1">Track how each question improves week by week</p>
                        </div>
                        {/* Client Selector */}
                        {completedCheckIns.length > 0 && (
                          <select
                            value={selectedClientForProgress || ''}
                            onChange={(e) => setSelectedClientForProgress(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                          >
                            {Array.from(new Set(completedCheckIns.map(ci => ({ id: ci.clientId, name: ci.clientName }))))
                              .map((client, idx) => (
                                <option key={idx} value={client.id}>{client.name}</option>
                              ))}
                          </select>
                        )}
                      </div>
                    </div>
                    
                    {/* Legend */}
                    <div className="flex items-center gap-3 px-6 py-3 bg-gray-50/50 border-b border-gray-100">
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                        <span className="text-[10px] text-gray-600 font-medium">Good (7-10)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                        <span className="text-[10px] text-gray-600 font-medium">Moderate (4-6)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        <span className="text-[10px] text-gray-600 font-medium">Needs Attention (0-3)</span>
                      </div>
                    </div>

                    {/* Progress Grid */}
                    {loadingQuestionProgress ? (
                      <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                        <p className="text-gray-500 text-sm">Loading question progress...</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10">
                            <tr className="bg-gray-50/30">
                              <th className="text-left py-1.5 px-3 font-semibold text-[10px] text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50/95 backdrop-blur-sm z-20 min-w-[160px] border-r border-gray-100">
                                Question
                              </th>
                              {questionProgress[0]?.weeks.map((week: any, index: number) => (
                                <th
                                  key={index}
                                  className="text-center py-1.5 px-1 font-semibold text-[10px] text-gray-600 uppercase tracking-wider min-w-[60px]"
                                >
                                  <div className="flex flex-col items-center">
                                    <span className="text-[9px] text-gray-500 font-medium">W{week.week}</span>
                                    <span className="text-[9px] text-gray-400">{week.date}</span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {questionProgress.map((question, qIndex) => (
                              <tr 
                                key={question.questionId} 
                                className={`transition-colors hover:bg-gray-50/50 ${
                                  qIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                                }`}
                              >
                                <td className="py-1.5 px-3 text-xs font-medium text-gray-900 sticky left-0 bg-inherit z-10 border-r border-gray-100">
                                  <div className="max-w-[160px] line-clamp-2 leading-tight">
                                    {question.questionText}
                                  </div>
                                </td>
                                {question.weeks.map((week: any, wIndex: number) => (
                                  <td
                                    key={wIndex}
                                    className="text-center py-1.5 px-1"
                                  >
                                    <div
                                      className={`w-6 h-6 rounded-full ${getStatusColor(week.status)} ${getStatusBorder(week.status)} flex items-center justify-center transition-all hover:scale-125 cursor-pointer shadow-sm mx-auto`}
                                      title={`Week ${week.week}: Score ${week.score}/10 - ${week.date}`}
                                      onClick={() => setSelectedResponse({
                                        question: question.questionText,
                                        answer: week.answer,
                                        score: week.score,
                                        date: week.date,
                                        week: week.week,
                                        type: week.type
                                      })}
                                    >
                                      <span className="text-white text-[9px] font-bold">{week.score}</span>
                                    </div>
                                  </td>
                                ))}
                                {/* Fill empty weeks if needed */}
                                {Array.from({ length: Math.max(0, (questionProgress[0]?.weeks.length || 0) - question.weeks.length) }).map((_, emptyIndex) => (
                                  <td key={`empty-${emptyIndex}`} className="text-center py-1.5 px-1">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 mx-auto"></div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Answer Detail Modal */}
                {selectedResponse && (
                  <div 
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedResponse(null)}
                  >
                    <div 
                      className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900">Question Response</h3>
                        <button
                          onClick={() => setSelectedResponse(null)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Question</p>
                          <p className="text-gray-900">{selectedResponse.question}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Client's Answer</p>
                          <div className="bg-gray-50 rounded-lg p-3">
                            {selectedResponse.type === 'boolean' ? (
                              <p className="text-gray-900 font-medium">
                                {selectedResponse.answer === true || selectedResponse.answer === 'true' ? 'Yes' : 'No'}
                              </p>
                            ) : selectedResponse.type === 'scale' || selectedResponse.type === 'rating' ? (
                              <p className="text-gray-900 font-medium">
                                {selectedResponse.answer} / 10
                              </p>
                            ) : selectedResponse.type === 'number' ? (
                              <p className="text-gray-900 font-medium">
                                {selectedResponse.answer}
                              </p>
                            ) : Array.isArray(selectedResponse.answer) ? (
                              <p className="text-gray-900 font-medium">
                                {selectedResponse.answer.join(', ')}
                              </p>
                            ) : (
                              <p className="text-gray-900 font-medium">
                                {String(selectedResponse.answer)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Score</p>
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full ${getStatusColor(
                                selectedResponse.score >= 7 ? 'green' : selectedResponse.score >= 4 ? 'orange' : 'red'
                              )} ${getStatusBorder(
                                selectedResponse.score >= 7 ? 'green' : selectedResponse.score >= 4 ? 'orange' : 'red'
                              )} flex items-center justify-center`}>
                                <span className="text-white text-xs font-bold">{selectedResponse.score}</span>
                              </div>
                              <span className="text-gray-900 font-medium">{selectedResponse.score}/10</span>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">Date</p>
                            <p className="text-gray-900 font-medium">Week {selectedResponse.week}</p>
                            <p className="text-sm text-gray-600">{selectedResponse.date}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={() => setSelectedResponse(null)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
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