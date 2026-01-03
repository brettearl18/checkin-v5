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
  status: 'pending' | 'completed' | 'overdue';
  formId: string;
  checkInWindow?: CheckInWindow;
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

// Progress Images Preview Component
function ProgressImagesPreview({ clientEmail }: { clientEmail: string }) {
  const [images, setImages] = useState<ProgressImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (clientEmail) {
      // First fetch client ID
      fetch(`/api/client-portal?clientEmail=${encodeURIComponent(clientEmail)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data.client) {
            setClientId(data.data.client.id);
          } else {
            setLoading(false);
          }
        })
        .catch(err => {
          console.error('Error fetching client ID:', err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [clientEmail]);

  useEffect(() => {
    if (clientId) {
      fetch(`/api/progress-images?clientId=${clientId}&limit=4`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setImages(data.data || []);
          }
        })
        .catch(err => console.error('Error fetching progress images:', err))
        .finally(() => setLoading(false));
    }
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
          <div key={image.id} className="group relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200/60 hover:border-pink-400/80 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-white/50 backdrop-blur-sm">
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
            <div className="absolute bottom-1 right-1">
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-black/60 text-white">
                {new Date(image.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClientPortalPage() {
  const { userProfile } = useAuth();
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

  useEffect(() => {
    if (userProfile?.email) {
      fetchClientData();
    } else if (userProfile === null) {
      // User profile is loaded but no email - this is an error state
      setLoading(false);
    }
    // If userProfile is undefined, it's still loading, so we wait
  }, [userProfile?.email]);

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

  const fetchClientData = async () => {
    try {
      // Fetch client-specific data using email (more reliable than UID)
      const clientEmail = userProfile?.email;
      
      if (!clientEmail) {
        console.warn('No client email available - user profile may still be loading');
        setLoading(false);
        return;
      }
      
      // Fetch real data from API using email with timeout
      // Try fetching by email first, but also pass user UID as fallback
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      try {
        const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(clientEmail)}${userProfile?.uid ? `&userUid=${encodeURIComponent(userProfile.uid)}` : ''}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
          if (data.success) {
          const { client, coach, checkInAssignments, summary, nextMeasurementTask } = data.data;
          
          // Store client ID (Phase 1: All data now comes from API)
          if (client?.id) {
            setClientId(client.id);
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
              responseId: r.id || r.responseId || ''
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
              checkInWindow: assignment.checkInWindow || DEFAULT_CHECK_IN_WINDOW
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
    } catch (error) {
      console.error('Error in fetchClientData:', error);
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

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
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
            <div className="lg:grid lg:grid-cols-3 lg:gap-6">
              {/* Main Content Column */}
              <div className="lg:col-span-2">
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

            {/* Mobile Welcome - Shown only on mobile */}
            <div className="mb-4 lg:hidden">
              <h1 className="text-xl font-bold text-gray-900">Welcome Back!</h1>
              <p className="text-gray-600 text-xs mt-1">Track your progress and stay connected</p>
            </div>


            {/* Next Check-in Section - Prominent banner at top */}
            {(() => {
              // Find next scheduled check-in (not overdue, includes today and future dates)
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              
              const nextScheduled = assignedCheckins
                .filter(checkIn => {
                  const dueDate = new Date(checkIn.dueDate);
                  dueDate.setHours(0, 0, 0, 0);
                  const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  
                  // Include pending check-ins that are due today or in the future (not overdue)
                  return checkIn.status === 'pending' && daysDiff >= 0;
                })
                .sort((a, b) => {
                  const dateA = new Date(a.dueDate).getTime();
                  const dateB = new Date(b.dueDate).getTime();
                  return dateA - dateB; // Earliest first
                })[0]; // Get the first one (next upcoming)

              if (!nextScheduled) return null;

              const dueDate = new Date(nextScheduled.dueDate);
              const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              
              return (
                <div className="mb-6">
                  <div className="bg-[#fef9e7] border-2 border-[#daa450] rounded-2xl lg:rounded-3xl p-4 sm:p-6 shadow-sm">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Next Check-in</h2>
                        <p className="text-sm sm:text-base font-medium text-gray-900 truncate">{nextScheduled.title}</p>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          Due: {dueDate.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                          {daysDiff === 0 ? ' (Today)' : daysDiff === 1 ? ' (Tomorrow)' : daysDiff > 1 ? ` (in ${daysDiff} days)` : ''}
                        </p>
                      </div>
                      <Link
                        href="/client-portal/check-ins"
                        className="flex-shrink-0 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-opacity shadow-sm"
                        style={{ backgroundColor: '#daa450' }}
                      >
                        View
                      </Link>
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
            {!loadingTodos && (() => {
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

            {/* Check-ins Requiring Attention - Priority action items */}
            <div className="mb-6">
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
                        <p className="text-gray-600 text-xs sm:text-sm hidden sm:block">Complete overdue and upcoming check-ins to stay on track</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="text-gray-600 text-sm font-medium">Needs Action</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {(() => {
                          // Filter actionable check-ins
                          const filtered = assignedCheckins.filter(checkIn => {
                            // Exclude completed check-ins
                            if (checkIn.status === 'completed') return false;

                            const dueDate = new Date(checkIn.dueDate);
                            const now = new Date();
                            
                            // Normalize dates for comparison (set to start of day) - matches check-ins page logic exactly
                            const normalizedDueDate = new Date(dueDate);
                            normalizedDueDate.setHours(0, 0, 0, 0);
                            const normalizedNow = new Date(now);
                            normalizedNow.setHours(0, 0, 0, 0);
                            
                            // Include if overdue (past due date - always need attention)
                            if (normalizedDueDate < normalizedNow) return true;
                            
                            // Include if due date has arrived AND window is open (available now) - matches getToDoCheckins logic
                            if (normalizedDueDate <= normalizedNow) {
                              const checkInWindow = checkIn.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
                              const windowStatus = isWithinCheckInWindow(checkInWindow);
                              const isFirstCheckIn = checkIn.recurringWeek === 1;
                              if (windowStatus.isOpen || isFirstCheckIn) return true;
                            }
                            
                            // Don't include future check-ins - they belong in "Scheduled", not "Requiring Attention"
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
                  // Filter actionable check-ins
                  const filteredCheckins = assignedCheckins.filter(checkIn => {
                    // Exclude completed check-ins
                    if (checkIn.status === 'completed') return false;

                    const dueDate = new Date(checkIn.dueDate);
                    const now = new Date();
                    
                    // Normalize dates for comparison (set to start of day) - matches getToDoCheckins logic exactly
                    const normalizedDueDate = new Date(dueDate);
                    normalizedDueDate.setHours(0, 0, 0, 0);
                    const normalizedNow = new Date(now);
                    normalizedNow.setHours(0, 0, 0, 0);
                    
                    // Include if overdue (past due date - always need attention)
                    if (normalizedDueDate < normalizedNow) return true;
                    
                    // Include if due date has arrived AND window is open (available now)
                    // Special case: Week 1 check-ins are accessible immediately once due date arrives
                    if (normalizedDueDate <= normalizedNow) {
                      const checkInWindow = checkIn.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
                      const windowStatus = isWithinCheckInWindow(checkInWindow);
                      const isFirstCheckIn = checkIn.recurringWeek === 1;
                      if (windowStatus.isOpen || isFirstCheckIn) return true;
                    }
                    
                    // Don't include future check-ins - they belong in "Scheduled", not "Requiring Attention"
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

                  const upcomingCheckins = Array.from(deduplicatedMap.values()).sort((a, b) => {
                    // Sort: overdue check-ins first (most overdue first), then upcoming check-ins (earliest first)
                    const aDue = new Date(a.dueDate).getTime();
                    const bDue = new Date(b.dueDate).getTime();
                    const now = new Date().getTime();
                    const aIsOverdue = aDue < now;
                    const bIsOverdue = bDue < now;
                    
                    if (aIsOverdue && !bIsOverdue) return -1; // a is overdue, b is not - a comes first
                    if (!aIsOverdue && bIsOverdue) return 1;  // b is overdue, a is not - b comes first
                    if (aIsOverdue && bIsOverdue) return aDue - bDue; // Both overdue - most overdue first
                    return aDue - bDue; // Both upcoming - earliest first
                  });

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
                      {upcomingCheckins.map((checkIn) => {
                        const dueDate = new Date(checkIn.dueDate);
                        const now = new Date();
                        const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
                                    {dueDate.toLocaleDateString('en-US', { 
                                      weekday: 'short', 
                                      month: 'short', 
                                      day: 'numeric' 
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
            </div>

            {/* Stats Overview - Simplified to 2 cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-3 sm:px-4 sm:py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: '#daa450' }}>
                      <span className="text-lg sm:text-xl">{getTrafficLightIcon(averageTrafficLight)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 mb-1">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stats?.averageScore || 0}%</div>
                    {stats?.averageScore > 0 && (
                      <span className="text-[10px] sm:text-xs font-semibold text-gray-600">
                        {getTrafficLightLabel(averageTrafficLight)}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-600 font-medium">Average Score</div>
                  {stats?.averageScore > 0 && stats?.completedCheckins > 0 && (
                    <div className="text-[10px] sm:text-xs text-gray-500 mt-1">Based on {stats.completedCheckins} check-in{stats.completedCheckins !== 1 ? 's' : ''}</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-3 sm:px-4 sm:py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#34C759] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {stats?.totalCheckins > 0 ? Math.round((stats.completedCheckins / stats.totalCheckins) * 100) : 0}%
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-600 mt-1 font-medium">Completion Rate</div>
                  {stats?.totalCheckins > 0 && (
                    <div className="text-[10px] sm:text-xs text-gray-500 mt-1">{stats.completedCheckins} of {stats.totalCheckins} completed</div>
                  )}
                </div>
              </div>
            </div>


            {/* Progress Images */}
            <div className="hidden lg:block bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden mb-6">
              <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Progress Images</h2>
                    <p className="text-gray-600 text-xs sm:text-sm mt-1">Track your transformation</p>
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
              <ProgressImagesPreview clientEmail={userProfile?.email || ''} />
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
                  {/* Quick Actions */}
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 sm:px-6 sm:py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                      <h3 className="text-base sm:text-lg font-bold text-gray-900">Quick Actions</h3>
                    </div>
                    <div className="p-4 sm:p-6 space-y-3">
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

            {/* Sidebar Content - On mobile, these appear after main content */}
            <div className="lg:hidden space-y-6 mb-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 sm:px-6 sm:py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-4 sm:p-6 space-y-3">
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

              {/* Progress Summary - Mobile only */}
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
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

              {/* Progress Images - Mobile only */}
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 sm:px-6 sm:py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-gray-900">Progress Images</h3>
                      <p className="text-gray-600 text-[10px] sm:text-xs mt-1">Track your transformation</p>
                    </div>
                    <Link
                      href="/client-portal/progress-images"
                      className="px-3 py-1.5 text-white rounded-xl hover:opacity-90 transition-all duration-200 text-xs font-medium shadow-sm"
                      style={{ backgroundColor: '#daa450' }}
                    >
                      Manage
                    </Link>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  <ProgressImagesPreview clientEmail={userProfile?.email || ''} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </RoleProtected>
  );
} 