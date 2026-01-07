'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import QuickStatsBar from '@/components/client-portal/QuickStatsBar';

// Lazy load recharts components to reduce initial bundle size
const ResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false, loading: () => <div className="h-64 w-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div></div> }
);

const LineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  { ssr: false }
);

const Line = dynamic(
  () => import('recharts').then((mod) => mod.Line),
  { ssr: false }
);

const XAxis = dynamic(
  () => import('recharts').then((mod) => mod.XAxis),
  { ssr: false }
);

const YAxis = dynamic(
  () => import('recharts').then((mod) => mod.YAxis),
  { ssr: false }
);

const CartesianGrid = dynamic(
  () => import('recharts').then((mod) => mod.CartesianGrid),
  { ssr: false }
);

const Tooltip = dynamic(
  () => import('recharts').then((mod) => mod.Tooltip),
  { ssr: false }
);

const Legend = dynamic(
  () => import('recharts').then((mod) => mod.Legend),
  { ssr: false }
);
import { compressImage, shouldCompressImage } from '@/lib/image-compression';
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

/**
 * Client Portal Dashboard v2 - Redesigned
 * 
 * This is a development version of the new dashboard design.
 * Accessible at /client-portal2
 * 
 * Once complete, this will replace the current /client-portal dashboard.
 */

interface CheckIn {
  id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  formId: string;
  checkInWindow?: CheckInWindow;
  recurringWeek?: number;
}

interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
}

interface DashboardAnalytics {
  quickStats: {
    daysActive: number;
    totalCheckIns: number;
    weightChange: number;
    measurementChange: number;
    currentStreak: number;
  } | null;
  bodyweight: {
    baseline: number;
    current: number;
    change: number;
    trend: 'up' | 'down' | 'stable' | 'no_data';
  } | null;
  scores: {
    average: number;
    trend: 'up' | 'down' | 'stable' | 'no_data';
  } | null;
}

interface ProgressImage {
  id: string;
  imageUrl: string;
  imageType: 'profile' | 'before' | 'after' | 'progress';
  orientation?: 'front' | 'back' | 'side';
  uploadedAt: string;
  caption?: string;
}

interface RecentActivity {
  id: string;
  type: 'check-in' | 'weight' | 'measurement' | 'photo' | 'goal';
  title: string;
  date: string;
  details?: string;
  score?: number;
}

export default function ClientPortalPageV2() {
  const { userProfile } = useAuth();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [assignedCheckins, setAssignedCheckins] = useState<CheckIn[]>([]);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [progressImages, setProgressImages] = useState<ProgressImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<any[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [thresholds, setThresholds] = useState<ScoringThresholds>(getDefaultThresholds('moderate'));
  const [averageTrafficLight, setAverageTrafficLight] = useState<TrafficLightStatus>('orange');
  const [onboardingTodos, setOnboardingTodos] = useState({
    hasWeight: false,
    hasMeasurements: false,
    hasBeforePhotos: false,
  });
  const [nextMeasurementTask, setNextMeasurementTask] = useState<{
    dueDate: string;
    status: 'upcoming' | 'due' | 'overdue';
    daysUntil: number;
  } | null>(null);
  const [showBannerUploadModal, setShowBannerUploadModal] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerPosition, setBannerPosition] = useState({ x: 50, y: 50 }); // Percentage-based position for background image
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userProfile?.email) {
      fetchAllData();
    }
  }, [userProfile?.email]);

  useEffect(() => {
    if (clientId) {
      fetchGoals();
    }
  }, [clientId]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAnalytics(),
        fetchClientData(),
        fetchBannerImage(),
        fetchRecentActivities(),
        fetchProgressImages(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    if (!clientId) return;
    try {
      setLoadingGoals(true);
      const response = await fetch(`/api/client-portal/goals?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.goals) {
          setGoals(data.goals.filter((g: any) => g.status === 'active'));
        }
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoadingGoals(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoadingAnalytics(true);
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

      const response = await fetch('/api/client-portal/analytics', { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          let analyticsData = data.data;
          
          // ADD TEST DATA FOR PREVIEW (REMOVE BEFORE PRODUCTION)
          // Add test bodyweight history if there's less than 5 entries
          if (analyticsData.bodyweight?.history && analyticsData.bodyweight.history.length < 5) {
            const now = new Date();
            const testBodyweightHistory = [];
            const baseWeight = analyticsData.bodyweight?.current || 94.0;
            
            for (let i = 4; i >= 0; i--) {
              const date = new Date(now);
              date.setDate(date.getDate() - (i * 7)); // Weekly data
              testBodyweightHistory.push({
                date: date.toISOString().split('T')[0],
                weight: baseWeight + (Math.random() * 2 - 1) - (i * 0.2) // Slight downward trend
              });
            }
            
            analyticsData = {
              ...analyticsData,
              bodyweight: {
                ...analyticsData.bodyweight,
                history: testBodyweightHistory
              }
            };
          }
          
          // Add test score history if there's less than 5 entries
          if (analyticsData.scores?.history && analyticsData.scores.history.length < 5) {
            const now = new Date();
            const testScoreHistory = [];
            const baseScore = analyticsData.scores?.average || 76;
            
            for (let i = 4; i >= 0; i--) {
              const date = new Date(now);
              date.setDate(date.getDate() - (i * 7)); // Weekly data
              const score = Math.max(60, Math.min(95, baseScore + (Math.random() * 10 - 5) + (i * 2))); // Slight upward trend
              testScoreHistory.push({
                date: date.toISOString().split('T')[0],
                score: Math.round(score),
                color: score <= 60 ? 'red' : score <= 85 ? 'orange' : 'green'
              });
            }
            
            analyticsData = {
              ...analyticsData,
              scores: {
                ...analyticsData.scores,
                history: testScoreHistory,
                average: testScoreHistory.reduce((sum: number, e: any) => sum + e.score, 0) / testScoreHistory.length
              }
            };
          }
          
          setAnalytics(analyticsData);
          // Calculate traffic light status
          if (analyticsData.scores?.average) {
            const status = getTrafficLightStatus(analyticsData.scores.average, thresholds);
            setAverageTrafficLight(status);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchClientData = async () => {
    try {
      if (!userProfile?.email) return;

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

      const response = await fetch(
        `/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const { client, coach: coachData, checkInAssignments, summary, nextMeasurementTask: measurementTask } = data.data;
          
          if (client?.id) {
            setClientId(client.id);
          }
          
          if (coachData) {
            setCoach(coachData);
          }

          if (checkInAssignments) {
            setAssignedCheckins(checkInAssignments);
          }

          if (summary?.onboardingTodos) {
            setOnboardingTodos(summary.onboardingTodos);
          }

          if (measurementTask) {
            setNextMeasurementTask(measurementTask);
          }

          // Update scoring config
          if (client?.scoringConfig) {
            const config = convertLegacyThresholds(client.scoringConfig);
            setThresholds(config);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    }
  };

  const fetchBannerImage = async () => {
    try {
      if (!userProfile?.email) {
        return; // Silently return if no email
      }
      
      const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}`);
      if (!response.ok) {
        // Silently handle non-OK responses - banner image is optional
        return;
      }
      
      const data = await response.json();
      if (data.success && data.data?.client?.bannerImage) {
        setBannerImage(data.data.client.bannerImage);
        // Also update banner position if it exists
        if (data.data.client.bannerPosition) {
          setBannerPosition(data.data.client.bannerPosition);
        }
      }
    } catch (error) {
      // Silently handle errors - banner image is optional and shouldn't block page load
      console.warn('Could not fetch banner image (optional):', error);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      if (!clientId) return;
      
      const response = await fetch(`/api/client-portal/history?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.history) {
          // Transform history into activity items (last 5)
          const activities: RecentActivity[] = data.history
            .slice(0, 5)
            .map((item: any) => ({
              id: item.id,
              type: 'check-in' as const,
              title: item.checkInTitle || item.formTitle || 'Check-in completed',
              date: item.submittedAt,
              score: item.score,
              details: item.score ? `${item.score}%` : undefined,
            }));
          setRecentActivities(activities);
        }
      }
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  };

  const fetchProgressImages = async () => {
    try {
      if (!clientId) return;
      
      const response = await fetch(`/api/progress-images?clientId=${clientId}&limit=4`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Filter out invalid images
          const validImages = data.data.filter((img: any) => img.imageUrl && img.imageUrl.startsWith('http'));
          setProgressImages(validImages);
        }
      }
    } catch (error) {
      console.error('Error fetching progress images:', error);
    }
  };

  const handleBannerImageUpload = async (file: File) => {
    if (!clientId || !userProfile?.uid) return;
    
    setUploadingBanner(true);
    try {
      // Compress image if it's over 1MB
      let fileToUpload = file;
      if (shouldCompressImage(file, 1)) {
        try {
          fileToUpload = await compressImage(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            quality: 0.8,
          });
          console.log('Banner image compressed before upload');
        } catch (error) {
          console.error('Error compressing banner image:', error);
          // If compression fails, use original file
          fileToUpload = file;
        }
      }

      let idToken: string | null = null;
      if (typeof window !== 'undefined' && userProfile.uid) {
        try {
          const { auth } = await import('@/lib/firebase-client');
          if (auth?.currentUser) {
            idToken = await auth.currentUser.getIdToken();
          }
        } catch (authError) {
          console.warn('Could not get auth token:', authError);
        }
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('clientId', clientId);

      const headers: HeadersInit = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/client-portal/banner-image', {
        method: 'POST',
        headers,
        body: formData,
      });

      const result = await response.json();
      if (result.success && result.data?.imageUrl) {
        setBannerImage(result.data.imageUrl);
        setShowBannerUploadModal(false);
      } else {
        alert(result.message || 'Failed to upload banner image');
      }
    } catch (error) {
      console.error('Error uploading banner image:', error);
      alert('Failed to upload banner image. Please try again.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getCheckInColorStatus = (checkIn: CheckIn): 'red' | 'orange' | 'green' => {
    const dueDate = new Date(checkIn.dueDate);
    const now = new Date();
    const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) return 'red'; // Overdue
    
    const checkInWindow = checkIn.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
    const windowStatus = isWithinCheckInWindow(checkInWindow);
    const isFirstCheckIn = checkIn.recurringWeek === 1;
    
    if (daysDiff === 0 && (windowStatus.isOpen || isFirstCheckIn)) {
      if (windowStatus.message?.toLowerCase().includes('closing soon')) {
        return 'orange';
      }
      return 'green'; // Window is open
    }
    
    if (daysDiff <= 2) return 'orange'; // Due soon
    return 'green'; // Upcoming
  };

  const clientName = userProfile ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() : 'there';

  // Find next scheduled check-in
  const nextScheduledCheckIn = assignedCheckins
    .filter(checkIn => {
      const dueDate = new Date(checkIn.dueDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return checkIn.status === 'pending' && daysDiff >= 0;
    })
    .sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    })[0];

  // Find urgent check-ins (overdue or due today)
  const urgentCheckIns = assignedCheckins
    .filter(checkIn => {
      if (checkIn.status === 'completed') return false;
      const dueDate = new Date(checkIn.dueDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 0;
    })
    .slice(0, 2); // Max 2 urgent items

  return (
    <RoleProtected requiredRole="client">
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
              <p className="text-xs text-gray-500 truncate">Dashboard v2</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <NotificationBell />
          </div>
        </div>
        
        <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6 pt-20 lg:pt-6 overflow-x-hidden w-full bg-white relative z-0">
          <div className="max-w-7xl mx-auto w-full">
            {/* Desktop: Grid layout with main content and sidebar */}
            <div className="block lg:grid lg:grid-cols-3 lg:gap-6">
              
              {/* Main Content Column - Full width on mobile, 2/3 on desktop */}
              <div className="w-full block lg:col-span-2">
                
                {/* Header - Hidden on mobile, shown on desktop */}
                <div className="mb-6 hidden lg:block">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">Welcome Back!</h1>
                      <p className="text-gray-600 text-sm mt-1">Track your progress and stay connected</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <NotificationBell />
                    </div>
                  </div>
                </div>

                {/* Mobile Welcome - Shown only on mobile */}
                <div className="mb-4 lg:hidden">
                  <h1 className="text-xl font-bold text-gray-900">Welcome Back!</h1>
                  <p className="text-gray-600 text-xs mt-1">Track your progress and stay connected</p>
                </div>

                {/* Section 1: Hero Banner (Full Width) */}
                <div className="mb-6">
                  <div 
                    ref={bannerRef}
                    className="relative rounded-2xl lg:rounded-3xl overflow-hidden shadow-lg"
                    style={{
                      minHeight: '200px',
                      backgroundImage: bannerImage 
                        ? `url(${bannerImage})` 
                        : 'linear-gradient(135deg, #daa450 0%, #c89540 100%)',
                      backgroundSize: 'cover',
                      backgroundPosition: bannerImage ? `${bannerPosition.x}% ${bannerPosition.y}%` : 'center',
                      cursor: bannerImage ? 'move' : 'default',
                    }}
                    onMouseDown={(e) => {
                      if (!bannerImage || !bannerRef.current) return;
                      e.preventDefault();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startPos = { ...bannerPosition };

                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        if (!bannerRef.current) return;
                        const rect = bannerRef.current.getBoundingClientRect();
                        const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100;
                        const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100;

                        setBannerPosition({
                          x: Math.max(0, Math.min(100, startPos.x + deltaX)),
                          y: Math.max(0, Math.min(100, startPos.y + deltaY)),
                        });
                      };

                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                      };

                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                    title={bannerImage ? 'Click and drag to reposition image' : ''}
                  >
                    {/* Overlay for text readability */}
                    <div className="absolute inset-0 bg-black/40"></div>
                    
                    {/* Content */}
                    <div className="relative px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-16">
                      <div className="flex flex-col">
                        {/* Top Row: Avatar, Greeting, and Edit Button */}
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-4">
                            {userProfile?.avatar && (
                              <img 
                                src={userProfile.avatar} 
                                alt={clientName}
                                className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full border-3 border-white/90 flex-shrink-0 shadow-lg"
                              />
                            )}
                            <div>
                              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white" style={{ color: '#ffffff' }}>
                                {getTimeBasedGreeting()}, {clientName}!
                              </h2>
                              <p className="text-white text-base sm:text-lg lg:text-xl mt-2" style={{ color: '#ffffff' }}>
                                Track your progress and stay connected
                              </p>
                            </div>
                          </div>
                          
                          {/* Edit Banner Button */}
                          <button
                            onClick={() => setShowBannerUploadModal(true)}
                            className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-colors shadow-lg border border-white/20"
                            title="Edit banner image"
                          >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                        
                        {/* Primary CTA Button */}
                        <div className="mt-auto">
                          {nextScheduledCheckIn ? (
                            <Link
                              href={`/client-portal/check-in/${nextScheduledCheckIn.id}`}
                              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#daa450] rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-lg"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Complete Check-in
                            </Link>
                          ) : (
                            <Link
                              href="/client-portal/check-ins"
                              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#daa450] rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-lg"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              View Check-ins
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banner Image Upload Modal */}
                {showBannerUploadModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900">Edit Banner Image</h3>
                        <button
                          onClick={() => setShowBannerUploadModal(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-gray-600 text-sm mb-4">
                        Upload a motivational image (dream destination, family, goals, etc.)
                      </p>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              alert('Image size must be less than 5MB');
                              return;
                            }
                            handleBannerImageUpload(file);
                          }
                        }}
                        className="hidden"
                        id="banner-upload"
                      />
                      <label
                        htmlFor="banner-upload"
                        className="block w-full px-4 py-3 text-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#daa450] transition-colors"
                      >
                        <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700">
                          {uploadingBanner ? 'Uploading...' : 'Choose Image (Max 5MB)'}
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        Recommended: 1920x400px. JPG, PNG, or WebP.
                      </p>
                    </div>
                  </div>
                )}

                {/* Section 2: Priority Actions (Cards Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
                  {/* Next Check-in Card */}
                  {nextScheduledCheckIn && (
                    <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 overflow-hidden">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Next Check-in</h3>
                          <p className="text-sm sm:text-base font-medium text-gray-900 truncate mb-2">{nextScheduledCheckIn.title}</p>
                          <p className="text-xs sm:text-sm text-gray-600 mb-3">
                            {(() => {
                              const dueDate = new Date(nextScheduledCheckIn.dueDate);
                              const now = new Date();
                              const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                              return daysDiff === 0 ? 'Due today' : daysDiff === 1 ? 'Due tomorrow' : `Due in ${daysDiff} days`;
                            })()}
                          </p>
                          <Link
                            href={`/client-portal/check-in/${nextScheduledCheckIn.id}`}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity shadow-sm"
                            style={{ backgroundColor: '#daa450' }}
                          >
                            Start Check-in
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Urgent Actions Card */}
                  {urgentCheckIns.length > 0 && (
                    <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-2 border-red-200 p-4 sm:p-6 overflow-hidden">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 bg-red-100">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Action Required</h3>
                          <p className="text-sm text-red-600 font-medium mb-2">
                            {urgentCheckIns.length} check-in{urgentCheckIns.length !== 1 ? 's' : ''} need{urgentCheckIns.length === 1 ? 's' : ''} attention
                          </p>
                          <Link
                            href="/client-portal/check-ins"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm bg-red-600"
                          >
                            View All
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3: Progress Overview (Metric Cards) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
                  {/* Average Score Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-4 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#daa450' }}>
                          <span className="text-lg">{getTrafficLightIcon(averageTrafficLight)}</span>
                        </div>
                        {analytics?.scores?.trend && analytics.scores.trend !== 'no_data' && (
                          <span className={`text-sm font-semibold ${
                            analytics.scores.trend === 'up' ? 'text-green-600' : 
                            analytics.scores.trend === 'down' ? 'text-red-600' : 
                            'text-gray-500'
                          }`}>
                            {analytics.scores.trend === 'up' ? '↑' : analytics.scores.trend === 'down' ? '↓' : '→'}
                          </span>
                        )}
                      </div>
                      <div className="mb-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                            {analytics?.scores?.average || 0}
                          </span>
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                        {analytics?.scores?.average > 0 && (
                          <div className="inline-block px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700 mt-1">
                            {getTrafficLightLabel(averageTrafficLight)}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Average Score</div>
                    </div>
                  </div>

                  {/* Weight Progress Card */}
                  {analytics?.bodyweight && analytics.bodyweight.baseline && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-4 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                            </svg>
                          </div>
                          {analytics.bodyweight.trend && analytics.bodyweight.trend !== 'no_data' && (
                            <span className={`text-sm font-semibold ${
                              analytics.bodyweight.trend === 'down' ? 'text-green-600' : 
                              analytics.bodyweight.trend === 'up' ? 'text-red-600' : 
                              'text-gray-500'
                            }`}>
                              {analytics.bodyweight.trend === 'down' ? '↓' : analytics.bodyweight.trend === 'up' ? '↑' : '→'}
                            </span>
                          )}
                        </div>
                        <div className="mb-2">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                              {analytics.bodyweight.current ? analytics.bodyweight.current.toFixed(1) : '-'}
                            </span>
                            <span className="text-sm text-gray-500">kg</span>
                          </div>
                          {analytics.bodyweight.change !== 0 && (
                            <div className={`mt-1 inline-block px-2 py-1 rounded text-xs font-semibold ${
                              analytics.bodyweight.change > 0 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {analytics.bodyweight.change > 0 
                                ? `-${Math.abs(analytics.bodyweight.change).toFixed(1)}kg` 
                                : `+${Math.abs(analytics.bodyweight.change).toFixed(1)}kg`}
                            </div>
                          )}
                        </div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Weight</div>
                      </div>
                    </div>
                  )}

                  {/* Streak Card */}
                  {analytics?.quickStats && analytics.quickStats.currentStreak > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-4 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                          </div>
                          <span className="text-lg">🔥</span>
                        </div>
                        <div className="mb-2">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                              {analytics.quickStats.currentStreak}
                            </span>
                            <span className="text-sm text-gray-500">day{analytics.quickStats.currentStreak !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Streak</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 4: Recent Activity Timeline */}
                {recentActivities.length > 0 && (
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                      <Link href="/client-portal/progress" className="text-sm text-[#daa450] hover:text-[#c89540] font-medium">
                        View All →
                      </Link>
                    </div>
                    <div className="space-y-3">
                      {recentActivities.map((activity, index) => (
                        <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                          <div className="w-2 h-2 rounded-full bg-[#daa450] mt-2 flex-shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">{activity.title}</span>
                              {activity.score && (
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-700">
                                  {activity.score}%
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {new Date(activity.date).toLocaleDateString('en-US', { 
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
                )}

                {/* Section 5: Enhanced Analytics - Bodyweight & Score Trends */}
                {analytics && ((analytics.bodyweight?.history?.length >= 5) || (analytics.scores?.history?.length >= 5)) && (
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Progress Trends</h3>
                    <div className="space-y-6">
                      {/* Bodyweight Trend */}
                      {analytics.bodyweight?.history && analytics.bodyweight.history.length >= 5 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700">Bodyweight Trend</h4>
                            <span className="text-xs text-gray-500">
                              {analytics.bodyweight.change !== 0 && (
                                <span className={analytics.bodyweight.change > 0 ? 'text-green-600' : 'text-orange-600'}>
                                  {analytics.bodyweight.change > 0 ? '-' : '+'}{Math.abs(analytics.bodyweight.change).toFixed(1)}kg
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={analytics.bodyweight.history.slice(-8).map(entry => ({
                                  date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                  weight: Number(entry.weight.toFixed(1)),
                                  fullDate: entry.date
                                }))}
                                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#6b7280"
                                  fontSize={11}
                                  tick={{ fill: '#6b7280' }}
                                />
                                <YAxis 
                                  stroke="#6b7280"
                                  fontSize={11}
                                  tick={{ fill: '#6b7280' }}
                                  label={{ value: 'kg', position: 'insideLeft', angle: -90, style: { textAnchor: 'middle', fill: '#6b7280' } }}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'white', 
                                    border: '1px solid #e5e7eb', 
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                  }}
                                  formatter={(value: number) => [`${value}kg`, 'Weight']}
                                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate ? new Date(payload[0].payload.fullDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : label}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="weight" 
                                  stroke="#3b82f6"
                                  strokeWidth={2}
                                  dot={{ r: 4, fill: '#3b82f6', stroke: 'white', strokeWidth: 2 }}
                                  activeDot={{ r: 6 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Score Trend */}
                      {analytics.scores?.history && analytics.scores.history.length >= 5 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700">Check-in Score Trend</h4>
                            <span className="text-xs text-gray-500">
                              Avg: {analytics.scores.average.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={analytics.scores.history.slice(-8).map(entry => ({
                                  date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                  score: entry.score,
                                  fullDate: entry.date,
                                  color: entry.color
                                }))}
                                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#6b7280"
                                  fontSize={11}
                                  tick={{ fill: '#6b7280' }}
                                />
                                <YAxis 
                                  stroke="#6b7280"
                                  fontSize={11}
                                  tick={{ fill: '#6b7280' }}
                                  domain={[0, 100]}
                                  label={{ value: 'Score %', position: 'insideLeft', angle: -90, style: { textAnchor: 'middle', fill: '#6b7280' } }}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'white', 
                                    border: '1px solid #e5e7eb', 
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                  }}
                                  formatter={(value: number, name: string, props: any) => [
                                    `${value}% (${props.payload.color === 'green' ? 'On Track' : props.payload.color === 'orange' ? 'Needs Attention' : 'At Risk'})`,
                                    'Score'
                                  ]}
                                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate ? new Date(payload[0].payload.fullDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : label}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="score" 
                                  stroke="#daa450"
                                  strokeWidth={2}
                                  dot={(props: any) => {
                                    const { cx, cy, payload } = props;
                                    const color = payload.color === 'green' ? '#10b981' : payload.color === 'orange' ? '#f97316' : '#ef4444';
                                    return (
                                      <circle 
                                        cx={cx} 
                                        cy={cy} 
                                        r={4} 
                                        fill={color}
                                        stroke="white"
                                        strokeWidth={2}
                                      />
                                    );
                                  }}
                                  activeDot={{ r: 6 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section 6: Goals Progress */}
                {goals.length > 0 && (
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Your Goals</h3>
                      <Link href="/client-portal/goals" className="text-sm text-[#daa450] hover:text-[#c89540] font-medium">
                        View All →
                      </Link>
                    </div>
                    <div className="space-y-4">
                      {goals.slice(0, 3).map((goal) => {
                        const progress = goal.progress || 0;
                        const deadline = goal.deadline ? new Date(goal.deadline) : null;
                        const daysRemaining = deadline ? Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                        
                        return (
                          <div key={goal.id} className="border border-gray-200 rounded-xl p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-gray-900 mb-1">{goal.title}</h4>
                                {goal.description && (
                                  <p className="text-xs text-gray-600 mb-2">{goal.description}</p>
                                )}
                              </div>
                              {daysRemaining !== null && (
                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                  daysRemaining < 0 ? 'bg-red-100 text-red-700' :
                                  daysRemaining <= 7 ? 'bg-orange-100 text-orange-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {daysRemaining < 0 ? `${Math.abs(daysRemaining)} days overdue` :
                                   daysRemaining === 0 ? 'Due today' :
                                   `${daysRemaining} days left`}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="h-full bg-[#daa450] transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-semibold text-gray-700 min-w-[45px] text-right">
                                {progress.toFixed(0)}%
                              </span>
                            </div>
                            {goal.targetValue && goal.currentValue !== undefined && (
                              <p className="text-xs text-gray-600">
                                {goal.currentValue.toFixed(goal.unit === 'kg' ? 1 : 0)}{goal.unit} / {goal.targetValue.toFixed(goal.unit === 'kg' ? 1 : 0)}{goal.unit}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section 7: Progress Photos Gallery */}
                {progressImages.length > 0 && (
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Progress Photos</h3>
                      <Link href="/client-portal/progress-images" className="text-sm text-[#daa450] hover:text-[#c89540] font-medium">
                        View All →
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                      {progressImages.map((image) => (
                        <Link
                          key={image.id}
                          href="/client-portal/progress-images"
                          className="group relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 hover:border-[#daa450] transition-all hover:shadow-lg"
                        >
                          <img
                            src={image.imageUrl}
                            alt={image.caption || 'Progress photo'}
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
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs font-medium">
                              {new Date(image.uploadedAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Sidebar Column - Hidden on mobile, shown on desktop (1/3 width) */}
              <div className="hidden lg:block lg:col-span-1">
                
                {/* Section 1: Quick Stats (Compact) */}
                <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 mb-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4">Quick Stats</h3>
                  <div className="space-y-3">
                    {analytics?.quickStats && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Days Active</span>
                          <span className="font-semibold text-gray-900">{analytics.quickStats.daysActive}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Total Check-ins</span>
                          <span className="font-semibold text-gray-900">{analytics.quickStats.totalCheckIns}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Weight Change</span>
                          <span className={`font-semibold ${
                            analytics.quickStats.weightChange > 0 ? 'text-green-700' : 
                            analytics.quickStats.weightChange < 0 ? 'text-orange-700' : 
                            'text-gray-900'
                          }`}>
                            {analytics.quickStats.weightChange > 0 
                              ? `-${Math.abs(analytics.quickStats.weightChange).toFixed(1)}kg` 
                              : analytics.quickStats.weightChange < 0 
                              ? `+${Math.abs(analytics.quickStats.weightChange).toFixed(1)}kg` 
                              : 'No change'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Measurements</span>
                          <span className={`font-semibold ${
                            analytics.quickStats.measurementChange > 0 ? 'text-green-700' : 
                            analytics.quickStats.measurementChange < 0 ? 'text-orange-700' : 
                            'text-gray-900'
                          }`}>
                            {analytics.quickStats.measurementChange > 0 
                              ? `-${Math.abs(analytics.quickStats.measurementChange).toFixed(1)}cm` 
                              : analytics.quickStats.measurementChange < 0 
                              ? `+${Math.abs(analytics.quickStats.measurementChange).toFixed(1)}cm` 
                              : 'No change'}
                          </span>
                        </div>
                        {analytics.quickStats.currentStreak > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Streak</span>
                            <span className="font-semibold text-orange-700 flex items-center gap-1">
                              {analytics.quickStats.currentStreak} 🔥
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Section 2: Coach Connection */}
                {coach && (
                  <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 mb-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4">Your Coach</h3>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-sm">
                          {coach.firstName?.charAt(0)}{coach.lastName?.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {coach.firstName} {coach.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{coach.email}</p>
                      </div>
                    </div>
                    <Link
                      href="/client-portal/messages"
                      className="w-full px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                      style={{ backgroundColor: '#daa450' }}
                    >
                      Message Coach
                    </Link>
                  </div>
                )}

                {/* Section 3: Monthly Leaderboard - Placeholder */}
                <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 mb-6">
                  <h3 className="text-base font-bold text-gray-900 mb-2">Top Performers</h3>
                  <p className="text-gray-600 text-xs mb-4">This Month</p>
                  <div className="space-y-3">
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Leaderboard coming soon
                      <p className="text-xs mt-2">Will show top 3 clients by habit completion rate</p>
                    </div>
                  </div>
                </div>

                {/* Section 4: Quick Actions */}
                <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 mb-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <Link
                      href="/client-portal/progress"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      View Progress
                    </Link>
                    <Link
                      href="/client-portal/check-ins"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Start Check-in
                    </Link>
                    <Link
                      href="/client-portal/measurements"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Upload Photo
                    </Link>
                    <Link
                      href="/client-portal/measurements"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Add Measurement
                    </Link>
                    <Link
                      href="/client-portal/messages"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Message Coach
                    </Link>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </main>
      </div>
    </RoleProtected>
  );
}
