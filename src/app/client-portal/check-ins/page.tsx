'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { isWithinCheckInWindow, getCheckInWindowDescription, DEFAULT_CHECK_IN_WINDOW, CheckInWindow } from '@/lib/checkin-window-utils';
import { getTrafficLightStatus, getDefaultThresholds, convertLegacyThresholds, type ScoringThresholds } from '@/lib/scoring-utils';

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
  checkInWindow?: CheckInWindow;
  isRecurring?: boolean;
  recurringWeek?: number;
  totalWeeks?: number;
  responseId?: string;
  coachResponded?: boolean;
}

export default function ClientCheckInsPage() {
  const { userProfile, authLoading } = useAuth();
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'toDo' | 'scheduled' | 'completed'>('scheduled');
  const [clientId, setClientId] = useState<string | null>(null);
  const [completedResponses, setCompletedResponses] = useState<any[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedFilter, setCompletedFilter] = useState('all'); // all, recent, high-score, low-score
  const [coachTimezone, setCoachTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [thresholds, setThresholds] = useState<ScoringThresholds>(getDefaultThresholds('lifestyle'));

  useEffect(() => {
    // Wait for auth to finish loading before fetching client ID
    if (!authLoading && userProfile?.email) {
      fetchClientId();
    }
  }, [userProfile?.email, authLoading]);

  useEffect(() => {
    if (clientId) {
      fetchCheckIns();
      fetchScoringConfig();
      if (filter === 'completed') {
        fetchCompletedResponses();
      }
    }
  }, [clientId, filter]);

  useEffect(() => {
    fetchCoachTimezone();
  }, [userProfile?.uid]);

  const fetchClientId = async () => {
    try {
      if (!userProfile?.email) {
        console.warn('No user email available yet');
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

  const fetchCompletedResponses = async () => {
    try {
      setCompletedLoading(true);
      if (!clientId) return;

      const response = await fetch(`/api/client-portal/history?clientId=${clientId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCompletedResponses(data.history || []);
        }
      }
    } catch (error) {
      console.error('Error fetching completed responses:', error);
    } finally {
      setCompletedLoading(false);
    }
  };

  const fetchScoringConfig = async () => {
    try {
      if (!clientId) return;
      
      const scoringDoc = await getDoc(doc(db, 'clientScoring', clientId));
      if (scoringDoc.exists()) {
        const scoringData = scoringDoc.data();
        let clientThresholds: ScoringThresholds;

        // Check if new format (redMax/orangeMax) exists
        if (scoringData.thresholds?.redMax !== undefined && scoringData.thresholds?.orangeMax !== undefined) {
          clientThresholds = {
            redMax: scoringData.thresholds.redMax,
            orangeMax: scoringData.thresholds.orangeMax
          };
        } else if (scoringData.thresholds?.red !== undefined && scoringData.thresholds?.yellow !== undefined) {
          // Convert legacy format
          clientThresholds = convertLegacyThresholds(scoringData.thresholds);
        } else if (scoringData.scoringProfile) {
          // Use profile defaults
          clientThresholds = getDefaultThresholds(scoringData.scoringProfile as any);
        } else {
          // Default to moderate
          clientThresholds = getDefaultThresholds('moderate');
        }

        setThresholds(clientThresholds);
      } else {
        // No scoring config, use default moderate thresholds
        setThresholds(getDefaultThresholds('moderate'));
      }
    } catch (error) {
      console.error('Error fetching scoring config:', error);
      // Use default moderate thresholds on error
      setThresholds(getDefaultThresholds('moderate'));
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
        // Ensure checkInWindow is properly structured for each check-in
        const processedCheckins = result.data.checkins.map((checkin: any) => {
          // Log the raw check-in data for debugging
          console.log('Raw check-in data:', {
            id: checkin.id,
            title: checkin.title,
            dueDate: checkin.dueDate,
            checkInWindow: checkin.checkInWindow,
            status: checkin.status
          });

          // Ensure checkInWindow has the correct structure
          let checkInWindow = DEFAULT_CHECK_IN_WINDOW;
          if (checkin.checkInWindow) {
            if (typeof checkin.checkInWindow === 'object' && 
                checkin.checkInWindow.enabled !== undefined &&
                checkin.checkInWindow.startDay &&
                checkin.checkInWindow.startTime) {
              checkInWindow = checkin.checkInWindow;
            } else {
              console.warn('Invalid checkInWindow structure for check-in:', checkin.id, checkin.checkInWindow);
            }
          }

          return {
            ...checkin,
            checkInWindow
          };
        });
        
        console.log('Processed check-ins:', processedCheckins.length, processedCheckins);
        setCheckins(processedCheckins);
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

  // Calculate the start date of the check-in window for a given due date
  // Returns the Friday (or startDay) of the week that contains the due date
  // For example: If due date is Monday Jan 12, and start day is Friday, return Friday Jan 16 of that same week
  const getCheckInWindowStartDate = (dueDate: string, window?: CheckInWindow): Date => {
    const due = new Date(dueDate);
    const checkInWindow = window || DEFAULT_CHECK_IN_WINDOW;
    
    if (!checkInWindow.enabled) {
      return due; // If window is disabled, use due date
    }
    
    // Get the day of week for the start day (e.g., Friday = 5)
    const startDayNum = getDayOfWeek(checkInWindow.startDay);
    
    // Get the day of week for the due date (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dueDayOfWeek = due.getDay();
    
    // Calculate days to add to get to the start day of that week
    // We want the start day of the week containing the due date
    // If due date is Monday (1) and start day is Friday (5):
    // We need to add 4 days (Monday -> Tuesday -> Wednesday -> Thursday -> Friday)
    // Formula: (startDayNum - dueDayOfWeek + 7) % 7
    let daysToAdd = (startDayNum - dueDayOfWeek + 7) % 7;
    
    // Create a new date at the start day of the week
    const windowStartDate = new Date(due);
    windowStartDate.setDate(due.getDate() + daysToAdd);
    windowStartDate.setHours(0, 0, 0, 0); // Reset to start of day
    
    return windowStartDate;
  };

  // Helper function to get day of week number (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const getDayOfWeek = (dayName: string): number => {
    const days: { [key: string]: number } = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6
    };
    return days[dayName.toLowerCase()] ?? 5; // Default to Friday
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

  // "To Do" - Actionable check-ins that need attention
  // Includes: overdue check-ins OR check-ins that are available now (window is open)
  // Does NOT include future check-ins whose window hasn't opened yet (those go in "Scheduled")
  const getToDoCheckins = () => {
    const now = new Date();

    return checkins.filter(checkin => {
      // Exclude completed check-ins from "To Do"
      if (checkin.status === 'completed') return false;

      const dueDate = new Date(checkin.dueDate);
      
      // Normalize dates for comparison (set to start of day)
      dueDate.setHours(0, 0, 0, 0);
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      // Include if overdue (past due date)
      if (dueDate < today) return true;
      
      // Include if due date has arrived AND window is open (available now)
      // Special case: Week 1 check-ins are accessible immediately once due date arrives
      if (dueDate <= today) {
        const checkInWindow = checkin.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
        const windowStatus = isWithinCheckInWindow(checkInWindow);
        const isFirstCheckIn = checkin.recurringWeek === 1;
        if (windowStatus.isOpen || isFirstCheckIn) return true;
      }
      
      // Do NOT include future check-ins - they belong in "Scheduled" tab
      return false;
    });
  };

  // "Scheduled" - ALL upcoming check-ins
  // Shows all upcoming check-ins so users can see what's coming and when windows open
  const getScheduledCheckins = () => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const futureCheckins = checkins
      .filter(checkin => {
        // Exclude completed check-ins from "Scheduled"
        if (checkin.status === 'completed') return false;
        const dueDate = new Date(checkin.dueDate);
        // Normalize due date to start of day for accurate comparison
        dueDate.setHours(0, 0, 0, 0);
        // Only include future check-ins (due date is today or later)
        return dueDate >= startOfToday;
      })
      .sort((a, b) => {
        // Sort by due date (earliest first)
        const dateA = new Date(a.dueDate).getTime();
        const dateB = new Date(b.dueDate).getTime();
        return dateA - dateB;
      });
    // Return ALL upcoming check-ins (removed .slice(0, 2))

    return futureCheckins;
  };


  const filteredCompletedResponses = completedResponses.filter(item => {
    switch (completedFilter) {
      case 'recent':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return new Date(item.submittedAt) > thirtyDaysAgo;
      case 'high-score':
        return item.score >= 80;
      case 'low-score':
        return item.score < 60;
      default:
        return true;
    }
  });

  const formatHistoryDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Compute check-in lists once
  const toDoCheckins = getToDoCheckins();
  const scheduledCheckins = getScheduledCheckins();
  const completedCheckins = checkins.filter(c => c.status === 'completed');
  
  // Only show "To Do" tab if there are check-ins that need attention
  const showToDoTab = toDoCheckins.length > 0;
  
  // If "To Do" tab is selected but there are no to-do items, switch to "Scheduled"
  useEffect(() => {
    if (filter === 'toDo' && !showToDoTab) {
      setFilter('scheduled');
    }
  }, [filter, showToDoTab]);

  const filteredCheckins = (() => {
    let result: CheckIn[] = [];
    
    // Determine which check-in is shown in the banner (to exclude from lists if needed)
    const bannerCheckin = toDoCheckins[0] || null; // Only from toDo, no fallback
    const nextScheduledForBanner = !bannerCheckin && scheduledCheckins.length > 0 ? scheduledCheckins[0] : null;
    const bannerCheckinId = bannerCheckin?.id || nextScheduledForBanner?.id || null;
    
    switch (filter) {
      case 'toDo':
        result = toDoCheckins;
        // Sort by urgency: overdue first, then available now, then due soon
        return result.sort((a, b) => {
          const aDue = new Date(a.dueDate).getTime();
          const bDue = new Date(b.dueDate).getTime();
          const now = new Date().getTime();
          
          // Overdue first
          if (aDue < now && bDue >= now) return -1;
          if (bDue < now && aDue >= now) return 1;
          
          // Then available now
          const aWindow = a.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
          const bWindow = b.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
          const aAvailable = isWithinCheckInWindow(aWindow).isOpen;
          const bAvailable = isWithinCheckInWindow(bWindow).isOpen;
          if (aAvailable && !bAvailable) return -1;
          if (bAvailable && !aAvailable) return 1;
          
          // Then by due date (earliest first)
          return aDue - bDue;
        });
      case 'scheduled':
        result = scheduledCheckins;
        
        // If no scheduled check-ins, return empty array
        if (result.length === 0) {
          return [];
        }
        
        // Sort by due date (earliest first), then by week number if same due date
        result = result.sort((a, b) => {
          const dateA = new Date(a.dueDate).getTime();
          const dateB = new Date(b.dueDate).getTime();
          
          if (dateA !== dateB) {
            return dateA - dateB;
          }
          
          // If same due date, sort by week number (ascending) as secondary sort
          const weekA = (a.isRecurring && a.recurringWeek) ? a.recurringWeek : 0;
          const weekB = (b.isRecurring && b.recurringWeek) ? b.recurringWeek : 0;
          return weekA - weekB;
        });
        
        // Exclude the check-in shown in the banner (if it's from scheduled list)
        // Only exclude if banner is showing nextScheduled (when there's no current/available check-in)
        if (nextScheduledForBanner && !bannerCheckin) {
          result = result.filter(c => c.id !== bannerCheckinId);
        }
        
        // Show only the next upcoming check-in (after excluding banner check-in)
        return result.slice(0, 1);
      case 'completed':
        // For completed tab, we'll use completedResponses (formResponses) instead of assignments
        // Return empty array here - we'll handle rendering separately
        return [];
      default:
        result = checkins;
    }
    return result;
  })();

  // Helper function to get time until due date
  const getTimeUntilDue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMs < 0) {
      const daysOverdue = Math.abs(diffDays);
      return daysOverdue === 0 ? 'Due today' : `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`;
    }
    
    if (diffHours < 1) return 'Due in less than an hour';
    if (diffHours < 24) return `Due in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  };

  // Helper function to get card border color based on status, availability, and score
  const getCardBorderColor = (checkin: CheckIn) => {
    if (checkin.status === 'overdue') return 'border-l-4 border-red-500';
    
    // For completed check-ins, use traffic light status based on score
    if (checkin.status === 'completed' && checkin.score !== undefined) {
      const trafficLightStatus = getTrafficLightStatus(checkin.score, thresholds);
      switch (trafficLightStatus) {
        case 'red':
          return 'border-l-4 border-red-500';
        case 'orange':
          return 'border-l-4 border-orange-500';
        case 'green':
          return 'border-l-4 border-green-500';
        default:
          return 'border-l-4 border-green-500';
      }
    }
    
    // For pending check-ins, use window status (only if due date has arrived)
    const now = new Date();
    const dueDate = new Date(checkin.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    if (dueDate <= today) {
      const checkInWindow = checkin.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
      const windowStatus = isWithinCheckInWindow(checkInWindow);
      if (windowStatus.isOpen) return 'border-l-4 border-green-500';
    }
    
    return 'border-l-4 border-yellow-500';
  };

  const stats = {
    toDo: getToDoCheckins().length,
    scheduled: getScheduledCheckins().length,
    completed: completedResponses.length, // Use formResponses count instead of assignments
    total: checkins.length,
    needsAction: getToDoCheckins().length,
    upcoming: getScheduledCheckins().length,
    pending: checkins.filter(c => c.status === 'pending').length
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex">
          <ClientNavigation />
          <div className="flex-1 ml-4 p-5">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-4">
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
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-white flex flex-col lg:flex-row">
        <ClientNavigation />
        
        {/* Mobile Top Bar */}
        <div className="lg:hidden flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.1)] sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-base" style={{ backgroundColor: '#daa450' }}>
              {userProfile?.firstName?.charAt(0) || 'C'}
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">My Check-ins</p>
              <p className="text-xs text-gray-500">Track your progress</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 lg:ml-4 p-5 lg:p-5 pt-6 lg:pt-5">
          <div className="max-w-7xl">
            {/* Header - Hidden on mobile, shown on desktop */}
            <div className="mb-4 lg:mb-6 hidden lg:block">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                My Check-ins
              </h1>
              <p className="text-gray-900 text-sm mt-1 font-medium">
                Complete your assigned check-ins and track your progress
              </p>
            </div>

            {/* Mobile Header */}
            <div className="mb-4 lg:hidden">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                My Check-ins
              </h1>
              <p className="text-gray-600 text-xs mt-0.5">
                Complete your assigned check-ins
              </p>
            </div>

            {/* Current Check-in Status Banner */}
            {(() => {
              // Current check-in should ONLY be from toDoCheckins (available or overdue)
              const currentCheckin = toDoCheckins[0] || null;
              // Next scheduled is the first one that's NOT already shown as current
              const nextScheduled = scheduledCheckins.length > 0 ? scheduledCheckins[0] : null;
              
              if (!currentCheckin && !nextScheduled) return null;
              
              // If we have a current check-in, use its window; otherwise use next scheduled's window
              const checkInWindow = currentCheckin?.checkInWindow || nextScheduled?.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
              const windowStatus = isWithinCheckInWindow(checkInWindow);
              
              // Check if current check-in is available now
              const now = new Date();
              const dueDate = currentCheckin ? new Date(currentCheckin.dueDate) : null;
              let dueDateHasArrived = false;
              if (dueDate) {
                dueDate.setHours(0, 0, 0, 0);
                const today = new Date(now);
                today.setHours(0, 0, 0, 0);
                dueDateHasArrived = dueDate <= today;
              }
              
              // Special case: Week 1 (first check-in) is accessible immediately once due date arrives,
              // bypassing window restrictions. This allows clients who signed up Jan 3-5 to access
              // their Week 1 check-in on Jan 5 regardless of window hours.
              const isFirstCheckIn = currentCheckin?.recurringWeek === 1;
              const isAvailable = currentCheckin && dueDateHasArrived && 
                (isFirstCheckIn || windowStatus.isOpen) && 
                currentCheckin.status !== 'completed';
              
              // Check if next scheduled check-in is available
              const nextDueDate = nextScheduled ? new Date(nextScheduled.dueDate) : null;
              let nextDueDateHasArrived = false;
              if (nextDueDate) {
                nextDueDate.setHours(0, 0, 0, 0);
                const today = new Date(now);
                today.setHours(0, 0, 0, 0);
                nextDueDateHasArrived = nextDueDate <= today;
              }
              const nextWindow = nextScheduled?.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
              const nextWindowStatus = isWithinCheckInWindow(nextWindow);
              const isNextAvailable = nextScheduled && nextDueDateHasArrived && nextWindowStatus.isOpen && nextScheduled.status !== 'completed';
              
              return (
                <div className="mb-4 lg:mb-6">
                  {currentCheckin ? (
                    <div className="bg-white border-2 rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-gray-100 p-5 lg:p-6 transition-all duration-200">
                      <div className={`px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2 mb-4 rounded-t-2xl lg:rounded-t-3xl`} style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0 bg-white bg-opacity-20">
                            <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <h3 className="text-xl lg:text-lg font-bold text-gray-900">Current Check-in</h3>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-14 h-14 lg:w-12 lg:h-12 rounded-xl lg:rounded-lg flex items-center justify-center" style={{ backgroundColor: '#daa450' }}>
                          <svg className="w-7 h-7 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base lg:text-sm text-gray-700 font-semibold mb-2 break-words">
                            {currentCheckin.isRecurring && currentCheckin.recurringWeek 
                              ? `Week ${currentCheckin.recurringWeek}: ${currentCheckin.title}`
                              : currentCheckin.title}
                          </p>
                          {windowStatus.isOpen ? (
                            <p className="text-green-700 font-semibold text-sm lg:text-sm mb-4">✓ Check-in window is open now - Ready to complete!</p>
                          ) : windowStatus.nextOpenTime ? (
                            <p className="text-gray-600 text-sm lg:text-sm mb-4 leading-relaxed">
                              Next opens: {windowStatus.nextOpenTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at {windowStatus.nextOpenTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </p>
                          ) : (
                            <p className="text-gray-600 text-sm lg:text-sm mb-4">{windowStatus.message}</p>
                          )}
                          {isAvailable && (
                            <Link
                              href={`/client-portal/check-in/${currentCheckin.id}`}
                              className="inline-block px-5 py-3 lg:px-4 lg:py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl lg:rounded-lg text-base lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                            >
                              Check in now
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : nextScheduled ? (
                    <div className="bg-white border-2 rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-gray-100 p-5 lg:p-6 transition-all duration-200">
                      <div className={`px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2 mb-4 rounded-t-2xl lg:rounded-t-3xl`} style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0 bg-white bg-opacity-20">
                            <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <h3 className="text-xl lg:text-lg font-bold text-gray-900">{isNextAvailable ? 'Available Now' : 'Next Check-in'}</h3>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-14 h-14 lg:w-12 lg:h-12 rounded-xl lg:rounded-lg flex items-center justify-center" style={{ backgroundColor: '#daa450' }}>
                          <svg className="w-7 h-7 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base lg:text-sm text-gray-700 font-semibold mb-2 break-words">
                            {nextScheduled.isRecurring && nextScheduled.recurringWeek 
                              ? `Week ${nextScheduled.recurringWeek}: ${nextScheduled.title}`
                              : nextScheduled.title}
                          </p>
                          <p className="text-gray-600 text-sm mb-2 leading-relaxed">
                            Due: {new Date(nextScheduled.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </p>
                          {(() => {
                            if (nextWindowStatus.nextOpenTime) {
                              return (
                                <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                                  {isNextAvailable ? '✓ Window is open now' : `Window opens: ${nextWindowStatus.nextOpenTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${nextWindowStatus.nextOpenTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                                </p>
                              );
                            }
                            return null;
                          })()}
                          {isNextAvailable && (
                            <Link
                              href={`/client-portal/check-in/${nextScheduled.id}`}
                              className="inline-block mt-4 px-5 py-3 lg:px-4 lg:py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl lg:rounded-lg text-base lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                            >
                              Check in now
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {/* Filters - Tabs (conditionally show To Do) */}
            <div className="mb-4 lg:mb-6">
              <div className="flex flex-wrap gap-2 sm:gap-2">
                {[
                  // Only include "To Do" tab if there are check-ins that need attention
                  ...(showToDoTab ? [{ key: 'toDo', label: 'To Do', count: stats.toDo, color: 'red', icon: '📋' }] : []),
                  { key: 'scheduled', label: 'Scheduled', count: stats.scheduled, color: 'blue', icon: '📅' },
                  { key: 'completed', label: 'Completed', count: completedResponses.length, color: 'green', icon: '✅' }
                ].map((filterOption) => (
                  <button
                    key={filterOption.key}
                    onClick={() => setFilter(filterOption.key as any)}
                    className={`px-5 py-3.5 lg:px-6 lg:py-3 rounded-xl lg:rounded-xl text-base lg:text-base font-semibold transition-all duration-200 min-h-[48px] lg:min-h-[44px] flex items-center justify-center gap-2 flex-1 sm:flex-initial ${
                      filter === filterOption.key
                        ? 'text-white shadow-md'
                        : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
                    }`}
                    style={filter === filterOption.key ? { backgroundColor: '#daa450' } : {}}
                  >
                    <span className="text-xl lg:text-lg">{filterOption.icon}</span>
                    <span className="whitespace-nowrap">{filterOption.label}</span>
                    {filterOption.count > 0 && (
                      <span className={`ml-1 px-2.5 py-1 lg:px-2 lg:py-0.5 rounded-full text-sm lg:text-xs font-bold ${
                        filter === filterOption.key
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {filterOption.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Completed Tab Content */}
            {filter === 'completed' ? (
              <div className="space-y-4">
                {/* Completed Filters */}
                <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 lg:p-4">
                  <div className="flex flex-wrap gap-2 sm:gap-2">
                    {[
                      { key: 'all', label: 'All Responses' },
                      { key: 'recent', label: 'Last 30 Days' },
                      { key: 'high-score', label: 'High Scores (80%+)' },
                      { key: 'low-score', label: 'Needs Attention (<60%)' }
                    ].map((option) => (
                      <button
                        key={option.key}
                        onClick={() => setCompletedFilter(option.key)}
                        className={`px-4 py-3 lg:px-4 lg:py-2 rounded-xl lg:rounded-lg text-sm lg:text-sm font-semibold transition-colors min-h-[44px] lg:min-h-[36px] flex items-center justify-center ${
                          completedFilter === option.key
                            ? 'text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                        }`}
                        style={completedFilter === option.key ? { backgroundColor: '#daa450' } : {}}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Completed Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 lg:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 lg:w-10 lg:h-10 rounded-xl lg:rounded-lg flex items-center justify-center" style={{ backgroundColor: '#daa450' }}>
                        <span className="text-2xl lg:text-xl">📊</span>
                      </div>
                      <div>
                        <p className="text-xs lg:text-xs text-gray-600 font-medium">Total</p>
                        <p className="text-2xl lg:text-xl font-bold text-gray-900">{completedResponses.length}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 lg:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 lg:w-10 lg:h-10 rounded-xl lg:rounded-lg flex items-center justify-center" style={{ backgroundColor: '#daa450' }}>
                        <span className="text-2xl lg:text-xl">✅</span>
                      </div>
                      <div>
                        <p className="text-xs lg:text-xs text-gray-600 font-medium">Average</p>
                        <p className="text-2xl lg:text-xl font-bold text-gray-900">
                          {completedResponses.length > 0 
                            ? Math.round(completedResponses.reduce((sum, item) => sum + item.score, 0) / completedResponses.length)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 lg:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 lg:w-10 lg:h-10 rounded-xl lg:rounded-lg flex items-center justify-center" style={{ backgroundColor: '#daa450' }}>
                        <span className="text-2xl lg:text-xl">🎯</span>
                      </div>
                      <div>
                        <p className="text-xs lg:text-xs text-gray-600 font-medium">High Scores</p>
                        <p className="text-2xl lg:text-xl font-bold text-gray-900">
                          {completedResponses.filter(item => item.score >= 80).length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 lg:p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 lg:w-10 lg:h-10 rounded-xl lg:rounded-lg flex items-center justify-center" style={{ backgroundColor: '#daa450' }}>
                        <span className="text-2xl lg:text-xl">⚠️</span>
                      </div>
                      <div>
                        <p className="text-xs lg:text-xs text-gray-600 font-medium">Needs Attention</p>
                        <p className="text-2xl lg:text-xl font-bold text-gray-900">
                          {completedResponses.filter(item => item.score < 60).length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Completed List */}
                <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                    <h2 className="text-xl lg:text-xl font-bold text-gray-900">Completed Check-ins</h2>
                    <p className="text-gray-600 text-sm lg:text-sm mt-1 lg:mt-1">
                      {filteredCompletedResponses.length} response{filteredCompletedResponses.length !== 1 ? 's' : ''} found
                    </p>
                  </div>

                  <div className="p-5 lg:p-5">
                    {completedLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading completed check-ins...</p>
                      </div>
                    ) : filteredCompletedResponses.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-6xl mb-4">📋</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No responses found</h3>
                        <p className="text-gray-600">
                          {completedFilter === 'all' && "You haven't completed any check-ins yet."}
                          {completedFilter === 'recent' && "No responses in the last 30 days."}
                          {completedFilter === 'high-score' && "No high score responses yet."}
                          {completedFilter === 'low-score' && "Great job! No responses need attention."}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredCompletedResponses.map((item) => (
                          <div key={item.id} className="bg-white rounded-2xl lg:rounded-2xl border border-gray-100 p-4 lg:p-4 hover:shadow-md transition-shadow">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                                  <h3 className="text-base lg:text-base font-semibold text-gray-900 break-words">
                                    {item.checkInTitle || item.formTitle || 'Check-in'}
                                  </h3>
                                  <span className={`px-3 py-1 rounded-full text-sm lg:text-xs font-semibold ${getScoreBadge(item.score)} self-start sm:self-auto`}>
                                    {item.score}%
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">
                                  Completed on {formatHistoryDate(item.submittedAt)}
                                </p>
                              </div>
                              <Link
                                href={`/client-portal/check-in/${item.id}/success`}
                                className="px-5 py-3 lg:px-4 lg:py-2 text-white rounded-xl lg:rounded-lg transition-colors text-base lg:text-sm font-semibold whitespace-nowrap text-center min-h-[48px] lg:min-h-[36px] flex items-center justify-center shadow-sm hover:shadow-md"
                                style={{ backgroundColor: '#daa450' }}
                              >
                                View Details
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
              {/* Check-ins List */}
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-xl lg:text-xl font-bold text-gray-900">
                        {filter === 'toDo' ? '📋 Check-ins To Do' : 
                         filter === 'scheduled' ? '📅 Scheduled Check-ins' :
                         '✅ Completed Check-ins'}
                      </h2>
                      <p className="text-gray-600 text-sm lg:text-sm mt-1 lg:mt-1 leading-relaxed">
                        {filter === 'toDo' && 'Complete your check-ins that need attention'}
                        {filter === 'scheduled' && filteredCheckins.length > 0 ? `Next check-in scheduled${filteredCheckins.length > 1 ? ` (${filteredCheckins.length - 1} more upcoming)` : ''}` : 'No upcoming check-ins scheduled'}
                        {filter === 'completed' && 'Your completed check-ins and results'}
                        {filter !== 'scheduled' && filter !== 'completed' && filteredCheckins.length > 0 && ` • ${filteredCheckins.length} check-in${filteredCheckins.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                </div>
              
              <div className="p-5 lg:p-8">
                {filteredCheckins.length > 0 ? (
                  <div className="space-y-3">
                    {filteredCheckins.map((checkin) => {
                      const checkInWindow = checkin.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
                      const windowStatus = isWithinCheckInWindow(checkInWindow);
                      
                      // A check-in is only available if:
                      // 1. The due date has arrived (today >= due date)
                      // 2. AND we're currently within the check-in window period (or it's Week 1)
                      // 3. AND the check-in is not completed
                      const now = new Date();
                      const dueDate = new Date(checkin.dueDate);
                      dueDate.setHours(0, 0, 0, 0); // Reset to start of day for comparison
                      const today = new Date(now);
                      today.setHours(0, 0, 0, 0);
                      
                      const dueDateHasArrived = dueDate <= today;
                      // Special case: Week 1 (first check-in) is accessible immediately once due date arrives,
                      // bypassing window restrictions for clients who signed up Jan 3-5, 2026
                      const isFirstCheckIn = checkin.recurringWeek === 1;
                      const isAvailable = dueDateHasArrived && 
                        (isFirstCheckIn || windowStatus.isOpen) && 
                        checkin.status !== 'completed';
                      const isOverdue = checkin.status === 'overdue';
                      const isCompleted = checkin.status === 'completed';
                      
                      // For completed check-ins, don't make the entire card a link since there are action buttons inside
                      // Instead, just use a div wrapper
                      const CardWrapper = 'div';

                      return (
                        <CardWrapper
                          key={checkin.id}
                          className={`${getCardBorderColor(checkin)} bg-white rounded-2xl lg:rounded-2xl p-4 lg:p-4 hover:shadow-md transition-all duration-200 border border-gray-100`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            {/* Left: Main Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-3 mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <h3 className="text-base lg:text-base font-bold text-gray-900 break-words">
                                      {checkin.isRecurring && checkin.recurringWeek 
                                        ? `Week ${checkin.recurringWeek}: ${checkin.title}`
                                        : checkin.title
                                      }
                                    </h3>
                                    {checkin.status === 'overdue' && (
                                      <span className="px-2 py-1 rounded-full text-xs lg:text-xs font-semibold bg-red-100 text-red-800 flex-shrink-0">
                                        Overdue
                                      </span>
                                    )}
                                    {isAvailable && !isOverdue && (
                                      <span className="px-2 py-1 rounded-full text-xs lg:text-xs font-semibold bg-green-100 text-green-800 flex-shrink-0">
                                        Available Now
                                      </span>
                                    )}
                                    {!isAvailable && !isOverdue && !isCompleted && (
                                      <span className="px-2 py-1 rounded-full text-xs lg:text-xs font-semibold bg-yellow-100 text-yellow-800 flex-shrink-0">
                                        {dueDateHasArrived ? 'Window Closed' : 'Not Yet Available'}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Time indicator */}
                                  <p className="text-xs lg:text-xs text-gray-900 mb-2 lg:mb-2 font-medium">
                                    {isOverdue 
                                      ? getTimeUntilDue(checkin.dueDate)
                                      : isCompleted
                                      ? `Completed ${checkin.completedAt ? formatDate(checkin.completedAt) : ''}`
                                      : getTimeUntilDue(checkin.dueDate)
                                    }
                                  </p>

                                  {/* Window status for pending check-ins */}
                                  {!isCompleted && !isOverdue && (
                                    <div className="mt-2 space-y-2">
                                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 lg:py-1 rounded-lg text-xs lg:text-xs font-medium ${
                                        isAvailable 
                                          ? 'bg-green-50 text-green-800' 
                                          : dueDateHasArrived
                                          ? 'bg-yellow-50 text-yellow-800'
                                          : 'bg-gray-50 text-gray-800'
                                      }`}>
                                        <span className="text-base">{isAvailable ? '✅' : dueDateHasArrived ? '⏰' : '📅'}</span>
                                        <span>
                                          {isAvailable ? windowStatus.message : dueDateHasArrived ? windowStatus.message : (() => {
                                            const windowStartDate = getCheckInWindowStartDate(checkin.dueDate, checkInWindow);
                                            return `Available on ${formatDate(windowStartDate.toISOString())}`;
                                          })()}
                                        </span>
                                      </div>
                                      {/* Show window details for scheduled check-ins */}
                                      {filter === 'scheduled' && checkInWindow?.enabled && checkInWindow?.startDay && checkInWindow?.startTime && (
                                        <div className="text-xs lg:text-xs text-gray-700 font-medium leading-relaxed">
                                          {(() => {
                                            const windowStartDate = getCheckInWindowStartDate(checkin.dueDate, checkInWindow);
                                            const startDayName = checkInWindow.startDay.charAt(0).toUpperCase() + checkInWindow.startDay.slice(1);
                                            const [hours, minutes] = checkInWindow.startTime.split(':').map(Number);
                                            const period = hours >= 12 ? 'PM' : 'AM';
                                            const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                                            const displayMinutes = minutes.toString().padStart(2, '0');
                                            return `Window opens ${startDayName} ${formatDate(windowStartDate.toISOString())} at ${displayHours}:${displayMinutes} ${period}`;
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Progress indicator for recurring check-ins */}
                                  {checkin.isRecurring && checkin.recurringWeek && checkin.totalWeeks && (
                                    <div className="mt-3">
                                      <div className="flex items-center justify-between text-sm lg:text-xs text-gray-900 mb-2">
                                        <span className="font-semibold">Program Progress: Week {checkin.recurringWeek} of {checkin.totalWeeks}</span>
                                        <span className="text-gray-600 font-semibold">{Math.round((checkin.recurringWeek / checkin.totalWeeks) * 100)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2 lg:h-1.5">
                                        <div 
                                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 lg:h-1.5 rounded-full transition-all duration-300"
                                          style={{ width: `${(checkin.recurringWeek / checkin.totalWeeks) * 100}%` }}
                                          title={`Program progress: ${checkin.recurringWeek} of ${checkin.totalWeeks} weeks completed`}
                                        ></div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Feedback indicator for completed check-ins */}
                                  {isCompleted && checkin.coachResponded && (
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm lg:text-xs font-semibold bg-purple-100 text-purple-700 mt-3">
                                      <svg className="w-4 h-4 lg:w-3.5 lg:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Coach Feedback Available
                                    </div>
                                  )}

                                  {/* Score for completed with traffic light */}
                                  {isCompleted && checkin.score && (
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm lg:text-xs mt-3">
                                      {/* Determine traffic light status (default to lifestyle thresholds) */}
                                      {(() => {
                                        const score = checkin.score;
                                        let status: 'red' | 'orange' | 'green';
                                        if (score <= 33) status = 'red';
                                        else if (score <= 80) status = 'orange';
                                        else status = 'green';
                                        
                                        const colors = {
                                          red: 'bg-red-50 text-red-800 border-red-200',
                                          orange: 'bg-orange-50 text-orange-800 border-orange-200',
                                          green: 'bg-green-50 text-green-800 border-green-200'
                                        };
                                        const icons = {
                                          red: '🔴',
                                          orange: '🟠',
                                          green: '🟢'
                                        };
                                        
                                        return (
                                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 lg:px-2 lg:py-1 rounded-full border ${colors[status]}`}>
                                            <span className="text-base lg:text-xs">{icons[status]}</span>
                                            <span className="font-bold text-sm lg:text-xs">Score: {score}%</span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>

                                {/* Right: Action Button */}
                                <div className="flex-shrink-0 w-full sm:w-auto" onClick={(e) => completedLink && e.stopPropagation()}>
                                  {isOverdue && (
                                    <Link
                                      href={`/client-portal/check-in/${checkin.id}`}
                                      className="w-full sm:w-auto inline-block px-5 py-3.5 lg:px-4 lg:py-2 text-white rounded-xl lg:rounded-lg text-base lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md text-center min-h-[48px] lg:min-h-[36px] flex items-center justify-center"
                                      style={{ backgroundColor: '#daa450' }}
                                    >
                                      Complete Now
                                    </Link>
                                  )}
                                  {isAvailable && !isOverdue && (
                                    <Link
                                      href={`/client-portal/check-in/${checkin.id}`}
                                      className="w-full sm:w-auto inline-block px-5 py-3.5 lg:px-4 lg:py-2 text-white rounded-xl lg:rounded-lg text-base lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md text-center min-h-[48px] lg:min-h-[36px] flex items-center justify-center"
                                      style={{ backgroundColor: '#daa450' }}
                                    >
                                      Start Check-in
                                    </Link>
                                  )}
                                  {!isAvailable && !isOverdue && !isCompleted && (
                                    <button
                                      disabled
                                      className="w-full sm:w-auto px-5 py-3.5 lg:px-4 lg:py-2 bg-gray-300 text-gray-600 rounded-xl lg:rounded-lg text-base lg:text-sm font-semibold cursor-not-allowed min-h-[48px] lg:min-h-[36px]"
                                      title={dueDateHasArrived ? getCheckInWindowDescription(checkInWindow) : (() => {
                                        const windowStartDate = getCheckInWindowStartDate(checkin.dueDate, checkInWindow);
                                        return `Check-in available on ${formatDate(windowStartDate.toISOString())}`;
                                      })()}
                                    >
                                      {dueDateHasArrived ? 'Window Closed' : 'Not Available Yet'}
                                    </button>
                                  )}
                                  {isCompleted && (
                                    <div className="flex flex-col sm:flex-row sm:items-end gap-3 w-full sm:w-auto">
                                      {checkin.coachResponded && checkin.responseId && (
                                        <Link
                                          href={`/client-portal/feedback/${checkin.responseId}`}
                                          className="w-full sm:w-auto px-5 py-3.5 lg:px-4 lg:py-2 text-white rounded-xl lg:rounded-lg text-base lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 min-h-[48px] lg:min-h-[36px]"
                                          style={{ backgroundColor: '#daa450' }}
                                        >
                                          <svg className="w-4 h-4 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span className="hidden sm:inline">View Feedback</span>
                                          <span className="sm:hidden">Feedback</span>
                                        </Link>
                                      )}
                                      <Link
                                        href={`/client-portal/check-in/${checkin.id}/success`}
                                        className="w-full sm:w-auto px-5 py-3.5 lg:px-4 lg:py-2 text-white rounded-xl lg:rounded-lg text-base lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 min-h-[48px] lg:min-h-[36px]"
                                        style={{ backgroundColor: '#daa450' }}
                                      >
                                        <svg className="w-4 h-4 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        <span className="hidden sm:inline">View Results</span>
                                        <span className="sm:hidden">Results</span>
                                      </Link>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardWrapper>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 lg:py-12">
                    {filter === 'toDo' ? (
                      <>
                        <div className="text-6xl mb-4">🎯</div>
                        <h3 className="text-2xl lg:text-xl font-bold text-gray-900 mb-3">All caught up!</h3>
                        <p className="text-gray-900 text-base lg:text-sm max-w-md mx-auto mb-6 leading-relaxed px-4">
                          No check-ins need your attention right now. Great job staying on top of things!
                        </p>
                        {(() => {
                          const nextScheduled = scheduledCheckins.length > 0 ? scheduledCheckins[0] : null;
                          if (nextScheduled) {
                            const scheduledDueDate = new Date(nextScheduled.dueDate);
                            const now = new Date();
                            const diffTime = scheduledDueDate.getTime() - now.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            return (
                              <div className="max-w-md mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 shadow-lg">
                                <h4 className="text-lg font-bold text-gray-900 mb-2">Next Check-in</h4>
                                <p className="text-base font-semibold text-blue-900 mb-3">{nextScheduled.title}</p>
                                <p className="text-sm text-blue-700 font-medium">
                                  Scheduled for {formatDate(nextScheduled.dueDate)} ({diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`})
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    ) : filter === 'scheduled' ? (
                      <>
                        <div className="text-6xl mb-4">📅</div>
                        <h3 className="text-2xl lg:text-xl font-bold text-gray-900 mb-3">No scheduled check-ins</h3>
                        <p className="text-gray-900 text-base lg:text-sm max-w-md mx-auto leading-relaxed px-4">
                          You don't have any upcoming check-ins scheduled at this time.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-6xl mb-4">✅</div>
                        <h3 className="text-2xl lg:text-xl font-bold text-gray-900 mb-3">No completed check-ins yet</h3>
                        <p className="text-gray-900 text-base lg:text-sm max-w-md mx-auto leading-relaxed px-4">
                          Complete your first check-in to see your results and progress here.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 