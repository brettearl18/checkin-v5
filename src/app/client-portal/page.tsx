'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import {
  getTrafficLightStatus,
  getTrafficLightIcon,
  getTrafficLightLabel,
  getTrafficLightColor,
  getDefaultThresholds,
  convertLegacyThresholds,
  type ScoringThresholds,
  type TrafficLightStatus
} from '@/lib/scoring-utils';
import {
  isWithinCheckInWindow,
  DEFAULT_CHECK_IN_WINDOW,
  type CheckInWindow
} from '@/lib/checkin-window-utils';
import QuickStatsBar from '@/components/client-portal/QuickStatsBar';

interface ClientStats {
  overallProgress: number;
  completedCheckins: number;
  totalCheckins: number;
  averageScore: number;
}

interface CheckIn {
  id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue' | 'missed';
  formId: string;
  checkInWindow?: CheckInWindow;
  extensionGranted?: boolean;
}

interface RecentResponse {
  id: string;
  checkInTitle: string;
  submittedAt: string;
  score: number;
  status: 'completed' | 'pending';
  hasFeedback?: boolean;
  feedbackCount?: number;
  responseId?: string;
  formTitle?: string;
  clientApproved?: boolean;
}

interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialization?: string;
}

interface ProgressImage {
  id: string;
  clientId: string;
  clientName: string;
  imageUrl: string;
  imageType: 'profile' | 'before' | 'after' | 'progress';
  orientation?: 'front' | 'back' | 'side';
  caption?: string;
  uploadedAt: string;
}

interface RecentInvoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
}

// Progress Images Preview Component
function ProgressImagesPreview({ clientEmail, clientId: providedClientId }: { clientEmail?: string; clientId?: string | null }) {
  const [images, setImages] = useState<ProgressImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(providedClientId || null);

  useEffect(() => {
    // If clientId is provided directly, use it and skip email fetch
    if (providedClientId) {
      setClientId(providedClientId);
      return;
    }

    // Otherwise, fetch client ID from email (only if clientEmail is provided)
    if (!clientEmail) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    (async () => {
      try {
        const headers = await import('@/lib/auth-headers').then(m => m.getAuthHeaders());
        const res = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(clientEmail)}`, {
          signal: controller.signal,
          headers
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (data.success && data.data.client) {
          setClientId(data.data.client.id);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (process.env.NODE_ENV === 'development' && err.name !== 'AbortError' && err.message !== 'Failed to fetch') {
          console.debug('Error fetching client ID for progress images:', err);
        }
        setLoading(false);
      }
    })();
  }, [clientEmail, providedClientId]);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    (async () => {
      try {
        const headers = await import('@/lib/auth-headers').then(m => m.getAuthHeaders());
        const res = await fetch(`/api/progress-images?clientId=${clientId}&limit=4`, {
          signal: controller.signal,
          headers
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (data.success) setImages(data.data || []);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (process.env.NODE_ENV === 'development' && err.name !== 'AbortError' && err.message !== 'Failed to fetch') {
          console.debug('Error fetching progress images:', err);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-2">
          <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-700 text-sm mb-1">No progress images yet</p>
        <p className="text-gray-600 text-xs">Upload photos to track your journey</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {images.map((image) => (
          <div key={image.id} className="flex flex-col">
            <div className="group relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200/60 hover:border-pink-400/80 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-white/50 backdrop-blur-sm cursor-pointer"
              onClick={(e) => {
                window.location.href = `/client-portal/progress-images?scrollTo=${image.id}`;
              }}
            >
              <img
                src={image.imageUrl}
                alt={image.caption || image.imageType}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(`
                    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="200" fill="#f3f4f6"/>
                      <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#9ca3af" text-anchor="middle" dy=".3em">Image</text>
                    </svg>
                  `)}`;
                }}
              />
              <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  image.imageType === 'profile' ? 'bg-blue-100 text-blue-800' :
                  image.imageType === 'before' ? 'bg-orange-100 text-orange-800' :
                  image.imageType === 'after' ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {image.imageType === 'profile' ? 'Profile' :
                   image.imageType === 'before' ? 'Before' :
                   image.imageType === 'after' ? 'After' :
                   'Progress'}
                </span>
                {image.orientation && (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    image.orientation === 'front' ? 'bg-pink-100 text-pink-800' :
                    image.orientation === 'back' ? 'bg-indigo-100 text-indigo-800' :
                    'bg-teal-100 text-teal-800'
                  }`}>
                    {image.orientation.charAt(0).toUpperCase() + image.orientation.slice(1)}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2 text-center">
              <p className="text-gray-700 text-sm font-semibold">
                {new Date(image.uploadedAt).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DashboardAnalytics {
  bodyweight: {
    current: number | null;
    baseline: number | null;
    change: number;
    trend: 'up' | 'down' | 'stable' | 'no_data';
    history: Array<{ date: string; weight: number }>;
  };
  measurements: {
    totalChange: number;
    history: Array<{
      date: string;
      measurements: Record<string, number>;
    }>;
  };
  scores: {
    current: number | null;
    average: number;
    trend: 'up' | 'down' | 'stable' | 'no_data';
    history: Array<{ date: string; score: number; color: 'red' | 'orange' | 'green' }>;
  };
  quickStats: {
    daysActive: number;
    totalCheckIns: number;
    weightChange: number;
    measurementChange: number;
    currentStreak: number;
  };
}

export default function ClientPortalPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);
  
  // Get preview client ID from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setPreviewClientId(params.get('preview'));
    }
  }, []);
  const [stats, setStats] = useState<ClientStats>({
    overallProgress: 0,
    completedCheckins: 0,
    totalCheckins: 0,
    averageScore: 0
  });
  const [assignedCheckins, setAssignedCheckins] = useState<CheckIn[]>([]);
  const [recentResponses, setRecentResponses] = useState<RecentResponse[]>([]);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<ScoringThresholds>(getDefaultThresholds('moderate'));
  const [averageTrafficLight, setAverageTrafficLight] = useState<TrafficLightStatus>('orange');
  const [clientId, setClientId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'past_due' | 'failed' | 'canceled' | null>(null);
  const [error, setError] = useState<string>('');
  const [showScoringInfo, setShowScoringInfo] = useState(false);
  const [onboardingTodos, setOnboardingTodos] = useState({
    hasWeight: false,
    hasMeasurements: false,
    hasBeforePhotos: false,
  });
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<'not_started' | 'in_progress' | 'completed' | 'submitted' | 'skipped'>('not_started');
  const [onboardingProgress, setOnboardingProgress] = useState(0);
  const [nextMeasurementTask, setNextMeasurementTask] = useState<{
    dueDate: string;
    status: 'upcoming' | 'due' | 'overdue';
    daysUntil: number;
  } | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [totalPaidCount, setTotalPaidCount] = useState(0);
  const [totalPendingCount, setTotalPendingCount] = useState(0);
  const [totalFailedCount, setTotalFailedCount] = useState(0);
  const [loadingRecentPayments, setLoadingRecentPayments] = useState(false);

  // Get preview client ID from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setPreviewClientId(params.get('preview'));
    }
  }, []);

  useEffect(() => {
    // Wait for auth to finish loading first
    if (authLoading) {
      return;
    }

    // In preview mode, we need to wait for userProfile to load to verify coach status
    if (previewClientId) {
      // Preview mode: wait for userProfile to be loaded so we can verify coach status
      if (userProfile === null) {
        // Auth finished loading but no user - error state
        setError('You must be logged in as a coach to preview client portals');
        setLoading(false);
        return;
      }
      // If userProfile exists, proceed (coach verification happens in fetchClientData)
      if (userProfile) {
        fetchClientData();
      }
    } else {
      // Normal mode: client viewing their own portal
      if (userProfile?.email) {
        fetchClientData();
        fetchAnalytics();
      } else if (userProfile === null) {
        // User profile is loaded but no email - this is an error state
        setLoading(false);
        setLoadingAnalytics(false);
      }
    }
  }, [authLoading, userProfile, previewClientId]);

  const fetchAnalytics = async () => {
    try {
      setLoadingAnalytics(true);
      
      // Get Firebase ID token for authentication
      let idToken: string | null = null;
      if (typeof window !== 'undefined' && userProfile?.uid) {
        try {
          const { auth } = await import('@/lib/firebase-client');
          if (auth?.currentUser) {
            idToken = await auth.currentUser.getIdToken();
          }
        } catch (authError) {
          console.warn('Could not get auth token:', authError);
        }
      }

      const headers: HeadersInit = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/client-portal/analytics', {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setAnalytics(data.data);
        }
      } else {
        console.error('Analytics API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Update scoring config when it's loaded from API (Phase 1: Removed client-side Firestore)
  useEffect(() => {
    // Scoring config is now included in the API response
    // This effect is handled in fetchClientData
  }, []);

  // Refresh onboarding todos when page becomes visible (Phase 1: Consolidated API calls)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && userProfile?.email) {
        // Refetch dashboard data when page becomes visible
        fetchClientData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userProfile?.email]);

  // Fetch billing history for dashboard panel: last 3 for list, full duration for Paid/Failed summary
  // Skip in preview mode: coach is viewing client portal; /api/clients/... uses verifyClientAccess but
  // we avoid extra API calls that could 401 if auth isn't ready, and prevent any session confusion
  useEffect(() => {
    if (!clientId || previewClientId) {
      if (!clientId) {
        setRecentInvoices([]);
        setTotalPaidCount(0);
        setTotalPendingCount(0);
        setTotalFailedCount(0);
      }
      return;
    }
    const controller = new AbortController();
    setLoadingRecentPayments(true);
    (async () => {
      try {
        const headers = await import('@/lib/auth-headers').then((m) => m.getAuthHeaders());
        const res = await fetch(`/api/clients/${clientId}/billing/history`, {
          signal: controller.signal,
          headers,
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.invoices)) {
          const invoices = data.invoices;
          setRecentInvoices(invoices.slice(0, 3));
          setTotalPaidCount(invoices.filter((inv: RecentInvoice) => inv.status === 'paid').length);
          setTotalPendingCount(invoices.filter((inv: RecentInvoice) => inv.status === 'open').length);
          setTotalFailedCount(invoices.filter((inv: RecentInvoice) => inv.status !== 'paid' && inv.status !== 'open').length);
        } else {
          setRecentInvoices([]);
          setTotalPaidCount(0);
          setTotalPendingCount(0);
          setTotalFailedCount(0);
        }
      } catch {
        setRecentInvoices([]);
        setTotalPaidCount(0);
        setTotalPendingCount(0);
        setTotalFailedCount(0);
      } finally {
        setLoadingRecentPayments(false);
      }
    })();
    return () => controller.abort();
  }, [clientId, previewClientId]);

  const fetchClientData = async () => {
    try {
      // In preview mode, use the clientId from URL parameter
      let apiUrl = '';
      
      if (previewClientId) {
        // Preview mode: coach viewing client portal
        // At this point, auth should be loaded, but double-check
        if (!userProfile || !userProfile.uid) {
          console.error('Preview mode requires coach authentication');
          setError('You must be logged in as a coach to preview client portals');
          setLoading(false);
          return;
        }
        
        // Verify user is a coach by checking their role from userProfile (set by AuthContext)
        // AuthContext loads from users collection first (for coaches/admins), then clients collection
        const isCoach = userProfile.role === 'coach' || 
                       (userProfile.roles && userProfile.roles.includes('coach')) ||
                       userProfile.role === 'admin'; // Admins can also preview
        
        if (!isCoach) {
          console.error('User is not a coach. Role:', userProfile.role, 'Roles:', userProfile.roles);
          setError('You must be logged in as a coach to preview client portals');
          setLoading(false);
          return;
        }
        
        // Fetch client data by ID in preview mode
        apiUrl = `/api/client-portal?clientId=${encodeURIComponent(previewClientId)}&preview=true&coachId=${encodeURIComponent(userProfile.uid)}`;
      } else {
        // Normal mode: client viewing their own portal
        const clientEmail = userProfile?.email;
        
        if (!clientEmail) {
          console.warn('No client email available - user profile may still be loading');
          setLoading(false);
          return;
        }
        
        // Fetch real data from API using email with timeout
        apiUrl = `/api/client-portal?clientEmail=${encodeURIComponent(clientEmail)}${userProfile?.uid ? `&userUid=${encodeURIComponent(userProfile.uid)}` : ''}`;
      }
      
      // Fetch real data from API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      const headers = await import('@/lib/auth-headers').then(m => m.getAuthHeaders());
      
      try {
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: { ...headers }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Handle non-OK responses gracefully
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
      
      if (response.ok) {
        const data = await response.json();
        
          if (data.success) {
          const { client, coach, checkInAssignments, summary, nextMeasurementTask } = data.data;
          
          // Store client ID and payment status (Phase 1: All data now comes from API)
          if (client?.id) {
            setClientId(client.id);
          }
          if (client?.paymentStatus !== undefined) {
            setPaymentStatus(client.paymentStatus);
          } else {
            setPaymentStatus(null);
          }
          
          // Calculate average score from recent responses if available (must be done before using calculatedStats)
          let averageScore = 0;
          if (summary.recentResponses && summary.recentResponses.length > 0) {
            const scores = summary.recentResponses.map((r: any) => r.score || 0).filter((s: number) => s > 0);
            if (scores.length > 0) {
              averageScore = Math.round(scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length);
            }
          }
          
          // Calculate stats from the summary data (must be done before using it)
          const calculatedStats = {
            overallProgress: summary.completedAssignments > 0 ? Math.round((summary.completedAssignments / summary.totalAssignments) * 100) : 0,
            completedCheckins: summary.completedAssignments || 0,
            totalCheckins: summary.totalAssignments || 0,
            averageScore: averageScore
          };
          
          // Set scoring config from API response (Phase 1: Removed client-side Firestore)
          if (data.data.scoringConfig) {
            setThresholds(data.data.scoringConfig.thresholds);
            // Update average traffic light status
            if (calculatedStats.averageScore > 0) {
              setAverageTrafficLight(getTrafficLightStatus(calculatedStats.averageScore, data.data.scoringConfig.thresholds));
            }
          } else {
            // Fallback to default thresholds if scoring config is missing
            const defaultThresholds = getDefaultThresholds('moderate');
            setThresholds(defaultThresholds);
            if (calculatedStats.averageScore > 0) {
              setAverageTrafficLight(getTrafficLightStatus(calculatedStats.averageScore, defaultThresholds));
            }
          }
          
          // Set onboarding data from API response (Phase 1: Consolidated API calls)
          if (data.data.onboarding) {
            setOnboardingStatus(data.data.onboarding.status as any);
            setOnboardingProgress(data.data.onboarding.progress || 0);
            setOnboardingTodos(data.data.onboarding.todos || {
              hasWeight: false,
              hasMeasurements: false,
              hasBeforePhotos: false
            });
            setNextMeasurementTask(data.data.nextMeasurementTask || null);
            setLoadingTodos(false);
          } else {
            // Fallback to defaults if onboarding data is missing
            setOnboardingStatus('not_started');
            setOnboardingProgress(0);
            setOnboardingTodos({
              hasWeight: false,
              hasMeasurements: false,
              hasBeforePhotos: false
            });
            setNextMeasurementTask(null);
            setLoadingTodos(false);
          }
          
          // Set recent responses if available
          console.log('Dashboard - summary.recentResponses:', summary.recentResponses);
          if (summary.recentResponses && Array.isArray(summary.recentResponses)) {
            console.log('Dashboard - Setting recent responses:', summary.recentResponses.length);
            setRecentResponses(summary.recentResponses.map((r: any) => ({
              id: r.id || '',
              checkInTitle: r.formTitle || 'Check-in',
              submittedAt: r.submittedAt || new Date().toISOString(),
              score: r.score || 0,
              status: 'completed' as const,
              formTitle: r.formTitle || 'Check-in',
              hasFeedback: r.hasFeedback || false,
              feedbackCount: r.feedbackCount || 0,
              responseId: r.id || r.responseId || '',
              clientApproved: r.clientApproved || false
            })));
          } else {
            console.log('Dashboard - No recent responses in summary or not an array');
            setRecentResponses([]);
          }
          
          // Transform check-in assignments to match expected structure
          const transformedCheckins: CheckIn[] = (checkInAssignments || []).map((assignment: any) => {
            // Helper function to convert date fields
            const convertDate = (dateField: any): string => {
              if (!dateField) return new Date().toISOString();
              
              // Handle Firestore Timestamp
              if (dateField.toDate && typeof dateField.toDate === 'function') {
                return dateField.toDate().toISOString();
              }
              
              // Handle Firebase Timestamp object with _seconds
              if (dateField._seconds) {
                return new Date(dateField._seconds * 1000).toISOString();
              }
              
              // Handle Date object
              if (dateField instanceof Date) {
                return dateField.toISOString();
              }
              
              // Handle ISO string
              if (typeof dateField === 'string') {
                return new Date(dateField).toISOString();
              }
              
              // Fallback
              return new Date().toISOString();
            };

            return {
              id: assignment.id || '',
              title: assignment.formTitle || assignment.title || 'Check-in Assignment',
              dueDate: convertDate(assignment.dueDate),
              status: assignment.status || 'pending',
              formId: assignment.formId || '',
              checkInWindow: assignment.checkInWindow || DEFAULT_CHECK_IN_WINDOW,
              extensionGranted: assignment.extensionGranted || false
            };
          });
          
          setStats(calculatedStats);
          setAssignedCheckins(transformedCheckins);
          setCoach(coach);
        } else {
          console.error('API returned error:', data.message);
          // Fallback to empty data
          setStats({
            overallProgress: 0,
            completedCheckins: 0,
            totalCheckins: 0,
            averageScore: 0
          });
          setAssignedCheckins([]);
          setRecentResponses([]);
          setCoach(null);
        }
      } else {
        console.error('Failed to fetch client data:', response.status);
        // Fallback to empty data
        setStats({
          overallProgress: 0,
          completedCheckins: 0,
          totalCheckins: 0,
          averageScore: 0
        });
        setAssignedCheckins([]);
        setRecentResponses([]);
        setCoach(null);
      }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('Request timed out after 15 seconds');
          // Fallback to empty data on timeout
        } else {
          console.error('Error fetching client data:', fetchError);
        }
        // Fallback to empty data
        setStats({
          overallProgress: 0,
          completedCheckins: 0,
          totalCheckins: 0,
          averageScore: 0
        });
        setAssignedCheckins([]);
        setRecentResponses([]);
        setCoach(null);
      }
    } catch (error: any) {
      // Handle errors gracefully - don't log network errors as they're often transient
      // Only log in development or if it's not a network error
      if (process.env.NODE_ENV === 'development' || (error?.name !== 'TypeError' && error?.message !== 'Failed to fetch')) {
        console.error('Error in fetchClientData:', error);
      }
      
      // Fallback to empty data
      setStats({
        overallProgress: 0,
        completedCheckins: 0,
        totalCheckins: 0,
        averageScore: 0
      });
      setAssignedCheckins([]);
      setRecentResponses([]);
      setCoach(null);
    } finally {
      // Always set loading to false, even if there's an error
      // This ensures the dashboard renders even if data fails to load
      setLoading(false);
    }
  };

  // Phase 1: Removed fetchOnboardingTodos and fetchOnboardingQuestionnaireStatus
  // These are now handled in the consolidated API call

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  /**
   * Calculate the window closing time for a check-in based on its dueDate and checkInWindow
   * The window closes on the endDay at endTime, relative to the dueDate's week
   * 
   * For a typical weekly check-in (Friday 10 AM to Monday 10 PM):
   * - If due date is Friday Dec 6, window closes Monday Dec 9 at 10 PM
   * - This is the closing time for THAT check-in's window, not the current week
   */
  const getWindowClosingTime = (dueDate: string, window?: CheckInWindow): Date | null => {
    if (!window || !window.enabled) {
      return null; // No window restriction
    }

    const due = new Date(dueDate);
    const endDay = window.endDay.toLowerCase();
    const { hours: endHours, minutes: endMinutes } = (() => {
      const [h, m] = window.endTime.split(':').map(Number);
      return { hours: h || 0, minutes: m || 0 };
    })();

    // Get day of week number (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayMap: { [key: string]: number } = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    const endDayNum = dayMap[endDay] ?? 1;
    const startDayNum = dayMap[window.startDay.toLowerCase()] ?? 5;

    // Calculate the closing time for the week containing the due date
    const closingTime = new Date(due);
    const dueDay = due.getDay();
    
    // Calculate days from due date to end day
    let daysUntilEnd = (endDayNum - dueDay + 7) % 7;
    
    // Special case: If window spans across week boundary (e.g., Friday to Monday)
    // and the due date is on or after the start day, the end day is in the same week
    // If the due date is before the start day, we need to find the end day of the previous week's window
    if (endDayNum < startDayNum) {
      // Window spans across week (e.g., Friday to Monday)
      if (dueDay >= startDayNum) {
        // Due date is on or after start day (Friday-Sunday), end day is in same week (Monday)
        daysUntilEnd = (endDayNum - dueDay + 7) % 7;
        if (daysUntilEnd === 0) {
          daysUntilEnd = 7; // If same day but past time, go to next week
        }
      } else {
        // Due date is before start day (Mon-Thu), end day is the previous Monday
        // We need to go back to find the Monday that closed the previous window
        daysUntilEnd = (endDayNum - dueDay - 7) % 7;
        if (daysUntilEnd >= 0) {
          daysUntilEnd -= 7; // Go back a week
        }
      }
    } else {
      // Normal case: end day is after start day (e.g., Monday to Friday)
      daysUntilEnd = (endDayNum - dueDay + 7) % 7;
    }
    
    closingTime.setDate(due.getDate() + daysUntilEnd);
    closingTime.setHours(endHours, endMinutes, 0, 0);
    closingTime.setSeconds(0, 0);
    
    return closingTime;
  };

  /**
   * Get the color status for a check-in based on window timing
   * 
   * Logic:
   * - GREEN: Window closes more than 24 hours from now (due soon, plenty of time)
   * - ORANGE: Window closes within 24 hours OR window just closed less than 24 hours ago (1 day from closing)
   * - RED: Window closed more than 24 hours ago (overdue by 24+ hours)
   */
  const getCheckInColorStatus = (checkIn: CheckIn): 'green' | 'orange' | 'red' => {
    const window = checkIn.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
    const now = new Date();
    const dueDate = new Date(checkIn.dueDate);
    
    // First, check if the check-in is overdue based on dueDate (fallback check)
    const hoursOverdue = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60);
    
    // If check-in is overdue by more than 24 hours, it should be RED regardless of window
    // This ensures that check-ins that are 7+ days overdue are always red
    if (hoursOverdue >= 24) {
      // Calculate window closing time to verify
      const closingTime = getWindowClosingTime(checkIn.dueDate, window);
      if (closingTime) {
        const hoursSinceClose = (now.getTime() - closingTime.getTime()) / (1000 * 60 * 60);
        // If window also closed more than 24 hours ago, definitely red
        if (hoursSinceClose >= 24) {
          return 'red';
        }
        // If window closed less than 24 hours ago but dueDate is overdue by 24+ hours,
        // still red (the check-in itself is overdue)
        return 'red';
      }
      // No window, but overdue by 24+ hours = red
      return 'red';
    }
    
    // Calculate window closing time for this specific check-in
    const closingTime = getWindowClosingTime(checkIn.dueDate, window);
    
    if (!closingTime) {
      // No window restriction - use simple overdue logic based on dueDate
      if (hoursOverdue > 0) {
        return 'orange'; // Just overdue, less than 24 hours
      }
      return 'green'; // Not yet due
    }
    
    // Calculate hours until/since window closing
    // Positive = window closes in the future (hours until close)
    // Negative = window closed in the past (hours since close)
    const hoursUntilClose = (closingTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // RED: Window closed more than 24 hours ago (overdue by 24+ hours)
    // Example: If window closed 7 days ago (168 hours), hoursUntilClose = -168, which is < -24
    if (hoursUntilClose < -24) {
      return 'red';
    }
    
    // ORANGE: Window closes within 24 hours OR just closed less than 24 hours ago
    // Example: Window closes in 12 hours OR closed 12 hours ago
    if (hoursUntilClose >= -24 && hoursUntilClose <= 24) {
      return 'orange';
    }
    
    // GREEN: Window closes more than 24 hours from now (due soon, plenty of time)
    // Example: Window closes in 3 days (72 hours)
    return 'green';
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

  // In preview mode, allow coaches; otherwise require client role
  const allowedRoles = previewClientId ? ['client', 'coach'] : ['client'];

  if (error) {
    return (
      <RoleProtected allowedRoles={allowedRoles}>
        <div className="min-h-screen bg-white flex flex-col lg:flex-row">
          <ClientNavigation />
          <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6 pt-20 lg:pt-6 overflow-x-hidden w-full bg-white">
            <div className="max-w-7xl mx-auto w-full">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-8">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Preview Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
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

  if (loading) {
    return (
      <RoleProtected allowedRoles={allowedRoles}>
        <div className="min-h-screen bg-white flex flex-col lg:flex-row">
          <ClientNavigation />
          
          {/* Mobile Top Bar - Same as main content */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.1)] fixed top-0 left-0 right-0 z-40 h-16">
            <div className="flex items-center space-x-2 ml-12 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-semibold flex-shrink-0 bg-gray-300 animate-pulse">
                <span className="text-gray-400">C</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">Client Portal</p>
                <p className="text-xs text-gray-500 truncate">Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
          
          <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6 pt-20 lg:pt-6 overflow-x-hidden w-full bg-white">
            <div className="max-w-7xl mx-auto w-full">
              <div className="animate-pulse">
                {/* Mobile Welcome */}
                <div className="mb-4 lg:hidden">
                  <div className="h-7 bg-gray-200 rounded w-48 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-64"></div>
                </div>
                
                {/* Desktop Header */}
                <div className="mb-6 hidden lg:block">
                  <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-3 sm:p-4">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gray-200 rounded-xl mb-3"></div>
                      <div className="h-6 sm:h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
                
                {/* Content Cards */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-20 bg-gray-100 rounded-lg"></div>
                      <div className="h-20 bg-gray-100 rounded-lg"></div>
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

  // Note: For dashboard, we'll use a simplified version since we don't have client-specific thresholds loaded
  // In a full implementation, we'd fetch thresholds for each response
  const getScoreColor = (score: number) => {
    // Default to moderate thresholds for dashboard display
    // Red: 0-60, Orange: 61-85, Green: 86-100
    if (score <= 60) return 'bg-red-200 text-red-800';
    if (score <= 85) return 'bg-orange-200 text-orange-800';
    return 'bg-green-200 text-green-800';
  };

  return (
    <RoleProtected allowedRoles={allowedRoles}>
      <div className="min-h-screen bg-white flex flex-col lg:flex-row relative">
        <ClientNavigation />
        
        {/* Mobile Top Bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.1)] fixed top-0 left-0 right-0 z-40 h-16">
          <div className="flex items-center space-x-2 ml-12 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
              {userProfile?.firstName?.charAt(0) || 'C'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">Client Portal</p>
              <p className="text-xs text-gray-500 truncate">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <NotificationBell />
            {coach && (
              <div className="text-right bg-white px-2 py-1 rounded-xl border border-gray-100 shadow-sm hidden xs:block">
                <p className="text-[10px] text-gray-600 font-medium">Coach</p>
                <p className="text-xs font-semibold text-gray-900 truncate max-w-[60px]">{coach.firstName} {coach.lastName}</p>
              </div>
            )}
          </div>
        </div>
        
        <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6 pt-20 lg:pt-6 overflow-x-hidden w-full bg-white relative z-0">
          <div className="max-w-7xl mx-auto w-full">
            {/* Desktop: Grid layout with main content and sidebar */}
            <div className="block lg:grid lg:grid-cols-3 lg:gap-6">
              {/* Main Content Column - Full width on mobile, 2/3 on desktop - Always visible */}
              <div className="w-full block lg:col-span-2">
            {/* Header - Hidden on mobile, shown on desktop */}
            <div className="mb-6 hidden lg:block">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Welcome Back!</h1>
                  <p className="text-gray-600 text-sm mt-1">Track your progress and stay connected</p>
                </div>
                <div className="flex items-center space-x-4">
                  {/* Payment status icon + link */}
                  <Link
                    href="/client-portal/payments"
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      paymentStatus === 'paid'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : paymentStatus === 'failed' || paymentStatus === 'past_due'
                          ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                    title="View payment status and history"
                  >
                    {paymentStatus === 'paid' ? (
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : paymentStatus === 'failed' || paymentStatus === 'past_due' ? (
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">!</span>
                    ) : (
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span>
                      {paymentStatus === 'paid' ? 'Paid up' : paymentStatus === 'failed' ? 'Payment failed' : paymentStatus === 'past_due' ? 'Past due' : paymentStatus === 'canceled' ? 'Canceled' : 'Payments'}
                    </span>
                  </Link>
                  <NotificationBell />
                </div>
            </div>

            {/* Mobile Welcome - Shown only on mobile */}
            <div className="mb-4 lg:hidden">
              <h1 className="text-xl font-bold text-gray-900">Welcome Back!</h1>
              <p className="text-gray-600 text-xs mt-1">Track your progress and stay connected</p>
            </div>

            {/* Quick Stats Bar - New analytics section - Always visible on all devices */}
            <div className="mb-6 block">
              <QuickStatsBar stats={analytics?.quickStats || null} loading={loadingAnalytics} />
            </div>

            {/* Coach Feedback Available Banner - Show prominently when coach has provided feedback */}
            {(() => {
              // Only show feedback that hasn't been approved yet
              const feedbackAvailable = recentResponses.filter(r => 
                r.hasFeedback && 
                r.responseId && 
                !r.clientApproved // Hide if client has already approved
              );
              if (feedbackAvailable.length === 0) return null;

              // Get the most recent feedback
              const latestFeedback = feedbackAvailable.sort((a, b) => 
                new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
              )[0];

              return (
                <div className="mb-4 sm:mb-6">
                  <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 rounded-2xl lg:rounded-3xl shadow-lg overflow-hidden border-2 border-purple-300">
                    <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white bg-opacity-20 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ring-4 ring-white ring-opacity-30">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-1 sm:mb-2">
                              Coach Feedback Available! 🎉
                            </h2>
                            <p className="text-white/90 text-sm sm:text-base leading-relaxed">
                              Your coach has reviewed your check-in and provided feedback for <strong>{latestFeedback.formTitle || latestFeedback.checkInTitle}</strong>
                            </p>
                            {feedbackAvailable.length > 1 && (
                              <p className="text-white/80 text-xs sm:text-sm mt-2">
                                You have {feedbackAvailable.length} check-in{feedbackAvailable.length !== 1 ? 's' : ''} with coach feedback
                              </p>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/client-portal/feedback/${latestFeedback.responseId}`}
                          className="flex-shrink-0 w-full sm:w-auto px-6 py-3 sm:py-3.5 bg-white text-purple-600 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-center text-sm sm:text-base min-h-[48px] flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          View Feedback Now
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Onboarding Questionnaire Banner - Show if not completed or submitted (prominent on mobile) */}
            {onboardingStatus !== 'completed' && onboardingStatus !== 'submitted' && onboardingStatus !== 'skipped' && (
              <div className="bg-gradient-to-r from-[#daa450] to-[#c89540] rounded-2xl lg:rounded-3xl shadow-lg mb-4 sm:mb-6 overflow-hidden border border-[#daa450]/20 w-full">
                <div className="px-4 py-4 sm:px-6 sm:py-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white bg-opacity-20 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white mb-1.5 sm:mb-2">Complete Your Onboarding Questionnaire</h2>
                        <p className="text-white/90 text-xs sm:text-sm leading-relaxed">
                          {onboardingStatus === 'not_started' 
                            ? 'Help us understand your goals and preferences. This must be completed before you can receive check-ins.'
                            : `You're ${onboardingProgress}% complete. Finish the questionnaire to unlock check-ins.`
                          }
                        </p>
                        {onboardingProgress > 0 && (
                          <div className="mt-3 w-full bg-white/20 rounded-full h-2">
                            <div 
                              className="bg-white h-2 rounded-full transition-all duration-300"
                              style={{ width: `${onboardingProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>
                    <Link
                      href="/client-portal/onboarding-questionnaire"
                      className="w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-2.5 bg-white text-[#daa450] rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-md flex-shrink-0 text-center text-sm sm:text-base min-h-[44px] flex items-center justify-center"
                    >
                      {onboardingStatus === 'not_started' ? 'Start Questionnaire' : 'Continue Questionnaire'}
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Next Upcoming Tasks - Unified task widget */}
            {(() => {
              if (loadingTodos) return null;
              
              const hasOnboardingTasks = !onboardingTodos.hasWeight || !onboardingTodos.hasMeasurements || !onboardingTodos.hasBeforePhotos;
              const hasMeasurementTask = nextMeasurementTask && (nextMeasurementTask.status === 'upcoming' || nextMeasurementTask.status === 'due' || nextMeasurementTask.status === 'overdue');
              const hasTasks = hasOnboardingTasks || hasMeasurementTask;
              
              if (!hasTasks) return null;
              
              return (
                <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 mb-4 sm:mb-6 overflow-hidden w-full">
                  <div className="px-4 py-3 sm:px-6 sm:py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-sm sm:text-base lg:text-lg font-bold text-gray-900">Next Upcoming Tasks</h2>
                          <p className="text-gray-600 text-[10px] sm:text-xs mt-0.5">Complete these tasks to stay on track</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 sm:p-4 lg:p-6 space-y-2 sm:space-y-3">
                    {/* Measurement Task - Show first if overdue/due */}
                    {hasMeasurementTask && (
                      <Link
                        href="/client-portal/measurements"
                        className="flex items-center justify-between p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border-2 transition-all group"
                        style={{ 
                          borderColor: nextMeasurementTask!.status === 'overdue' ? '#ef4444' : 
                                       nextMeasurementTask!.status === 'due' ? '#daa450' : '#daa450'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef9e7'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div 
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                            style={{ borderColor: nextMeasurementTask!.status === 'overdue' ? '#ef4444' : '#daa450' }}
                          >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: nextMeasurementTask!.status === 'overdue' ? '#ef4444' : '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                              Update Measurements & Photos
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">
                              {nextMeasurementTask!.status === 'overdue' && (
                                <span className="text-red-600 font-medium">Overdue by {nextMeasurementTask!.daysUntil} {nextMeasurementTask!.daysUntil === 1 ? 'day' : 'days'}</span>
                              )}
                              {nextMeasurementTask!.status === 'due' && (
                                <span className="font-medium" style={{ color: '#daa450' }}>Due today - {new Date(nextMeasurementTask!.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                              )}
                              {nextMeasurementTask!.status === 'upcoming' && (
                                <>Due {nextMeasurementTask!.daysUntil === 1 ? 'tomorrow' : `in ${nextMeasurementTask!.daysUntil} days`} - {new Date(nextMeasurementTask!.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</>
                              )}
                            </p>
                          </div>
                        </div>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}

                    {/* Weight Task */}
                    {!onboardingTodos.hasWeight && (
                      <Link
                        href="/client-portal/measurements"
                        className="flex items-center justify-between p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-gray-200 hover:border-[#daa450] hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: '#daa450' }}>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">Enter Your Weight</h3>
                            <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">Record your starting weight to track progress</p>
                          </div>
                        </div>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}

                    {/* Measurements Task */}
                    {!onboardingTodos.hasMeasurements && (
                      <Link
                        href="/client-portal/measurements"
                        className="flex items-center justify-between p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-gray-200 hover:border-[#daa450] hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: '#daa450' }}>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">Add Your Measurements</h3>
                            <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">Record body measurements (waist, hips, chest, etc.)</p>
                          </div>
                        </div>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}

                    {/* Before Photos Task */}
                    {!onboardingTodos.hasBeforePhotos && (
                      <Link
                        href="/client-portal/measurements"
                        className="flex items-center justify-between p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-gray-200 hover:border-[#daa450] hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: '#daa450' }}>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">Upload Before Photos</h3>
                            <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">Take and upload front, back, and side photos to track your transformation</p>
                          </div>
                        </div>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Check-ins Requiring Attention - Priority action items - Always visible on all devices */}
            <div className="mb-6 block">
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 lg:space-x-3 flex-1 min-w-0">
                      <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Check-ins Requiring Attention</h2>
                        <p className="text-gray-600 text-xs sm:text-sm">Complete overdue and upcoming check-ins to stay on track</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="text-gray-600 text-sm font-medium">Needs Action</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {(() => {
                          // Filter actionable check-ins - match check-ins page logic exactly
                          const now = new Date();
                          const today = new Date(now);
                          today.setHours(0, 0, 0, 0);
                          
                          // Helper function to check if check-in window is open (Friday 10am to Tuesday 12pm)
                          const isCheckInOpenForWeek = (due: Date): boolean => {
                            const d = new Date(due);
                            const dayOfWeek = d.getDay();
                            const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
                            const weekMonday = new Date(d);
                            weekMonday.setDate(d.getDate() - daysToMonday);
                            weekMonday.setHours(0, 0, 0, 0);
                            
                            const windowOpen = new Date(weekMonday);
                            windowOpen.setDate(weekMonday.getDate() - 3); // Friday before Monday
                            windowOpen.setHours(10, 0, 0, 0);
                            
                            const windowClose = new Date(weekMonday);
                            windowClose.setDate(weekMonday.getDate() + 1); // Tuesday after Monday
                            windowClose.setHours(12, 0, 0, 0);
                            
                            return now >= windowOpen && now <= windowClose;
                          };
                          
                          const filtered = assignedCheckins.filter(checkIn => {
                            // Exclude completed and parked/missed check-ins (coach has marked as missed)
                            if (checkIn.status === 'completed') return false;
                            if (checkIn.status === 'missed') return false;
                            if ((checkIn as any).responseId || (checkIn as any).completedAt) return false;
                            // Coach opened for check-in (extension granted)
                            if (checkIn.extensionGranted) return true;

                            const dueDate = new Date(checkIn.dueDate);
                            const normalizedDueDate = new Date(dueDate);
                            normalizedDueDate.setHours(0, 0, 0, 0);
                            
                            // Always include overdue check-ins (past due date) - highest priority
                            if (normalizedDueDate < today) return true;
                            
                            // Include check-ins due today
                            if (normalizedDueDate.getTime() === today.getTime()) return true;
                            
                            // Include if window is open (Friday 10am to Tuesday 12pm) - available now
                            if (isCheckInOpenForWeek(dueDate)) return true;
                            
                            // Don't include future check-ins whose window isn't open yet
                            return false;
                          });

                          // Deduplicate by formId + normalized due date (same logic as list below)
                          const deduplicatedMap = new Map<string, CheckIn>();
                          filtered.forEach(checkIn => {
                            const dueDate = new Date(checkIn.dueDate);
                            dueDate.setHours(0, 0, 0, 0);
                            const key = `${checkIn.formId}_${dueDate.toISOString().split('T')[0]}`;
                            
                            if (!deduplicatedMap.has(key)) {
                              deduplicatedMap.set(key, checkIn);
                            } else {
                              const existing = deduplicatedMap.get(key)!;
                              if (existing.status === 'completed' && checkIn.status !== 'completed') {
                                deduplicatedMap.set(key, checkIn);
                              } else if (checkIn.id > existing.id) {
                                deduplicatedMap.set(key, checkIn);
                              }
                            }
                          });

                          return deduplicatedMap.size;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              <div className="p-4 lg:p-8">
                {(() => {
                  // Filter actionable check-ins - match check-ins page logic exactly
                  const now = new Date();
                  const today = new Date(now);
                  today.setHours(0, 0, 0, 0);
                  
                  // Helper function to check if check-in window is open (Friday 10am to Tuesday 12pm)
                  const isCheckInOpenForWeek = (due: Date): boolean => {
                    const d = new Date(due);
                    const dayOfWeek = d.getDay();
                    const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
                    const weekMonday = new Date(d);
                    weekMonday.setDate(d.getDate() - daysToMonday);
                    weekMonday.setHours(0, 0, 0, 0);
                    
                    const windowOpen = new Date(weekMonday);
                    windowOpen.setDate(weekMonday.getDate() - 3); // Friday before Monday
                    windowOpen.setHours(10, 0, 0, 0);
                    
                    const windowClose = new Date(weekMonday);
                    windowClose.setDate(weekMonday.getDate() + 1); // Tuesday after Monday
                    windowClose.setHours(12, 0, 0, 0);
                    
                    return now >= windowOpen && now <= windowClose;
                  };
                  
                  const filteredCheckins = assignedCheckins.filter(checkIn => {
                    // Exclude completed and parked/missed check-ins (coach has marked as missed)
                    if (checkIn.status === 'completed') return false;
                    if (checkIn.status === 'missed') return false;
                    if ((checkIn as any).responseId || (checkIn as any).completedAt) return false;
                    // Coach opened for check-in (extension granted)
                    if (checkIn.extensionGranted) return true;

                    const dueDate = new Date(checkIn.dueDate);
                    const normalizedDueDate = new Date(dueDate);
                    normalizedDueDate.setHours(0, 0, 0, 0);
                    
                    // Always include overdue check-ins (past due date) - highest priority
                    if (normalizedDueDate < today) return true;
                    
                    // Include check-ins due today
                    if (normalizedDueDate.getTime() === today.getTime()) return true;
                    
                    // Include if window is open (Friday 10am to Tuesday 12pm) - available now
                    if (isCheckInOpenForWeek(dueDate)) return true;
                    
                    // Don't include future check-ins whose window isn't open yet
                    return false;
                  });

                  // Deduplicate: Group by formId + normalized due date, keep only one per group
                  // This handles cases where duplicate assignments exist for the same form/date
                  const deduplicatedMap = new Map<string, CheckIn>();
                  filteredCheckins.forEach(checkIn => {
                    const dueDate = new Date(checkIn.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    const key = `${checkIn.formId}_${dueDate.toISOString().split('T')[0]}`;
                    
                    // If we already have one for this key, keep the one that's not completed and has earlier ID (more recently created)
                    if (!deduplicatedMap.has(key)) {
                      deduplicatedMap.set(key, checkIn);
                    } else {
                      const existing = deduplicatedMap.get(key)!;
                      // Prefer non-completed over completed (shouldn't happen as we filtered, but safety check)
                      if (existing.status === 'completed' && checkIn.status !== 'completed') {
                        deduplicatedMap.set(key, checkIn);
                      }
                      // If both have same status, prefer the one with later ID (more recent assignment)
                      else if (checkIn.id > existing.id) {
                        deduplicatedMap.set(key, checkIn);
                      }
                    }
                  });

                  const allUpcoming = Array.from(deduplicatedMap.values()).sort((a, b) => {
                    const aDue = new Date(a.dueDate).getTime();
                    const bDue = new Date(b.dueDate).getTime();
                    const now = new Date().getTime();
                    const aIsOverdue = aDue < now;
                    const bIsOverdue = bDue < now;
                    if (aIsOverdue && !bIsOverdue) return -1;
                    if (!aIsOverdue && bIsOverdue) return 1;
                    if (aIsOverdue && bIsOverdue) return bDue - aDue;
                    return aDue - bDue;
                  });

                  // Only show the CURRENT window's check-in in "Requiring Attention" so "Complete Now" never sends to a past week.
                  // Use local date strings so behavior is identical in deploy (no UTC shift).
                  const toLocalDateStr = (d: Date) =>
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const getWeekMondayLocalStr = (date: Date): string => {
                    const x = new Date(date);
                    const day = x.getDay();
                    const daysToMonday = day === 0 ? 6 : day - 1;
                    x.setDate(x.getDate() - daysToMonday);
                    x.setHours(0, 0, 0, 0);
                    return toLocalDateStr(x);
                  };
                  const getCurrentWindowMondayStr = (): string | null => {
                    const day = now.getDay();
                    const thisMonday = new Date(today);
                    const daysToMonday = day === 0 ? 6 : day - 1;
                    thisMonday.setDate(today.getDate() - daysToMonday);
                    const currentMonday = new Date(thisMonday);
                    if (day >= 5 || day === 0) currentMonday.setDate(thisMonday.getDate() + 7);
                    const checkMonday = new Date(currentMonday);
                    checkMonday.setHours(0, 0, 0, 0);
                    const windowOpen = new Date(checkMonday);
                    windowOpen.setDate(checkMonday.getDate() - 3);
                    windowOpen.setHours(10, 0, 0, 0);
                    const windowClose = new Date(checkMonday);
                    windowClose.setDate(checkMonday.getDate() + 1);
                    windowClose.setHours(12, 0, 0, 0);
                    if (now >= windowOpen && now <= windowClose) return toLocalDateStr(checkMonday);
                    return null;
                  };
                  const currentWindowMondayStr = getCurrentWindowMondayStr();
                  const upcomingCheckins = currentWindowMondayStr
                    ? allUpcoming.filter((c) => {
                        const dueMondayStr = getWeekMondayLocalStr(new Date(c.dueDate));
                        return dueMondayStr === currentWindowMondayStr;
                      })
                    : [];

                  // If no actionable check-ins (or not in a window), show the next scheduled check-in
                  if (upcomingCheckins.length === 0) {
                    // Find the next upcoming scheduled check-in
                    const nextScheduledCheckIn = assignedCheckins
                      .filter(checkIn => checkIn.status !== 'completed' && !(checkIn as any).responseId && !(checkIn as any).completedAt)
                      .sort((a, b) => {
                        const dateA = new Date(a.dueDate).getTime();
                        const dateB = new Date(b.dueDate).getTime();
                        return dateA - dateB;
                      })[0];

                    if (nextScheduledCheckIn) {
                      // Show next scheduled check-in with window information
                      const dueDate = new Date(nextScheduledCheckIn.dueDate);
                      const now = new Date();
                      
                      // Normalize both dates to start of day in local timezone for accurate day calculation
                      const dueDateStart = new Date(dueDate);
                      dueDateStart.setHours(0, 0, 0, 0);
                      const nowStart = new Date(now);
                      nowStart.setHours(0, 0, 0, 0);
                      
                      const daysDiff = Math.floor((dueDateStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24));
                      const isToday = daysDiff === 0;
                      const isTomorrow = daysDiff === 1;
                      
                      // Use the check-in's specific window settings (from assignment)
                      // This allows different forms to have different opening days/times
                      const checkInWindow = nextScheduledCheckIn.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
                      
                      // Calculate window using the check-in's specific settings
                      const windowStatus = isWithinCheckInWindow(checkInWindow, nextScheduledCheckIn.dueDate);
                      
                      // Calculate window start date based on the check-in's window settings
                      const calculateWindowStartDate = (dueDateStr: string, window: CheckInWindow): Date => {
                        const due = new Date(dueDateStr);
                        const weekStart = new Date(due);
                        const dayOfWeek = due.getDay();
                        const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
                        weekStart.setDate(due.getDate() - daysToMonday);
                        weekStart.setHours(0, 0, 0, 0);
                        
                        // Get the start day number
                        const getDayOfWeek = (dayName: string): number => {
                          const days: { [key: string]: number } = {
                            'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
                            'thursday': 4, 'friday': 5, 'saturday': 6
                          };
                          return days[dayName.toLowerCase()] ?? 5;
                        };
                        
                        const startDayNum = getDayOfWeek(window.startDay);
                        const mondayDayNum = 1; // Monday
                        
                        // Calculate days from Monday to start day
                        // If start day is Friday (5), we go back 3 days from Monday
                        // If start day is Thursday (4), we go back 4 days from Monday
                        let daysFromMonday = startDayNum - mondayDayNum;
                        if (daysFromMonday > 0) {
                          // Start day is after Monday, go to previous week
                          daysFromMonday = daysFromMonday - 7;
                        }
                        
                        const windowStart = new Date(weekStart);
                        windowStart.setDate(weekStart.getDate() + daysFromMonday);
                        const [hours, minutes] = window.startTime.split(':').map(Number);
                        windowStart.setHours(hours || 10, minutes || 0, 0, 0);
                        
                        return windowStart;
                      };
                      
                      const windowStartDate = checkInWindow?.enabled 
                        ? calculateWindowStartDate(nextScheduledCheckIn.dueDate, checkInWindow)
                        : null;
                      
                      const windowHasOpened = windowStartDate ? windowStartDate <= now : false;
                      const isAvailable = windowStatus.isOpen;
                      
                      return (
                        <div className="space-y-4">
                          <div className="bg-white rounded-lg lg:rounded-xl p-4 lg:p-6 border-2 border-blue-300 bg-blue-50 transition-all duration-200">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 lg:space-x-3 mb-2">
                                  <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100">
                                    <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 truncate">
                                    {nextScheduledCheckIn.isRecurring && nextScheduledCheckIn.recurringWeek 
                                      ? `Week ${nextScheduledCheckIn.recurringWeek}: ${nextScheduledCheckIn.title}`
                                      : nextScheduledCheckIn.title}
                                  </h3>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs lg:text-sm ml-9 lg:ml-11">
                                  <div className="flex items-center space-x-1 text-blue-600">
                                    <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-medium">
                                      {isToday ? 'Due Today!' : 
                                       isTomorrow ? 'Due Tomorrow' : 
                                       `Due in ${daysDiff} days`}
                                    </span>
                                  </div>
                                  <span className="text-gray-700">
                                    {dueDate.toLocaleDateString('en-AU', { 
                                      weekday: 'short', 
                                      month: 'short', 
                                      day: 'numeric',
                                      timeZone: 'Australia/Perth'
                                    })}
                                  </span>
                                </div>
                                {/* Window information */}
                                {checkInWindow?.enabled && windowStartDate && (
                                  <div className="mt-2 ml-9 lg:ml-11">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 lg:py-1 rounded-lg text-xs lg:text-xs font-medium bg-blue-50 text-blue-800">
                                      <span className="text-base">{isAvailable ? '✅' : '📅'}</span>
                                      <span>
                                        {isAvailable 
                                          ? '✓ Check-in window is open now'
                                          : (() => {
                                              // Format time from window settings
                                              const [hours, minutes] = checkInWindow.startTime.split(':').map(Number);
                                              const period = hours >= 12 ? 'PM' : 'AM';
                                              const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                                              const displayMinutes = minutes.toString().padStart(2, '0');
                                              const timeStr = `${displayHours}:${displayMinutes} ${period}`;
                                              
                                              return `Window opens ${windowStartDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${timeStr}`;
                                            })()
                                        }
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-3">
                                <div className="px-2.5 py-1 lg:px-3 lg:py-1 rounded-full text-[10px] lg:text-xs font-medium bg-blue-100 text-blue-700">
                                  Scheduled
                                </div>
                                {isAvailable ? (
                                  <Link
                                    href={`/client-portal/check-in/${nextScheduledCheckIn.id}`}
                                    className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200 text-white shadow-md hover:shadow-lg bg-green-600 hover:bg-green-700"
                                  >
                                    Start Check-in
                                  </Link>
                                ) : (
                                  <button
                                    disabled
                                    className="px-3 py-1.5 lg:px-4 lg:py-2 bg-gray-300 text-gray-600 rounded-lg text-xs lg:text-sm font-medium cursor-not-allowed"
                                  >
                                    Not Available Yet
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // If no scheduled check-ins at all, show "All caught up"
                    return (
                      <div className="text-center py-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-800 text-base font-bold mb-1">All caught up!</p>
                        <p className="text-gray-900 text-sm">No check-ins due this week. Great job!</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {upcomingCheckins.map((checkIn) => {
                        const dueDate = new Date(checkIn.dueDate);
                        const now = new Date();
                        
                        // Normalize both dates to start of day in local timezone for accurate day calculation
                        const dueDateStart = new Date(dueDate);
                        dueDateStart.setHours(0, 0, 0, 0);
                        const nowStart = new Date(now);
                        nowStart.setHours(0, 0, 0, 0);
                        
                        const daysDiff = Math.floor((dueDateStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24));
                        const isToday = daysDiff === 0;
                        const isTomorrow = daysDiff === 1;
                        const isOverdue = daysDiff < 0;
                        
                        // Get color status based on window timing
                        const colorStatus = getCheckInColorStatus(checkIn);
                        
                        // Determine colors based on status
                        const borderColor = colorStatus === 'red' ? 'border-red-300 bg-red-50' :
                                          colorStatus === 'orange' ? 'border-orange-300 bg-orange-50' :
                                          'border-green-300 bg-green-50';
                        const iconBg = colorStatus === 'red' ? 'bg-red-100' :
                                      colorStatus === 'orange' ? 'bg-orange-100' :
                                      'bg-green-100';
                        const iconColor = colorStatus === 'red' ? 'text-red-600' :
                                        colorStatus === 'orange' ? 'text-orange-600' :
                                        'text-green-600';
                        const textColor = colorStatus === 'red' ? 'text-red-600' :
                                        colorStatus === 'orange' ? 'text-orange-600' :
                                        'text-green-600';
                        const badgeBg = colorStatus === 'red' ? 'bg-red-100 text-red-700' :
                                       colorStatus === 'orange' ? 'bg-orange-100 text-orange-700' :
                                       'bg-green-100 text-green-700';
                        const buttonBg = colorStatus === 'red' ? 'bg-red-600 hover:bg-red-700' :
                                        colorStatus === 'orange' ? 'bg-orange-600 hover:bg-orange-700' :
                                        'bg-green-600 hover:bg-green-700';
                        const statusLabel = colorStatus === 'red' ? 'Overdue' :
                                          colorStatus === 'orange' ? 'Closing Soon' :
                                          'Due Soon';
                        const buttonText = colorStatus === 'red' ? 'Complete Now' :
                                         colorStatus === 'orange' ? 'Complete Soon' :
                                         'Start Check-in';

                        return (
                          <div 
                            key={checkIn.id} 
                            className={`bg-white rounded-lg lg:rounded-xl p-4 lg:p-6 border-2 transition-all duration-200 hover:shadow-lg ${borderColor}`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 lg:space-x-3 mb-2">
                                  <div className={`w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                                    <svg className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <h3 className="text-base lg:text-lg font-semibold text-gray-900 truncate">{checkIn.title}</h3>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs lg:text-sm ml-9 lg:ml-11">
                                  <div className={`flex items-center space-x-1 ${textColor}`}>
                                    <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-medium">
                                      {isOverdue ? `${Math.abs(daysDiff)} day${Math.abs(daysDiff) !== 1 ? 's' : ''} overdue` :
                                       isToday ? 'Due Today!' : 
                                       isTomorrow ? 'Due Tomorrow' : 
                                       `Due in ${daysDiff} days`}
                                    </span>
                                  </div>
                                  <span className="text-gray-700">
                                    {dueDate.toLocaleDateString('en-AU', { 
                                      weekday: 'short', 
                                      month: 'short', 
                                      day: 'numeric',
                                      timeZone: 'Australia/Perth'
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-3">
                                <div className={`px-2.5 py-1 lg:px-3 lg:py-1 rounded-full text-[10px] lg:text-xs font-medium ${badgeBg}`}>
                                  {statusLabel}
                                </div>
                                <Link
                                  href={`/client-portal/check-in/${checkIn.id}`}
                                  className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200 text-white shadow-md hover:shadow-lg ${buttonBg}`}
                                >
                                  {buttonText}
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Stats Overview - Clean minimal design - Always visible on all devices */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 block">
              {/* Average Score Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-3 py-3 sm:px-4 sm:py-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#daa450' }}>
                      <span className="text-sm">{getTrafficLightIcon(averageTrafficLight)}</span>
                    </div>
                    {analytics?.scores.trend && analytics.scores.trend !== 'no_data' && (
                      <span className={`text-xs font-semibold ${
                        analytics.scores.trend === 'up' ? 'text-green-600' : 
                        analytics.scores.trend === 'down' ? 'text-red-600' : 
                        'text-gray-500'
                      }`}>
                        {analytics.scores.trend === 'up' ? '↑' : analytics.scores.trend === 'down' ? '↓' : '→'}
                      </span>
                    )}
                  </div>
                  <div className="mb-2.5">
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-xl sm:text-2xl font-bold text-gray-900">{stats?.averageScore || 0}</span>
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                    {stats?.averageScore > 0 && (
                      <div className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-700">
                        {getTrafficLightLabel(averageTrafficLight)}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Average Score</div>
                  {stats?.averageScore > 0 && stats?.completedCheckins > 0 && (
                    <div className="text-[10px] text-gray-600 mt-0.5">Based on {stats.completedCheckins} check-in{stats.completedCheckins !== 1 ? 's' : ''}</div>
                  )}
                </div>
              </div>

              {/* Completion Rate Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-3 py-3 sm:px-4 sm:py-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {analytics?.quickStats.currentStreak > 0 && (
                      <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 rounded">
                        <span className="text-[10px]">🔥</span>
                        <span className="text-[10px] font-bold text-orange-700">{analytics.quickStats.currentStreak}</span>
                      </div>
                    )}
                  </div>
                  <div className="mb-2.5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl sm:text-2xl font-bold text-gray-900">
                        {stats?.totalCheckins > 0 ? Math.round((stats.completedCheckins / stats.totalCheckins) * 100) : 0}
                      </span>
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Completion Rate</div>
                  {stats?.totalCheckins > 0 && (
                    <div className="text-[10px] text-gray-600 mt-0.5">{stats.completedCheckins} of {stats.totalCheckins} completed</div>
                  )}
                  {analytics?.quickStats.currentStreak > 0 && (
                    <div className="mt-1 inline-block px-1.5 py-0.5 bg-orange-50 rounded text-[10px] text-orange-700 font-semibold">
                      {analytics.quickStats.currentStreak} day{analytics.quickStats.currentStreak !== 1 ? 's' : ''} streak!
                    </div>
                  )}
                </div>
              </div>

              {/* Weight Progress Card */}
              {analytics?.bodyweight && analytics.bodyweight.baseline && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-3 py-3 sm:px-4 sm:py-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                      </div>
                      {analytics.bodyweight.trend && analytics.bodyweight.trend !== 'no_data' && (
                        <span className={`text-xs font-semibold ${
                          analytics.bodyweight.trend === 'down' ? 'text-green-600' : 
                          analytics.bodyweight.trend === 'up' ? 'text-red-600' : 
                          'text-gray-500'
                        }`}>
                          {analytics.bodyweight.trend === 'down' ? '↓' : analytics.bodyweight.trend === 'up' ? '↑' : '→'}
                        </span>
                      )}
                    </div>
                    <div className="mb-2.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl sm:text-2xl font-bold text-gray-900">
                          {analytics.bodyweight.current ? analytics.bodyweight.current.toFixed(1) : '-'}
                        </span>
                        <span className="text-sm text-gray-500">kg</span>
                      </div>
                      {analytics.bodyweight.change !== 0 && (
                        <div className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          analytics.bodyweight.change > 0 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                        }`}>
                          {analytics.bodyweight.change > 0 ? '↓' : '↑'} {Math.abs(analytics.bodyweight.change).toFixed(1)}kg
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Current Weight</div>
                  </div>
                </div>
              )}
            </div>

            {/* Progress Images - Always visible on all devices */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden mb-6 block">
              <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900">Progress Images</h2>
                    <p className="text-gray-600 text-[10px] sm:text-xs lg:text-sm mt-1">Track your transformation</p>
                  </div>
                  <Link
                    href="/client-portal/progress-images"
                    className="px-3 py-2 sm:px-4 sm:py-2 text-white rounded-xl sm:rounded-2xl hover:opacity-90 transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm"
                    style={{ backgroundColor: '#daa450' }}
                  >
                    Manage
                  </Link>
                </div>
              </div>
              <ProgressImagesPreview clientEmail={previewClientId ? undefined : userProfile?.email} clientId={clientId} />
            </div>

            {/* Scoring Formula & Traffic Light Info - At bottom of main content */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 mb-6 lg:mb-0">
              <button
                onClick={() => setShowScoringInfo(!showScoringInfo)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#daa450' }}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Understanding Your Scores</h3>
                    <p className="text-xs text-gray-600">Learn how scores are calculated and what they mean</p>
                  </div>
                </div>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform ${showScoringInfo ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showScoringInfo && (
                <div className="mt-6 pt-6 border-t border-gray-200 space-y-6">
                {/* Scoring Formula */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-blue-600">📊</span>
                    Scoring Formula
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="text-sm text-gray-700">
                      <p className="font-semibold mb-2">Each question contributes to your score:</p>
                      <div className="bg-white rounded p-3 font-mono text-xs border border-gray-200">
                        <div className="mb-2">weightedScore = questionScore × questionWeight</div>
                        <div className="mb-2">totalScore = (Σ weightedScores / (Σ weights × 10)) × 100</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>• <strong>Question Weight (1-10):</strong> How important the question is</p>
                      <p>• <strong>Question Score (1-10):</strong> Your answer converted to a score</p>
                      <p>• <strong>Final Score (0-100%):</strong> Weighted average of all questions</p>
                    </div>
                  </div>
                </div>

                {/* Answer Scoring */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-green-600">✅</span>
                    How Answers Are Scored
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="font-semibold mb-1">Scale (1-10):</p>
                      <p>Direct value (e.g., 7 = 7/10)</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="font-semibold mb-1">Yes/No:</p>
                      <p>Yes = 8/10, No = 3/10</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="font-semibold mb-1">Single/Multiple Choice:</p>
                      <p>Uses option weights if set</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="font-semibold mb-1">Text Questions:</p>
                      <p>Neutral score of 5/10</p>
                    </div>
                  </div>
                </div>

                {/* Traffic Light Thresholds */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-yellow-600">🚦</span>
                    Your Traffic Light Thresholds
                  </h4>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="bg-white rounded-lg p-3 border-2 border-red-200">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-lg">🔴</span>
                          <span className="font-bold text-red-700 text-xs">Red Zone</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-900">0 - {thresholds.redMax}%</p>
                        <p className="text-xs text-gray-600 mt-1">Needs Attention</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border-2 border-orange-200">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-lg">🟠</span>
                          <span className="font-bold text-orange-700 text-xs">Orange Zone</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-900">{thresholds.redMax + 1} - {thresholds.orangeMax}%</p>
                        <p className="text-xs text-gray-600 mt-1">On Track</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border-2 border-green-200">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-lg">🟢</span>
                          <span className="font-bold text-green-700 text-xs">Green Zone</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-900">{thresholds.orangeMax + 1} - 100%</p>
                        <p className="text-xs text-gray-600 mt-1">Excellent</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 italic">
                      These thresholds are personalized based on your client profile and goals.
                    </p>
                  </div>
                </div>

                {/* Example Calculation */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-purple-600">💡</span>
                    Example Calculation
                  </h4>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="text-xs text-gray-700 space-y-2">
                      <p><strong>3 Questions:</strong></p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Q1: Sleep (Weight 8) → Answer: 7 → Score: 7 × 8 = 56</li>
                        <li>Q2: Exercise (Weight 5) → Answer: Yes → Score: 8 × 5 = 40</li>
                        <li>Q3: Notes (Weight 2) → Answer: Text → Score: 5 × 2 = 10</li>
                      </ul>
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p><strong>Total:</strong> (56 + 40 + 10) / (15 × 10) × 100 = <strong>71%</strong></p>
                        <p className="mt-1 text-orange-700 font-semibold">→ 🟠 Orange Zone (On Track)</p>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              )}
            </div>
              </div>

              {/* Desktop Sidebar - Hidden on mobile (mobile sidebar appears earlier) */}
              <div className="hidden lg:block lg:col-span-1">
                <div className="space-y-6">
                  {/* Payment panel - account status, Paid/Failed summary (full duration), last 3 payments (above Quick Actions) */}
                  <div className="rounded-2xl lg:rounded-3xl border overflow-hidden bg-white border-emerald-200 shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                    <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-emerald-200 flex items-center justify-between" style={{ backgroundColor: paymentStatus === 'paid' ? '#ecfdf5' : paymentStatus === 'failed' || paymentStatus === 'past_due' ? '#fef2f2' : '#f9fafb' }}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          paymentStatus === 'paid'
                            ? 'bg-emerald-500'
                            : paymentStatus === 'failed' || paymentStatus === 'past_due'
                              ? 'bg-red-500'
                              : 'bg-gray-400'
                        }`}>
                          {paymentStatus === 'paid' ? (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : paymentStatus === 'failed' || paymentStatus === 'past_due' ? (
                            <span className="text-white text-lg font-bold">!</span>
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">Payment</p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            Account: {paymentStatus === 'paid' ? 'Paid up' : paymentStatus === 'failed' ? 'Payment failed' : paymentStatus === 'past_due' ? 'Past due' : paymentStatus === 'canceled' ? 'Canceled' : '—'}
                          </p>
                        </div>
                      </div>
                      <Link href="/client-portal/payments" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 whitespace-nowrap">
                        View all →
                      </Link>
                    </div>
                    <div className="p-4 sm:p-5">
                      {/* Paid / Pending / Failed summary (full duration - from Stripe) */}
                      {!loadingRecentPayments && (
                        <div className="flex flex-wrap items-center gap-4 mb-3 pb-3 border-b border-emerald-100">
                          <span className="text-sm font-medium text-green-700">Paid: {totalPaidCount}</span>
                          <span className="text-sm font-medium text-amber-700">Pending: {totalPendingCount}</span>
                          <span className="text-sm font-medium text-red-700">Failed: {totalFailedCount}</span>
                        </div>
                      )}
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Last 3 payments</p>
                      {loadingRecentPayments ? (
                        <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-emerald-500" />
                          Loading…
                        </div>
                      ) : recentInvoices.length === 0 ? (
                        <p className="text-sm text-gray-500 py-2">No payments yet</p>
                      ) : (
                        <ul className="space-y-2">
                          {recentInvoices.map((inv) => (
                            <li key={inv.id} className="flex items-center justify-between text-sm py-1.5 border-b border-emerald-50 last:border-0">
                              <span className="text-gray-700">{inv.date ? formatDate(inv.date) : '—'}</span>
                              <span className="text-gray-900 font-medium">{inv.currency} {(inv.amount ?? 0).toFixed(2)}</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                inv.status === 'paid' ? 'bg-green-100 text-green-800' : inv.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {inv.status === 'paid' ? 'Paid' : inv.status === 'open' ? 'Pending' : inv.status === 'draft' || inv.status === 'uncollectible' || inv.status === 'void' ? 'Failed' : inv.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link
                        href="/client-portal/payments"
                        className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700 mt-4"
                      >
                        View payment history →
                      </Link>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 sm:px-6 sm:py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                      <h3 className="text-base sm:text-lg font-bold text-gray-900">Quick Actions</h3>
                    </div>
                    <div className="p-4 sm:p-6 space-y-3">
                      {/* Coach Feedback Quick Link - Show if feedback is available */}
                      {recentResponses.some(r => r.hasFeedback && r.responseId && !r.clientApproved) && (() => {
                        const latestFeedback = recentResponses
                          .filter(r => r.hasFeedback && r.responseId && !r.clientApproved)
                          .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
                        return (
                          <Link
                            href={`/client-portal/feedback/${latestFeedback.responseId}`}
                            className="w-full text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm hover:shadow flex items-center justify-center relative overflow-hidden group"
                            style={{ backgroundColor: '#9333ea' }}
                          >
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                            <svg className="w-4 h-4 mr-2 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="relative z-10">View Coach Feedback</span>
                            <span className="ml-2 relative z-10 bg-white bg-opacity-30 rounded-full px-2 py-0.5 text-xs font-bold">
                              {recentResponses.filter(r => r.hasFeedback && !r.clientApproved).length}
                            </span>
                          </Link>
                        );
                      })()}
                      {coach && (
                        <Link
                          href="/client-portal/messages"
                          className="w-full text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm hover:shadow flex items-center justify-center"
                          style={{ backgroundColor: '#daa450' }}
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Message Coach
                        </Link>
                      )}
                      <Link
                        href="/client-portal/check-ins"
                        className="w-full text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm hover:shadow block"
                        style={{ backgroundColor: '#daa450' }}
                      >
                        View Check-ins
                      </Link>
                      <Link
                        href="/client-portal/progress"
                        className="w-full text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm hover:shadow block"
                        style={{ backgroundColor: '#daa450' }}
                      >
                        View Progress
                      </Link>
                      <Link
                        href="/client-portal/profile"
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm hover:shadow block"
                      >
                        Update Profile
                      </Link>
              </div>
            </div>


            {/* Progress Summary */}
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 sm:px-6 sm:py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                      <h3 className="text-base sm:text-lg font-bold text-gray-900">Progress Summary</h3>
                    </div>
                    <div className="p-4 sm:p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900">Completion Rate</span>
                        <span className="font-bold text-gray-900">
                          {stats.totalCheckins > 0 ? Math.round((stats.completedCheckins / stats.totalCheckins) * 100) : 0}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900">Performance</span>
                        <span className="font-bold text-gray-900">
                          {stats.averageScore >= 80 ? 'Excellent' : 
                           stats.averageScore >= 60 ? 'Good' : 'Needs Improvement'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-900">Active Streak</span>
                        <span className="font-bold text-gray-900">
                          {stats.lastActivity ? 'Current' : 'None'}
                        </span>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
              </div>
            </div>

            {/* Mobile-only Content - All dashboard elements together on mobile */}
            <div className="lg:hidden space-y-6 mb-6 mt-6">
              {/* Mobile Welcome */}
              <div className="mb-4">
                <h1 className="text-xl font-bold text-gray-900">Welcome Back!</h1>
                <p className="text-gray-600 text-xs mt-1">Track your progress and stay connected</p>
              </div>

              {/* Quick Stats Bar */}
              <div className="mb-6">
                <QuickStatsBar stats={analytics?.quickStats || null} loading={loadingAnalytics} />
              </div>

              {/* Payment panel - mobile: account status, full-duration summary + last 3 payments */}
              <div className="mb-6">
                <div className="rounded-2xl border overflow-hidden bg-white border-emerald-200 shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
                  <div className="px-4 py-3 border-b border-emerald-200 flex items-center justify-between" style={{ backgroundColor: paymentStatus === 'paid' ? '#ecfdf5' : paymentStatus === 'failed' || paymentStatus === 'past_due' ? '#fef2f2' : '#f9fafb' }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        paymentStatus === 'paid'
                          ? 'bg-emerald-500'
                          : paymentStatus === 'failed' || paymentStatus === 'past_due'
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                      }`}>
                        {paymentStatus === 'paid' ? (
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : paymentStatus === 'failed' || paymentStatus === 'past_due' ? (
                          <span className="text-white text-lg font-bold">!</span>
                        ) : (
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Payment</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          Account: {paymentStatus === 'paid' ? 'Paid up' : paymentStatus === 'failed' ? 'Failed' : paymentStatus === 'past_due' ? 'Past due' : paymentStatus === 'canceled' ? 'Canceled' : '—'}
                        </p>
                      </div>
                    </div>
                    <Link href="/client-portal/payments" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 whitespace-nowrap">
                      View all →
                    </Link>
                  </div>
                  <div className="p-4">
                    {/* Paid / Pending / Failed summary (full duration - from Stripe) */}
                    {!loadingRecentPayments && (
                      <div className="flex flex-wrap items-center gap-4 mb-3 pb-3 border-b border-emerald-100">
                        <span className="text-sm font-medium text-green-700">Paid: {totalPaidCount}</span>
                        <span className="text-sm font-medium text-amber-700">Pending: {totalPendingCount}</span>
                        <span className="text-sm font-medium text-red-700">Failed: {totalFailedCount}</span>
                      </div>
                    )}
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Last 3 payments</p>
                    {loadingRecentPayments ? (
                      <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-emerald-500" />
                        Loading…
                      </div>
                    ) : recentInvoices.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">No payments yet</p>
                    ) : (
                      <ul className="space-y-2">
                        {recentInvoices.map((inv) => (
                          <li key={inv.id} className="flex items-center justify-between text-sm py-1.5 border-b border-emerald-50 last:border-0">
                            <span className="text-gray-700">{inv.date ? formatDate(inv.date) : '—'}</span>
                            <span className="text-gray-900 font-medium">{inv.currency} {(inv.amount ?? 0).toFixed(2)}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.status === 'paid' ? 'bg-green-100 text-green-800' : inv.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                              {inv.status === 'paid' ? 'Paid' : inv.status === 'open' ? 'Pending' : inv.status === 'draft' || inv.status === 'uncollectible' || inv.status === 'void' ? 'Failed' : inv.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link href="/client-portal/payments" className="inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700 mt-4">
                      View payment history →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Onboarding Questionnaire Banner */}
              {onboardingStatus !== 'completed' && onboardingStatus !== 'submitted' && onboardingStatus !== 'skipped' && (
                <div className="bg-gradient-to-r from-[#daa450] to-[#c89540] rounded-2xl shadow-lg mb-4 overflow-hidden border border-[#daa450]/20 w-full">
                  <div className="px-4 py-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0 w-full">
                        <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-base font-bold text-white mb-1.5">Complete Your Onboarding Questionnaire</h2>
                          <p className="text-white/90 text-xs leading-relaxed">
                            {onboardingStatus === 'not_started' 
                              ? 'Help us understand your goals and preferences. This must be completed before you can receive check-ins.'
                              : `You're ${onboardingProgress}% complete. Finish the questionnaire to unlock check-ins.`
                            }
                          </p>
                          {onboardingProgress > 0 && (
                            <div className="mt-3 w-full bg-white/20 rounded-full h-2">
                              <div 
                                className="bg-white h-2 rounded-full transition-all duration-300"
                                style={{ width: `${onboardingProgress}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Link
                        href="/client-portal/onboarding-questionnaire"
                        className="w-full px-4 py-3 bg-white text-[#daa450] rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-md text-center text-sm min-h-[44px] flex items-center justify-center"
                      >
                        {onboardingStatus === 'not_started' ? 'Start Questionnaire' : 'Continue Questionnaire'}
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Upcoming Tasks */}
              {(() => {
                if (loadingTodos) return null;
                
                const hasOnboardingTasks = !onboardingTodos.hasWeight || !onboardingTodos.hasMeasurements || !onboardingTodos.hasBeforePhotos;
                const hasMeasurementTask = nextMeasurementTask && (nextMeasurementTask.status === 'upcoming' || nextMeasurementTask.status === 'due' || nextMeasurementTask.status === 'overdue');
                const hasTasks = hasOnboardingTasks || hasMeasurementTask;
                
                if (!hasTasks) return null;
                
                return (
                  <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 mb-4 overflow-hidden w-full">
                    <div className="px-4 py-3 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                          </div>
                          <div>
                            <h2 className="text-sm font-bold text-gray-900">Next Upcoming Tasks</h2>
                            <p className="text-gray-600 text-[10px] mt-0.5">Complete these tasks to stay on track</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 space-y-2">
                      {hasMeasurementTask && (
                        <Link
                          href="/client-portal/measurements"
                          className="flex items-center justify-between p-3 bg-white rounded-xl border-2 transition-all group"
                          style={{ 
                            borderColor: nextMeasurementTask!.status === 'overdue' ? '#ef4444' : '#daa450'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef9e7'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div 
                              className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: nextMeasurementTask!.status === 'overdue' ? '#ef4444' : '#daa450' }}
                            >
                              <svg className="w-4 h-4" style={{ color: nextMeasurementTask!.status === 'overdue' ? '#ef4444' : '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm text-gray-900 truncate">Update Measurements & Photos</h3>
                              <p className="text-xs text-gray-600 line-clamp-1">
                                {nextMeasurementTask!.status === 'overdue' && (
                                  <span className="text-red-600 font-medium">Overdue by {nextMeasurementTask!.daysUntil} {nextMeasurementTask!.daysUntil === 1 ? 'day' : 'days'}</span>
                                )}
                                {nextMeasurementTask!.status === 'due' && (
                                  <span className="font-medium" style={{ color: '#daa450' }}>Due today - {new Date(nextMeasurementTask!.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                )}
                                {nextMeasurementTask!.status === 'upcoming' && (
                                  <>Due {nextMeasurementTask!.daysUntil === 1 ? 'tomorrow' : `in ${nextMeasurementTask!.daysUntil} days`} - {new Date(nextMeasurementTask!.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</>
                                )}
                              </p>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                      {!onboardingTodos.hasWeight && (
                        <Link
                          href="/client-portal/measurements"
                          className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-[#daa450] hover:shadow-md transition-all group"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: '#daa450' }}>
                              <svg className="w-4 h-4" style={{ color: '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm text-gray-900 truncate">Enter Your Weight</h3>
                              <p className="text-xs text-gray-600 line-clamp-1">Record your starting weight to track progress</p>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                      {!onboardingTodos.hasMeasurements && (
                        <Link
                          href="/client-portal/measurements"
                          className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-[#daa450] hover:shadow-md transition-all group"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: '#daa450' }}>
                              <svg className="w-4 h-4" style={{ color: '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm text-gray-900 truncate">Add Your Measurements</h3>
                              <p className="text-xs text-gray-600 line-clamp-1">Record body measurements (waist, hips, chest, etc.)</p>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                      {!onboardingTodos.hasBeforePhotos && (
                        <Link
                          href="/client-portal/measurements"
                          className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-[#daa450] hover:shadow-md transition-all group"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: '#daa450' }}>
                              <svg className="w-4 h-4" style={{ color: '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm text-gray-900 truncate">Upload Before Photos</h3>
                              <p className="text-xs text-gray-600 line-clamp-2">Take and upload front, back, and side photos to track your transformation</p>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Check-ins Requiring Attention */}
              <div className="mb-6">
                <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="px-4 py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-bold text-gray-900">Check-ins Requiring Attention</h2>
                          <p className="text-gray-600 text-xs">Complete overdue and upcoming check-ins to stay on track</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="text-gray-600 text-sm font-medium">Needs Action</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {(() => {
                            // Filter actionable check-ins - match check-ins page logic exactly
                            const now = new Date();
                            const today = new Date(now);
                            today.setHours(0, 0, 0, 0);
                            
                            // Helper function to check if check-in window is open (Friday 10am to Tuesday 12pm)
                            const isCheckInOpenForWeek = (due: Date): boolean => {
                              const d = new Date(due);
                              const dayOfWeek = d.getDay();
                              const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
                              const weekMonday = new Date(d);
                              weekMonday.setDate(d.getDate() - daysToMonday);
                              weekMonday.setHours(0, 0, 0, 0);
                              
                              const windowOpen = new Date(weekMonday);
                              windowOpen.setDate(weekMonday.getDate() - 3); // Friday before Monday
                              windowOpen.setHours(10, 0, 0, 0);
                              
                              const windowClose = new Date(weekMonday);
                              windowClose.setDate(weekMonday.getDate() + 1); // Tuesday after Monday
                              windowClose.setHours(12, 0, 0, 0);
                              
                              return now >= windowOpen && now <= windowClose;
                            };
                            
                            const filtered = assignedCheckins.filter(checkIn => {
                              if (checkIn.status === 'completed') return false;
                              if (checkIn.status === 'missed') return false;
                              if ((checkIn as any).responseId || (checkIn as any).completedAt) return false;
                              if (checkIn.extensionGranted) return true;
                              const dueDate = new Date(checkIn.dueDate);
                              const normalizedDueDate = new Date(dueDate);
                              normalizedDueDate.setHours(0, 0, 0, 0);
                              
                              // Always include overdue check-ins (past due date) - highest priority
                              if (normalizedDueDate < today) return true;
                              
                              // Include check-ins due today
                              if (normalizedDueDate.getTime() === today.getTime()) return true;
                              
                              // Include if window is open (Friday 10am to Tuesday 12pm) - available now
                              // Use the original dueDate, not normalized, to preserve the time component
                              if (isCheckInOpenForWeek(dueDate)) return true;
                              
                              // Don't include future check-ins whose window isn't open yet
                              return false;
                            });
                            const deduplicatedMap = new Map<string, CheckIn>();
                            filtered.forEach(checkIn => {
                              const dueDate = new Date(checkIn.dueDate);
                              dueDate.setHours(0, 0, 0, 0);
                              const key = `${checkIn.formId}_${dueDate.toISOString().split('T')[0]}`;
                              if (!deduplicatedMap.has(key)) {
                                deduplicatedMap.set(key, checkIn);
                              }
                            });
                            return deduplicatedMap.size;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    {(() => {
                      // Filter actionable check-ins - match check-ins page logic exactly
                      const now = new Date();
                      const today = new Date(now);
                      today.setHours(0, 0, 0, 0);
                      
                      // Helper function to check if check-in window is open (Friday 10am to Tuesday 12pm)
                      const isCheckInOpenForWeek = (due: Date): boolean => {
                        const d = new Date(due);
                        const dayOfWeek = d.getDay();
                        const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
                        const weekMonday = new Date(d);
                        weekMonday.setDate(d.getDate() - daysToMonday);
                        weekMonday.setHours(0, 0, 0, 0);
                        
                        const windowOpen = new Date(weekMonday);
                        windowOpen.setDate(weekMonday.getDate() - 3); // Friday before Monday
                        windowOpen.setHours(10, 0, 0, 0);
                        
                        const windowClose = new Date(weekMonday);
                        windowClose.setDate(weekMonday.getDate() + 1); // Tuesday after Monday
                        windowClose.setHours(12, 0, 0, 0);
                        
                        return now >= windowOpen && now <= windowClose;
                      };
                      
                      const filteredCheckins = assignedCheckins.filter(checkIn => {
                        if (checkIn.status === 'completed') return false;
                        if (checkIn.status === 'missed') return false;
                        if ((checkIn as any).responseId || (checkIn as any).completedAt) return false;
                        if (checkIn.extensionGranted) return true;
                        const dueDate = new Date(checkIn.dueDate);
                        const normalizedDueDate = new Date(dueDate);
                        normalizedDueDate.setHours(0, 0, 0, 0);
                        
                        // Always include overdue check-ins (past due date) - highest priority
                        if (normalizedDueDate < today) return true;
                        
                        // Include check-ins due today
                        if (normalizedDueDate.getTime() === today.getTime()) return true;
                        
                        // Include if window is open (Friday 10am to Tuesday 12pm) - available now
                        // Use the original dueDate, not normalized, to preserve the time component
                        if (isCheckInOpenForWeek(dueDate)) return true;
                        
                        // Don't include future check-ins whose window isn't open yet
                        return false;
                      });
                      const deduplicatedMap = new Map<string, CheckIn>();
                      filteredCheckins.forEach(checkIn => {
                        const dueDate = new Date(checkIn.dueDate);
                        dueDate.setHours(0, 0, 0, 0);
                        const key = `${checkIn.formId}_${dueDate.toISOString().split('T')[0]}`;
                        if (!deduplicatedMap.has(key)) {
                          deduplicatedMap.set(key, checkIn);
                        }
                      });
                      const allUpcomingMobile = Array.from(deduplicatedMap.values()).sort((a, b) => {
                        const aDue = new Date(a.dueDate).getTime();
                        const bDue = new Date(b.dueDate).getTime();
                        const now = new Date().getTime();
                        const aIsOverdue = aDue < now;
                        const bIsOverdue = bDue < now;
                        if (aIsOverdue && !bIsOverdue) return -1;
                        if (!aIsOverdue && bIsOverdue) return 1;
                        if (aIsOverdue && bIsOverdue) return bDue - aDue;
                        return aDue - bDue;
                      });
                      const toLocalDateStrMobile = (d: Date) =>
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                      const getWeekMondayLocalStrMobile = (date: Date): string => {
                        const x = new Date(date);
                        const day = x.getDay();
                        const daysToMonday = day === 0 ? 6 : day - 1;
                        x.setDate(x.getDate() - daysToMonday);
                        x.setHours(0, 0, 0, 0);
                        return toLocalDateStrMobile(x);
                      };
                      const getCurrentWindowMondayStrMobile = (): string | null => {
                        const day = now.getDay();
                        const thisMonday = new Date(today);
                        const daysToMonday = day === 0 ? 6 : day - 1;
                        thisMonday.setDate(today.getDate() - daysToMonday);
                        const currentMonday = new Date(thisMonday);
                        if (day >= 5 || day === 0) currentMonday.setDate(thisMonday.getDate() + 7);
                        const checkMonday = new Date(currentMonday);
                        checkMonday.setHours(0, 0, 0, 0);
                        const windowOpen = new Date(checkMonday);
                        windowOpen.setDate(checkMonday.getDate() - 3);
                        windowOpen.setHours(10, 0, 0, 0);
                        const windowClose = new Date(checkMonday);
                        windowClose.setDate(checkMonday.getDate() + 1);
                        windowClose.setHours(12, 0, 0, 0);
                        if (now >= windowOpen && now <= windowClose) return toLocalDateStrMobile(checkMonday);
                        return null;
                      };
                      const currentWindowMondayStrMobile = getCurrentWindowMondayStrMobile();
                      const upcomingCheckins = currentWindowMondayStrMobile
                        ? allUpcomingMobile.filter((c) => {
                            const dueMondayStr = getWeekMondayLocalStrMobile(new Date(c.dueDate));
                            return dueMondayStr === currentWindowMondayStrMobile;
                          })
                        : [];
                      if (upcomingCheckins.length === 0) {
                        return (
                          <div className="text-center py-6">
                            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-gray-800 text-base font-bold mb-1">All caught up!</p>
                            <p className="text-gray-900 text-sm">No check-ins due this week. Great job!</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-4">
                          {upcomingCheckins.slice(0, 3).map((checkIn) => {
                            const dueDate = new Date(checkIn.dueDate);
                            const now = new Date();
                            
                            // Normalize both dates to start of day in local timezone for accurate day calculation
                            const dueDateStart = new Date(dueDate);
                            dueDateStart.setHours(0, 0, 0, 0);
                            const nowStart = new Date(now);
                            nowStart.setHours(0, 0, 0, 0);
                            
                            const daysDiff = Math.floor((dueDateStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24));
                            const isOverdue = daysDiff < 0;
                            const colorStatus = getCheckInColorStatus(checkIn);
                            const borderColor = colorStatus === 'red' ? 'border-red-300 bg-red-50' :
                                              colorStatus === 'orange' ? 'border-orange-300 bg-orange-50' :
                                              'border-green-300 bg-green-50';
                            const buttonBg = colorStatus === 'red' ? 'bg-red-600 hover:bg-red-700' :
                                            colorStatus === 'orange' ? 'bg-orange-600 hover:bg-orange-700' :
                                            'bg-green-600 hover:bg-green-700';
                            const buttonText = colorStatus === 'red' ? 'Complete Now' :
                                             colorStatus === 'orange' ? 'Complete Soon' :
                                             'Start Check-in';
                            return (
                              <div 
                                key={checkIn.id} 
                                className={`bg-white rounded-lg p-4 border-2 transition-all duration-200 ${borderColor}`}
                              >
                                <div className="flex flex-col gap-3">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-semibold text-gray-900 truncate">{checkIn.title}</h3>
                                    <p className="text-xs text-gray-600 mt-1">
                                      {isOverdue ? `${Math.abs(daysDiff)} day${Math.abs(daysDiff) !== 1 ? 's' : ''} overdue` :
                                       daysDiff === 0 ? 'Due Today!' : 
                                       daysDiff === 1 ? 'Due Tomorrow' : 
                                       `Due in ${daysDiff} days`}
                                    </p>
                                  </div>
                                  <Link
                                    href={`/client-portal/check-in/${checkIn.id}`}
                                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-white text-center ${buttonBg}`}
                                  >
                                    {buttonText}
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Stats Overview - Metric Cards */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-3 py-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#daa450' }}>
                        <span className="text-sm">{getTrafficLightIcon(averageTrafficLight)}</span>
                      </div>
                      {analytics?.scores.trend && analytics.scores.trend !== 'no_data' && (
                        <span className={`text-xs font-semibold ${
                          analytics.scores.trend === 'up' ? 'text-green-600' : 
                          analytics.scores.trend === 'down' ? 'text-red-600' : 
                          'text-gray-500'
                        }`}>
                          {analytics.scores.trend === 'up' ? '↑' : analytics.scores.trend === 'down' ? '↓' : '→'}
                        </span>
                      )}
                    </div>
                    <div className="mb-2.5">
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-xl font-bold text-gray-900">{stats?.averageScore || 0}</span>
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                      {stats?.averageScore > 0 && (
                        <div className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-700">
                          {getTrafficLightLabel(averageTrafficLight)}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Average Score</div>
                    {stats?.averageScore > 0 && stats?.completedCheckins > 0 && (
                      <div className="text-[10px] text-gray-600 mt-0.5">Based on {stats.completedCheckins} check-in{stats.completedCheckins !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-3 py-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {analytics?.quickStats.currentStreak > 0 && (
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 rounded">
                          <span className="text-[10px]">🔥</span>
                          <span className="text-[10px] font-bold text-orange-700">{analytics.quickStats.currentStreak}</span>
                        </div>
                      )}
                    </div>
                    <div className="mb-2.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-gray-900">
                          {stats?.totalCheckins > 0 ? Math.round((stats.completedCheckins / stats.totalCheckins) * 100) : 0}
                        </span>
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    </div>
                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Completion Rate</div>
                    {stats?.totalCheckins > 0 && (
                      <div className="text-[10px] text-gray-600 mt-0.5">{stats.completedCheckins} of {stats.totalCheckins} completed</div>
                    )}
                    {analytics?.quickStats.currentStreak > 0 && (
                      <div className="mt-1 inline-block px-1.5 py-0.5 bg-orange-50 rounded text-[10px] text-orange-700 font-semibold">
                        {analytics.quickStats.currentStreak} day{analytics.quickStats.currentStreak !== 1 ? 's' : ''} streak!
                      </div>
                    )}
                  </div>
                </div>

                {analytics?.bodyweight && analytics.bodyweight.baseline && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-3 py-3">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                          </svg>
                        </div>
                        {analytics.bodyweight.trend && analytics.bodyweight.trend !== 'no_data' && (
                          <span className={`text-xs font-semibold ${
                            analytics.bodyweight.trend === 'down' ? 'text-green-600' : 
                            analytics.bodyweight.trend === 'up' ? 'text-red-600' : 
                            'text-gray-500'
                          }`}>
                            {analytics.bodyweight.trend === 'down' ? '↓' : analytics.bodyweight.trend === 'up' ? '↑' : '→'}
                          </span>
                        )}
                      </div>
                      <div className="mb-2.5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-gray-900">
                            {analytics.bodyweight.current ? analytics.bodyweight.current.toFixed(1) : '-'}
                          </span>
                          <span className="text-sm text-gray-500">kg</span>
                        </div>
                        {analytics.bodyweight.change !== 0 && (
                          <div className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            analytics.bodyweight.change > 0 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                          }`}>
                            {analytics.bodyweight.change > 0 ? '↓' : '↑'} {Math.abs(analytics.bodyweight.change).toFixed(1)}kg
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Current Weight</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Images */}
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden mb-6">
                <div className="px-4 py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">Progress Images</h2>
                      <p className="text-gray-600 text-[10px] mt-1">Track your transformation</p>
                    </div>
                    <Link
                      href="/client-portal/progress-images"
                      className="px-3 py-2 text-white rounded-xl hover:opacity-90 transition-all duration-200 text-xs font-medium shadow-sm"
                      style={{ backgroundColor: '#daa450' }}
                    >
                      Manage
                    </Link>
                  </div>
                </div>
                <ProgressImagesPreview clientEmail={previewClientId ? undefined : userProfile?.email} clientId={clientId} />
              </div>

              {/* Progress Summary */}
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <h3 className="text-base font-bold text-gray-900">Progress Summary</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900">Completion Rate</span>
                    <span className="font-bold text-gray-900">
                      {stats.totalCheckins > 0 ? Math.round((stats.completedCheckins / stats.totalCheckins) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900">Performance</span>
                    <span className="font-bold text-gray-900">
                      {stats.averageScore >= 80 ? 'Excellent' : 
                       stats.averageScore >= 60 ? 'Good' : 'Needs Improvement'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900">Active Streak</span>
                    <span className="font-bold text-gray-900">
                      {stats.lastActivity ? 'Current' : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <h3 className="text-base font-bold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-4 space-y-3">
                  {coach && (
                    <Link
                      href="/client-portal/messages"
                      className="w-full text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm hover:shadow flex items-center justify-center"
                      style={{ backgroundColor: '#daa450' }}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Message Coach
                    </Link>
                  )}
                  <Link
                    href="/client-portal/check-ins"
                    className="w-full text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm hover:shadow block"
                    style={{ backgroundColor: '#daa450' }}
                  >
                    View Check-ins
                  </Link>
                  <Link
                    href="/client-portal/progress"
                    className="w-full text-white px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm hover:shadow block"
                    style={{ backgroundColor: '#daa450' }}
                  >
                    View Progress
                  </Link>
                  <Link
                    href="/client-portal/profile"
                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-3 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm hover:shadow block"
                  >
                    Update Profile
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </RoleProtected>
  );
} 