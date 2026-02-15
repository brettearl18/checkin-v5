'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
// Window system removed - using simple Friday 10am to Tuesday 12pm logic
// Helper function to check if check-in is currently open
const isCheckInCurrentlyOpen = (dueDate: Date | string): boolean => {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  
  // Find the Monday of the week containing the due date
  const dayOfWeek = due.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
  const weekMonday = new Date(due);
  weekMonday.setDate(due.getDate() - daysToMonday);
  weekMonday.setHours(0, 0, 0, 0);
  
  // Window opens: Friday 10am before that Monday (3 days before)
  const windowOpen = new Date(weekMonday);
  windowOpen.setDate(weekMonday.getDate() - 3);
  windowOpen.setHours(10, 0, 0, 0);
  
  // Window closes: Tuesday 12pm after that Monday (1 day after)
  const windowClose = new Date(weekMonday);
  windowClose.setDate(weekMonday.getDate() + 1);
  windowClose.setHours(12, 0, 0, 0);
  
  return now >= windowOpen && now <= windowClose;
};
import { getTrafficLightStatus, getDefaultThresholds, convertLegacyThresholds, type ScoringThresholds } from '@/lib/scoring-utils';

interface CheckIn {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue' | 'missed';
  formId: string;
  assignedBy: string;
  assignedAt: string;
  completedAt?: string;
  score?: number;
  checkInWindow?: any; // Deprecated - kept for backwards compatibility
  isRecurring?: boolean;
  recurringWeek?: number;
  totalWeeks?: number;
  responseId?: string;
  coachResponded?: boolean;
  extensionGranted?: boolean;
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
  const [showMarkMissedModal, setShowMarkMissedModal] = useState(false);
  const [selectedCheckInForMissed, setSelectedCheckInForMissed] = useState<CheckIn | null>(null);
  const [missedReason, setMissedReason] = useState<string>('');
  const [missedComment, setMissedComment] = useState<string>('');
  const [markingAsMissed, setMarkingAsMissed] = useState(false);
  const [wrongWeekExpandedFor, setWrongWeekExpandedFor] = useState<string | null>(null);
  const [reassignTargetWeek, setReassignTargetWeek] = useState<string>('3');
  const [reassigningFor, setReassigningFor] = useState<string | null>(null);

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

  // Refresh check-ins when page becomes visible or gains focus (e.g., returning from check-in submission)
  useEffect(() => {
    if (!clientId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refetch check-ins when page becomes visible (user returned from another page)
        fetchCheckIns();
        if (filter === 'completed') {
          fetchCompletedResponses();
        }
      }
    };

    const handleFocus = () => {
      // Also refresh when window gains focus (user switched back to tab)
      fetchCheckIns();
      if (filter === 'completed') {
        fetchCompletedResponses();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
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
      const headers = await import('@/lib/auth-headers').then(m => m.getAuthHeaders());
      const response = await fetch(`/api/client-portal?clientEmail=${userProfile.email}`, { headers });
      
      if (!response.ok) {
        // Silently handle non-OK responses - API might be starting up
        setLoading(false);
        return;
      }
      
      const result = await response.json();

      if (result.success && result.data.client) {
        setClientId(result.data.client.id);
      } else {
        // Only log if not a network error
        if (result.message && !result.message.includes('fetch')) {
          console.error('Failed to fetch client ID:', result.message);
        }
        setLoading(false);
      }
    } catch (error: any) {
      // Silently handle network errors - they're often transient
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.debug('Error fetching client ID (will retry):', error);
      }
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

      const headers = await import('@/lib/auth-headers').then(m => m.getAuthHeaders());
      const response = await fetch(`/api/client-portal/history?clientId=${clientId}`, { headers });
      
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

  const reassignResponseToWeek = async (responseId: string, targetRecurringWeek: number) => {
    if (!clientId) return;
    setReassigningFor(responseId);
    try {
      const headers = await import('@/lib/auth-headers').then(m => m.getAuthHeaders());
      const res = await fetch(`/api/clients/${clientId}/reassign-response-to-week`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId, targetRecurringWeek }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchCompletedResponses();
        setWrongWeekExpandedFor(null);
        alert(data.message || 'Moved to the correct week. Your coach will see the update.');
      } else {
        alert(data.message || 'Could not move this completion. Ask your coach to fix it.');
      }
    } catch (e) {
      console.error('Reassign failed:', e);
      alert('Something went wrong. Please try again or ask your coach.');
    } finally {
      setReassigningFor(null);
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

      const headers = await import('@/lib/auth-headers').then(m => m.getAuthHeaders());
      const response = await fetch(`/api/client-portal/check-ins?clientId=${clientId}`, { headers });
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

          // Window field kept for backwards compatibility but no longer used
          return {
            ...checkin
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

  const handleMarkAsMissed = async () => {
    if (!selectedCheckInForMissed || !clientId) return;
    
    if (!missedReason) {
      alert('Please select a reason');
      return;
    }

    if (missedReason === 'other' && !missedComment.trim()) {
      alert('Please provide a comment when selecting "Other"');
      return;
    }

    setMarkingAsMissed(true);
    try {
      const response = await fetch(`/api/check-in-assignments/${selectedCheckInForMissed.id}/mark-missed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: missedReason,
          comment: missedComment || null,
          clientId: clientId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Refresh check-ins
          await fetchCheckIns();
          // Close modal and reset
          setShowMarkMissedModal(false);
          setSelectedCheckInForMissed(null);
          setMissedReason('');
          setMissedComment('');
        } else {
          alert(`Failed to mark check-in as missed: ${data.message || 'Unknown error'}`);
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to mark check-in as missed: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error marking check-in as missed:', error);
      alert('Failed to mark check-in as missed. Please try again.');
    } finally {
      setMarkingAsMissed(false);
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
  // Missed check-ins are excluded (no longer actionable); current check-in = first pending/overdue/available.
  const getToDoCheckins = () => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    return checkins.filter(checkin => {
      // Exclude missed check-ins from task/to-do lists (window closed, no longer actionable)
      if (checkin.status === 'missed') return false;
      // Exclude completed check-ins from "To Do" (status + defensive responseId/completedAt)
      if (checkin.status === 'completed') return false;
      if (checkin.responseId || (checkin as any).completedAt) return false;
      // Coach opened for check-in (extension granted)
      if (checkin.extensionGranted) return true;

      const dueDate = new Date(checkin.dueDate);
      
      // Normalize dates for comparison (set to start of day)
      dueDate.setHours(0, 0, 0, 0);
      
      // Always include overdue check-ins (past due date) - these are priority
      if (dueDate < today) return true;
      
      // Include check-ins due today
      if (dueDate.getTime() === today.getTime()) return true;
      
      // Include if window is open (Friday 10am to Tuesday 12pm) - available now
      const isCheckInOpenForWeek = (due: Date): boolean => {
        const d = new Date(due);
        const dayOfWeek = d.getDay();
        const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
        const weekMonday = new Date(d);
        weekMonday.setDate(d.getDate() - daysToMonday);
        weekMonday.setHours(0, 0, 0, 0);
        
        const windowOpen = new Date(weekMonday);
        windowOpen.setDate(weekMonday.getDate() - 3); // Friday
        windowOpen.setHours(10, 0, 0, 0);
        
        const windowClose = new Date(weekMonday);
        windowClose.setDate(weekMonday.getDate() + 1); // Tuesday
        windowClose.setHours(12, 0, 0, 0);
        
        return now >= windowOpen && now <= windowClose;
      };
      
      if (isCheckInOpenForWeek(dueDate)) return true;
      
      // Don't include future check-ins whose window isn't open yet - they belong in "Scheduled"
      return false;
    }).sort((a, b) => {
      // Sort by priority: overdue first, then available (window open), then by due date
      const aDue = new Date(a.dueDate).getTime();
      const bDue = new Date(b.dueDate).getTime();
      const todayTime = today.getTime();
      
      // Overdue check-ins come first
      const aOverdue = aDue < todayTime;
      const bOverdue = bDue < todayTime;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      
      // Then sort by due date (earliest first)
      return aDue - bDue;
    });
  };

  // "Scheduled" - ALL upcoming check-ins
  // Shows all upcoming check-ins so users can see what's coming and when windows open
  const getScheduledCheckins = () => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // Helper to check if check-in window is currently open
    const isCheckInOpenForWeek = (due: Date): boolean => {
      const d = new Date(due);
      const dayOfWeek = d.getDay();
      const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
      const weekMonday = new Date(d);
      weekMonday.setDate(d.getDate() - daysToMonday);
      weekMonday.setHours(0, 0, 0, 0);
      
      const windowOpen = new Date(weekMonday);
      windowOpen.setDate(weekMonday.getDate() - 3); // Friday
      windowOpen.setHours(10, 0, 0, 0);
      
      const windowClose = new Date(weekMonday);
      windowClose.setDate(weekMonday.getDate() + 1); // Tuesday
      windowClose.setHours(12, 0, 0, 0);
      
      return now >= windowOpen && now <= windowClose;
    };

    const futureCheckins = checkins
      .filter(checkin => {
        // Exclude missed check-ins from "Scheduled" (not actionable)
        if (checkin.status === 'missed') return false;
        // Exclude completed check-ins from "Scheduled" (they go to "Completed" tab)
        if (checkin.status === 'completed') return false;
        if (checkin.responseId || (checkin as any).completedAt) return false;
        
        const dueDate = new Date(checkin.dueDate);
        // Normalize due date to start of day for accurate comparison
        dueDate.setHours(0, 0, 0, 0);
        
        // Exclude overdue check-ins (they should be in "To Do")
        if (dueDate < startOfToday) return false;
        
        // Exclude check-ins with window currently open (they should be in "To Do")
        if (isCheckInOpenForWeek(dueDate)) return false;
        
        // Include future check-ins whose window is NOT currently open
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


  const filteredCompletedResponses = completedResponses
    .filter(item => {
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
    })
    .sort((a, b) => {
      // Sort by newest first (submittedAt descending)
      const dateA = new Date(a.submittedAt).getTime();
      const dateB = new Date(b.submittedAt).getTime();
      return dateB - dateA; // Newest first
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
          
          // DISABLED: Window-based sorting removed - sort by due date only
          // Overdue/due check-ins already sorted above, so just sort by date
          
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
        
        // Always show at least the next upcoming check-in in the scheduled tab
        // Don't exclude the banner check-in - show it here too so users can see it
        // Show the first check-in (next upcoming)
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
    
    // DISABLED: Window-based styling removed - use due date status only
    if (dueDate <= today) {
      return 'border-l-4 border-green-500';
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
              
              // Simplified: Check-ins are available if it's Friday 10am or later before Tuesday 12pm close
              const now = new Date();
              
              // Helper function to check if check-in is open (Friday 10am to Tuesday 12pm of the week)
              const isCheckInOpen = (dueDate: Date): boolean => {
                const due = new Date(dueDate);
                // Find the Monday of the week containing the due date
                const dayOfWeek = due.getDay();
                const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
                const weekMonday = new Date(due);
                weekMonday.setDate(due.getDate() - daysToMonday);
                weekMonday.setHours(0, 0, 0, 0);
                
                // Window opens: Friday 10am before that Monday (3 days before)
                const windowOpen = new Date(weekMonday);
                windowOpen.setDate(weekMonday.getDate() - 3);
                windowOpen.setHours(10, 0, 0, 0);
                
                // Window closes: Tuesday 12pm after that Monday (1 day after)
                const windowClose = new Date(weekMonday);
                windowClose.setDate(weekMonday.getDate() + 1);
                windowClose.setHours(12, 0, 0, 0);
                
                return now >= windowOpen && now <= windowClose;
              };
              
              // Check if current check-in is available
              // Overdue check-ins are always available (even if window closed)
              // Future check-ins are available if their window is open
              const currentDueDate = currentCheckin ? new Date(currentCheckin.dueDate) : null;
              const today = new Date(now);
              today.setHours(0, 0, 0, 0);
              const isOverdue = currentDueDate && currentDueDate < today;
              const isWindowOpen = currentDueDate && isCheckInOpen(currentDueDate);
              const isAvailable = currentCheckin && currentDueDate && 
                (isOverdue || isWindowOpen) && 
                currentCheckin.status !== 'completed';
              
              // Check if next scheduled check-in is available
              const nextDueDate = nextScheduled ? new Date(nextScheduled.dueDate) : null;
              const isNextAvailable = nextScheduled && nextDueDate && 
                isCheckInOpen(nextDueDate) && 
                nextScheduled.status !== 'completed';
              
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
                          {currentDueDate && (() => {
                            // Calculate the reference week (the week this check-in is ABOUT)
                            // If due date is Monday Jan 12, reference week is the week BEFORE (Mon Jan 5 - Sun Jan 11)
                            const due = new Date(currentDueDate);
                            const referenceWeekStart = new Date(due);
                            referenceWeekStart.setDate(due.getDate() - 7); // Go back 7 days to get previous Monday
                            const referenceWeekEnd = new Date(referenceWeekStart);
                            referenceWeekEnd.setDate(referenceWeekStart.getDate() + 6); // Sunday of that week
                            
                            const formatDateShort = (date: Date) => {
                              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            };
                            
                            return (
                              <p className="text-xs text-gray-500 mb-2">
                                Reflecting on: Week of {formatDateShort(referenceWeekStart)} - {formatDateShort(referenceWeekEnd)}
                              </p>
                            );
                          })()}
                          {isAvailable ? (
                            <p className={`font-semibold text-sm lg:text-sm mb-4 ${isOverdue ? 'text-red-700' : 'text-green-700'}`}>
                              {isOverdue ? '⚠️ Check-in is overdue - please complete now' : '✓ Check-in is available now - Ready to complete!'}
                            </p>
                          ) : currentDueDate ? (
                            <p className="text-gray-600 text-sm lg:text-sm mb-4">
                              Opens Friday at 10:00 AM, closes Tuesday at 12:00 PM
                            </p>
                          ) : null}
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
                          {isNextAvailable && (
                            <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                              ✓ Window is open now
                            </p>
                          )}
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
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-base lg:text-base font-semibold text-gray-900 break-words">
                                      {item.checkInTitle || item.formTitle || 'Check-in'}
                                    </h3>
                                    {item.recurringWeek && (
                                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                        Week {item.recurringWeek}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-sm lg:text-xs font-semibold ${getScoreBadge(item.score)} self-start sm:self-auto`}>
                                    {item.score}%
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">
                                  Completed on {formatHistoryDate(item.submittedAt)}
                                </p>
                                
                                {/* Status Indicators */}
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {/* Coach Response Indicator */}
                                  {item.coachResponded ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>Coach Responded</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>Awaiting Coach</span>
                                    </div>
                                  )}
                                  
                                  {/* Client Approval Indicator - Only show if coach has responded */}
                                  {item.coachResponded && (
                                    item.clientApproved ? (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>Approved</span>
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>Review Pending</span>
                                      </div>
                                    )
                                  )}
                                </div>
                                {/* Wrong week? Self-fix - only for recurring check-ins */}
                                {item.recurringWeek != null && (item.totalWeeks ?? 0) > 1 && (
                                  <div className="mt-3 pt-3 border-t border-gray-100">
                                    <button
                                      type="button"
                                      onClick={() => setWrongWeekExpandedFor(wrongWeekExpandedFor === item.id ? null : item.id)}
                                      className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                      {wrongWeekExpandedFor === item.id ? '▼' : '▶'} Recorded as wrong week? Fix it here
                                    </button>
                                    {wrongWeekExpandedFor === item.id && (
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className="text-xs text-gray-600">I actually completed week</span>
                                        <input
                                          type="number"
                                          min={1}
                                          max={item.totalWeeks || 52}
                                          value={reassignTargetWeek}
                                          onChange={(e) => setReassignTargetWeek(e.target.value)}
                                          className="w-12 px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                        <button
                                          type="button"
                                          disabled={reassigningFor === item.id}
                                          onClick={() => reassignResponseToWeek(item.id, parseInt(reassignTargetWeek, 10) || 1)}
                                          className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                          {reassigningFor === item.id ? 'Moving…' : 'Move to this week'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                                {/* Feedback Button - Only show if coach has responded */}
                                {item.coachResponded && (
                                  <Link
                                    href={`/client-portal/feedback/${item.id}`}
                                    className="px-4 py-2.5 lg:px-4 lg:py-2 text-white rounded-xl lg:rounded-lg transition-colors text-sm lg:text-xs font-semibold whitespace-nowrap text-center min-h-[44px] lg:min-h-[36px] flex items-center justify-center shadow-sm hover:shadow-md bg-purple-600 hover:bg-purple-700"
                                  >
                                    View Feedback
                                  </Link>
                                )}
                                <Link
                                  href={`/client-portal/check-in/${item.id}/success`}
                                  className="px-5 py-3 lg:px-4 lg:py-2 text-white rounded-xl lg:rounded-lg transition-colors text-base lg:text-sm font-semibold whitespace-nowrap text-center min-h-[48px] lg:min-h-[36px] flex items-center justify-center shadow-sm hover:shadow-md"
                                  style={{ backgroundColor: '#daa450' }}
                                >
                                  View Details
                                </Link>
                              </div>
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
                        {filter === 'scheduled' && (filteredCheckins.length > 0 || scheduledCheckins.length > 0) ? `Next check-in scheduled${scheduledCheckins.length > 1 ? ` (${scheduledCheckins.length - 1} more upcoming)` : ''}` : 'No upcoming check-ins scheduled'}
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
                      // Check-in is available if: Friday 10am to Tuesday 12pm of the week
                      const dueDate = new Date(checkin.dueDate);
                      const now = new Date();
                      
                      // Helper to check if check-in is open (Friday 10am to Tuesday 12pm)
                      const isCheckInOpenForWeek = (due: Date): boolean => {
                        const d = new Date(due);
                        const dayOfWeek = d.getDay();
                        const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
                        const weekMonday = new Date(d);
                        weekMonday.setDate(d.getDate() - daysToMonday);
                        weekMonday.setHours(0, 0, 0, 0);
                        
                        const windowOpen = new Date(weekMonday);
                        windowOpen.setDate(weekMonday.getDate() - 3); // Friday
                        windowOpen.setHours(10, 0, 0, 0);
                        
                        const windowClose = new Date(weekMonday);
                        windowClose.setDate(weekMonday.getDate() + 1); // Tuesday
                        windowClose.setHours(12, 0, 0, 0);
                        
                        return now >= windowOpen && now <= windowClose;
                      };
                      
                      const dueDateNormalized = new Date(dueDate);
                      dueDateNormalized.setHours(0, 0, 0, 0);
                      const today = new Date(now);
                      today.setHours(0, 0, 0, 0);
                      
                      const dueDateHasArrived = dueDateNormalized <= today;
                      const isAvailable = isCheckInOpenForWeek(dueDate) && checkin.status !== 'completed';
                      const isOverdue = checkin.status === 'overdue';
                      const isCompleted = checkin.status === 'completed';
                      // Check if 3+ days overdue (to show "Mark as Missed" button)
                      const daysPastDue = Math.floor((today.getTime() - dueDateNormalized.getTime()) / (1000 * 60 * 60 * 24));
                      const canMarkAsMissed = isOverdue && daysPastDue >= 3 && !isCompleted;
                      
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
                                    {checkin.dueDate && (() => {
                                      // Calculate the reference week (the week this check-in is ABOUT)
                                      // Check-ins are retrospective - they're about the PREVIOUS week
                                      // If due date is Monday Jan 12, reference week is the week BEFORE (Mon Jan 5 - Sun Jan 11)
                                      const due = new Date(checkin.dueDate);
                                      const referenceWeekStart = new Date(due);
                                      referenceWeekStart.setDate(due.getDate() - 7); // Go back 7 days to get previous Monday
                                      referenceWeekStart.setHours(0, 0, 0, 0);
                                      const referenceWeekEnd = new Date(referenceWeekStart);
                                      referenceWeekEnd.setDate(referenceWeekStart.getDate() + 6); // Sunday of that week
                                      
                                      const formatDateShort = (date: Date) => {
                                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                      };
                                      
                                      return (
                                        <div className="text-xs text-gray-500 mt-1">
                                          About: Week ending {formatDateShort(referenceWeekEnd)} (Mon {formatDateShort(referenceWeekStart)} - Sun {formatDateShort(referenceWeekEnd)})
                                        </div>
                                      );
                                    })()}
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
                                          {isAvailable 
                                            ? '✓ Check-in is available now' 
                                            : dueDateHasArrived 
                                            ? 'Check-in opens Friday 10am, closes Tuesday 12pm'
                                            : (() => {
                                                // Calculate when window opens (Friday 10am before Monday due date)
                                                const d = new Date(dueDate);
                                                const dayOfWeek = d.getDay();
                                                const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
                                                const weekMonday = new Date(d);
                                                weekMonday.setDate(d.getDate() - daysToMonday);
                                                weekMonday.setHours(0, 0, 0, 0);
                                                const windowOpen = new Date(weekMonday);
                                                windowOpen.setDate(weekMonday.getDate() - 3);
                                                windowOpen.setHours(10, 0, 0, 0);
                                                return `Opens ${formatDate(windowOpen.toISOString())} at 10:00 AM`;
                                              })()}
                                        </span>
                                      </div>
                                      {/* Show window details for scheduled check-ins */}
                                      {filter === 'scheduled' && (
                                        <div className="text-xs lg:text-xs text-gray-700 font-medium leading-relaxed mt-1">
                                          Opens Friday 10:00 AM, closes Tuesday 12:00 PM
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
                                <div className="flex-shrink-0 w-full sm:w-auto flex flex-col gap-2" onClick={(e) => completedLink && e.stopPropagation()}>
                                  {isOverdue && (
                                    <>
                                      <Link
                                        href={`/client-portal/check-in/${checkin.id}`}
                                        className="w-full sm:w-auto inline-block px-5 py-3.5 lg:px-4 lg:py-2 text-white rounded-xl lg:rounded-lg text-base lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md text-center min-h-[48px] lg:min-h-[36px] flex items-center justify-center"
                                        style={{ backgroundColor: '#daa450' }}
                                      >
                                        Complete Now
                                      </Link>
                                      {canMarkAsMissed && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCheckInForMissed(checkin);
                                            setShowMarkMissedModal(true);
                                          }}
                                          className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                        >
                                          Mark as Missed
                                        </button>
                                      )}
                                    </>
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
                                      title={isAvailable 
                                        ? 'Check-in is available now' 
                                        : 'Opens Friday 10am, closes Tuesday 12pm'}
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

      {/* Mark as Missed Modal */}
      {showMarkMissedModal && selectedCheckInForMissed && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Mark Check-in as Missed</h2>
            <p className="text-gray-600 mb-6">
              Please let your coach know why you missed this check-in. This will help them understand your situation.
            </p>

            <div className="space-y-4 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for missing check-in:
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="missedReason"
                    value="sick"
                    checked={missedReason === 'sick'}
                    onChange={(e) => setMissedReason(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-900">Sick / Unwell</span>
                </label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="missedReason"
                    value="traveling"
                    checked={missedReason === 'traveling'}
                    onChange={(e) => setMissedReason(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-900">Traveling</span>
                </label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="missedReason"
                    value="personal_emergency"
                    checked={missedReason === 'personal_emergency'}
                    onChange={(e) => setMissedReason(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-900">Personal Emergency</span>
                </label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="missedReason"
                    value="other"
                    checked={missedReason === 'other'}
                    onChange={(e) => setMissedReason(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-sm text-gray-900">Other</span>
                </label>
              </div>

              {missedReason === 'other' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Please provide details:
                  </label>
                  <textarea
                    value={missedComment}
                    onChange={(e) => setMissedComment(e.target.value)}
                    placeholder="Tell your coach why you missed this check-in..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                    rows={4}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMarkMissedModal(false);
                  setSelectedCheckInForMissed(null);
                  setMissedReason('');
                  setMissedComment('');
                }}
                disabled={markingAsMissed}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsMissed}
                disabled={markingAsMissed || !missedReason || (missedReason === 'other' && !missedComment.trim())}
                className="flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: markingAsMissed ? '#999' : '#daa450' }}
              >
                {markingAsMissed ? 'Marking...' : 'Mark as Missed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleProtected>
  );
} 