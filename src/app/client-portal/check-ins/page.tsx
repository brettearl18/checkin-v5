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
  const [filter, setFilter] = useState<'toDo' | 'scheduled' | 'completed'>('toDo');
  const [clientId, setClientId] = useState<string | null>(null);
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
    }
  }, [clientId]);

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
          // Default to lifestyle
          clientThresholds = getDefaultThresholds('lifestyle');
        }

        setThresholds(clientThresholds);
      } else {
        // No scoring config, use default lifestyle thresholds
        setThresholds(getDefaultThresholds('lifestyle'));
      }
    } catch (error) {
      console.error('Error fetching scoring config:', error);
      // Use default lifestyle thresholds on error
      setThresholds(getDefaultThresholds('lifestyle'));
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
  // Includes: overdue, available now (window open), or due within next 7 days (not completed)
  const getToDoCheckins = () => {
    const now = new Date();
    const endOfNextWeek = new Date(now);
    endOfNextWeek.setDate(now.getDate() + 7);
    endOfNextWeek.setHours(23, 59, 59, 999);

    return checkins.filter(checkin => {
      // Exclude completed check-ins from "To Do"
      if (checkin.status === 'completed') return false;

      const dueDate = new Date(checkin.dueDate);
      
      // Normalize dates for comparison (set to start of day)
      dueDate.setHours(0, 0, 0, 0);
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      // Include if overdue
      if (dueDate < today) return true;
      
      // Include if due date has arrived AND window is open (available now)
      if (dueDate <= today) {
        const checkInWindow = checkin.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
        const windowStatus = isWithinCheckInWindow(checkInWindow);
        if (windowStatus.isOpen) return true;
      }
      
      // Include if due within next 7 days
      if (dueDate >= now && dueDate <= endOfNextWeek) return true;
      
      return false;
    });
  };

  // "Scheduled" - Next 2 upcoming check-ins
  // Shows the next 2 upcoming check-ins so users can see what's coming and when windows open
  const getScheduledCheckins = () => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const futureCheckins = checkins
      .filter(checkin => {
        // Exclude completed check-ins from "Scheduled"
        if (checkin.status === 'completed') return false;
        const dueDate = new Date(checkin.dueDate);
        // Only include future check-ins (due date is today or later)
        return dueDate >= startOfToday;
      })
      .sort((a, b) => {
        // Sort by due date (earliest first)
        const dateA = new Date(a.dueDate).getTime();
        const dateB = new Date(b.dueDate).getTime();
        return dateA - dateB;
      })
      .slice(0, 2); // Get the next 2 upcoming check-ins

    return futureCheckins;
  };

  // Get the next scheduled check-in (for empty state messaging)
  const getNextScheduledCheckin = () => {
    const scheduled = getScheduledCheckins();
    if (scheduled.length === 0) return null;
    
    return scheduled.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    })[0];
  };

  const filteredCheckins = (() => {
    let result: CheckIn[] = [];
    switch (filter) {
      case 'toDo':
        result = getToDoCheckins();
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
        result = getScheduledCheckins();
        // Sort by due date (earliest first)
        return result.sort((a, b) => {
          const dateA = new Date(a.dueDate).getTime();
          const dateB = new Date(b.dueDate).getTime();
          return dateA - dateB;
        });
      case 'completed':
        result = checkins.filter(c => c.status === 'completed');
        // Sort by completion date (most recent first)
        return result.sort((a, b) => {
          const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return dateB - dateA;
        });
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
    completed: checkins.filter(c => c.status === 'completed').length,
    total: checkins.length
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex flex-col lg:flex-row">
        <ClientNavigation />
        
        {/* Mobile Top Bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-4 bg-white/90 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-semibold">
              {userProfile?.firstName?.charAt(0) || 'C'}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">My Check-ins</p>
              <p className="text-xs text-gray-500">Track your progress</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 lg:ml-4 p-4 lg:p-5 pt-6 lg:pt-5">
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

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
              <div className="group relative bg-white/80 backdrop-blur-sm rounded-lg lg:rounded-xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-lg hover:border-red-300/50 transition-all duration-300 hover:-translate-y-0.5">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative px-3 py-2.5 lg:px-4 lg:py-3">
                  <div className="flex items-center justify-between mb-1.5 lg:mb-2">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-sm">
                      <svg className="w-4 h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{stats.needsAction}</div>
                  <div className="text-[10px] lg:text-xs text-gray-900 mt-0.5 lg:mt-1 font-medium">Needs Action</div>
                </div>
              </div>

              <div className="group relative bg-white/80 backdrop-blur-sm rounded-lg lg:rounded-xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-lg hover:border-blue-300/50 transition-all duration-300 hover:-translate-y-0.5">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative px-3 py-2.5 lg:px-4 lg:py-3">
                  <div className="flex items-center justify-between mb-1.5 lg:mb-2">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                      <svg className="w-4 h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{stats.upcoming}</div>
                  <div className="text-[10px] lg:text-xs text-gray-900 mt-0.5 lg:mt-1 font-medium">Upcoming</div>
                </div>
              </div>

              <div className="group relative bg-white/80 backdrop-blur-sm rounded-lg lg:rounded-xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-lg hover:border-green-300/50 transition-all duration-300 hover:-translate-y-0.5">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative px-3 py-2.5 lg:px-4 lg:py-3">
                  <div className="flex items-center justify-between mb-1.5 lg:mb-2">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm">
                      <svg className="w-4 h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{stats.completed}</div>
                  <div className="text-[10px] lg:text-xs text-gray-900 mt-0.5 lg:mt-1 font-medium">Completed</div>
                </div>
              </div>

              <div className="group relative bg-white/80 backdrop-blur-sm rounded-lg lg:rounded-xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-lg hover:border-yellow-300/50 transition-all duration-300 hover:-translate-y-0.5">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative px-3 py-2.5 lg:px-4 lg:py-3">
                  <div className="flex items-center justify-between mb-1.5 lg:mb-2">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-sm">
                      <svg className="w-4 h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{stats.pending}</div>
                  <div className="text-[10px] lg:text-xs text-gray-900 mt-0.5 lg:mt-1 font-medium">Pending</div>
                </div>
              </div>
            </div>

            {/* Filters - 3 Clear Tabs */}
            <div className="mb-4 lg:mb-6">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'toDo', label: 'To Do', count: stats.toDo, color: 'red', icon: '📋' },
                  { key: 'scheduled', label: 'Scheduled', count: stats.scheduled, color: 'blue', icon: '📅' },
                  { key: 'completed', label: 'Completed', count: stats.completed, color: 'green', icon: '✅' }
                ].map((filterOption) => (
                  <button
                    key={filterOption.key}
                    onClick={() => setFilter(filterOption.key as any)}
                    className={`px-4 py-2.5 lg:px-6 lg:py-3 rounded-xl text-sm lg:text-base font-semibold transition-all duration-200 min-h-[44px] flex items-center gap-2 ${
                      filter === filterOption.key
                        ? filterOption.color === 'red'
                          ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                          : filterOption.color === 'green'
                          ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                          : 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-white/80 backdrop-blur-sm text-gray-900 hover:bg-white border-2 border-gray-200/60 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <span className="text-lg">{filterOption.icon}</span>
                    <span>{filterOption.label}</span>
                    {filterOption.count > 0 && (
                      <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        filter === filterOption.key
                          ? 'bg-white/20 text-white'
                          : filterOption.color === 'red'
                          ? 'bg-red-100 text-red-700'
                          : filterOption.color === 'green'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {filterOption.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Check-ins List */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
              <div className="p-4 lg:p-5 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50">
                <h2 className="text-lg lg:text-xl font-bold text-gray-900">
                  {filter === 'toDo' ? '📋 Check-ins To Do' : 
                   filter === 'scheduled' ? '📅 Scheduled Check-ins' :
                   '✅ Completed Check-ins'}
                </h2>
                <p className="text-gray-900 text-xs lg:text-sm mt-0.5 lg:mt-1">
                  {filter === 'toDo' && 'Complete your check-ins that need attention'}
                  {filter === 'scheduled' && 'Upcoming check-ins scheduled for later'}
                  {filter === 'completed' && 'Your completed check-ins and results'}
                  {filteredCheckins.length > 0 && ` • ${filteredCheckins.length} check-in${filteredCheckins.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              
              <div className="p-4 lg:p-5">
                {filteredCheckins.length > 0 ? (
                  <div className="space-y-3">
                    {filteredCheckins.map((checkin) => {
                      const checkInWindow = checkin.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
                      const windowStatus = isWithinCheckInWindow(checkInWindow);
                      
                      // A check-in is only available if:
                      // 1. The due date has arrived (today >= due date)
                      // 2. AND we're currently within the check-in window period
                      // 3. AND the check-in is not completed
                      const now = new Date();
                      const dueDate = new Date(checkin.dueDate);
                      dueDate.setHours(0, 0, 0, 0); // Reset to start of day for comparison
                      const today = new Date(now);
                      today.setHours(0, 0, 0, 0);
                      
                      const dueDateHasArrived = dueDate <= today;
                      const isAvailable = dueDateHasArrived && windowStatus.isOpen && checkin.status !== 'completed';
                      const isOverdue = checkin.status === 'overdue';
                      const isCompleted = checkin.status === 'completed';
                      
                      // For completed check-ins, don't make the entire card a link since there are action buttons inside
                      // Instead, just use a div wrapper
                      const CardWrapper = 'div';

                      return (
                        <CardWrapper
                          key={checkin.id}
                          className={`${getCardBorderColor(checkin)} bg-white/80 backdrop-blur-sm rounded-lg p-3 lg:p-4 hover:shadow-md transition-all duration-200 border border-gray-200/60`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            {/* Left: Main Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h3 className="text-sm lg:text-base font-bold text-gray-900 truncate">
                                      {checkin.isRecurring && checkin.recurringWeek 
                                        ? `Week ${checkin.recurringWeek}: ${checkin.title}`
                                        : checkin.title
                                      }
                                    </h3>
                                    {checkin.status === 'overdue' && (
                                      <span className="px-1.5 py-0.5 rounded-full text-[10px] lg:text-xs font-medium bg-red-100 text-red-800 flex-shrink-0">
                                        Overdue
                                      </span>
                                    )}
                                    {isAvailable && !isOverdue && (
                                      <span className="px-1.5 py-0.5 rounded-full text-[10px] lg:text-xs font-medium bg-green-100 text-green-800 flex-shrink-0">
                                        Available Now
                                      </span>
                                    )}
                                    {!isAvailable && !isOverdue && !isCompleted && (
                                      <span className="px-1.5 py-0.5 rounded-full text-[10px] lg:text-xs font-medium bg-yellow-100 text-yellow-800 flex-shrink-0">
                                        {dueDateHasArrived ? 'Window Closed' : 'Not Yet Available'}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Time indicator */}
                                  <p className="text-[10px] lg:text-xs text-gray-900 mb-1.5 lg:mb-2">
                                    {isOverdue 
                                      ? getTimeUntilDue(checkin.dueDate)
                                      : isCompleted
                                      ? `Completed ${checkin.completedAt ? formatDate(checkin.completedAt) : ''}`
                                      : getTimeUntilDue(checkin.dueDate)
                                    }
                                  </p>

                                  {/* Window status for pending check-ins */}
                                  {!isCompleted && !isOverdue && (
                                    <div className="mt-2 space-y-1">
                                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 lg:py-1 rounded text-[10px] lg:text-xs ${
                                        isAvailable 
                                          ? 'bg-green-50 text-green-800' 
                                          : dueDateHasArrived
                                          ? 'bg-yellow-50 text-yellow-800'
                                          : 'bg-gray-50 text-gray-800'
                                      }`}>
                                        {isAvailable ? '✅' : dueDateHasArrived ? '⏰' : '📅'} <span className="hidden sm:inline">
                                          {isAvailable ? windowStatus.message : dueDateHasArrived ? windowStatus.message : (() => {
                                            const windowStartDate = getCheckInWindowStartDate(checkin.dueDate, checkInWindow);
                                            return `Available on ${formatDate(windowStartDate.toISOString())}`;
                                          })()}
                                        </span>
                                      </div>
                                      {/* Show window details for scheduled check-ins */}
                                      {filter === 'scheduled' && checkInWindow?.enabled && checkInWindow?.startDay && checkInWindow?.startTime && (
                                        <div className="text-[10px] lg:text-xs text-gray-700 font-medium">
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
                                    <div className="mt-2">
                                      <div className="flex items-center justify-between text-xs text-gray-900 mb-1">
                                        <span className="font-medium">Week {checkin.recurringWeek} of {checkin.totalWeeks}</span>
                                        <span>{Math.round((checkin.recurringWeek / checkin.totalWeeks) * 100)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div 
                                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full transition-all duration-300"
                                          style={{ width: `${(checkin.recurringWeek / checkin.totalWeeks) * 100}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Feedback indicator for completed check-ins */}
                                  {isCompleted && checkin.coachResponded && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 mt-2">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Coach Feedback Available
                                    </div>
                                  )}

                                  {/* Score for completed with traffic light */}
                                  {isCompleted && checkin.score && (
                                    <div className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs mt-1">
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
                                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${colors[status]}`}>
                                            <span className="text-xs">{icons[status]}</span>
                                            <span className="font-bold">Score: {score}%</span>
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
                                      className="w-full sm:w-auto inline-block px-3 py-2 lg:px-4 lg:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md text-center min-h-[36px] flex items-center justify-center"
                                    >
                                      Complete Now
                                    </Link>
                                  )}
                                  {isAvailable && !isOverdue && (
                                    <Link
                                      href={`/client-portal/check-in/${checkin.id}`}
                                      className="w-full sm:w-auto inline-block px-3 py-2 lg:px-4 lg:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md text-center min-h-[36px] flex items-center justify-center"
                                    >
                                      Start Check-in
                                    </Link>
                                  )}
                                  {!isAvailable && !isOverdue && !isCompleted && (
                                    <button
                                      disabled
                                      className="w-full sm:w-auto px-3 py-2 lg:px-4 lg:py-2 bg-gray-300 text-gray-600 rounded-lg text-xs lg:text-sm font-semibold cursor-not-allowed min-h-[36px]"
                                      title={dueDateHasArrived ? getCheckInWindowDescription(checkInWindow) : (() => {
                                        const windowStartDate = getCheckInWindowStartDate(checkin.dueDate, checkInWindow);
                                        return `Check-in available on ${formatDate(windowStartDate.toISOString())}`;
                                      })()}
                                    >
                                      {dueDateHasArrived ? 'Window Closed' : 'Not Available Yet'}
                                    </button>
                                  )}
                                  {isCompleted && (
                                    <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
                                      {checkin.coachResponded && checkin.responseId && (
                                        <Link
                                          href={`/client-portal/feedback/${checkin.responseId}`}
                                          className="w-full sm:w-auto px-3 py-2 lg:px-4 lg:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 min-h-[36px]"
                                        >
                                          <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span className="hidden sm:inline">View Feedback</span>
                                          <span className="sm:hidden">Feedback</span>
                                        </Link>
                                      )}
                                      <Link
                                        href={`/client-portal/check-in/${checkin.id}/success`}
                                        className="w-full sm:w-auto px-3 py-2 lg:px-4 lg:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 min-h-[36px]"
                                      >
                                        <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="text-center py-12">
                    {filter === 'toDo' ? (
                      <>
                        <div className="text-6xl mb-4">🎯</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">All caught up!</h3>
                        <p className="text-gray-900 text-sm max-w-md mx-auto mb-6">
                          No check-ins need your attention right now. Great job staying on top of things!
                        </p>
                        {(() => {
                          const nextScheduled = getNextScheduledCheckin();
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
                    ) : filter === 'scheduled' ? (() => {
                      const nextScheduled = getNextScheduledCheckin();
                      if (nextScheduled) {
                        const scheduledDueDate = new Date(nextScheduled.dueDate);
                        const now = new Date();
                        const diffTime = scheduledDueDate.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const diffWeeks = Math.floor(diffDays / 7);
                        
                        return (
                          <div>
                            <div className="text-6xl mb-4">📅</div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No scheduled check-ins</h3>
                            <p className="text-gray-900 text-sm max-w-md mx-auto mb-6">
                              All your upcoming check-ins are ready to complete. Check the "To Do" tab!
                            </p>
                            
                            {/* Next Check-in Card */}
                            <div className="max-w-md mx-auto bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 shadow-lg">
                              <div className="flex items-center justify-center mb-3">
                                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              </div>
                              <h4 className="text-lg font-bold text-gray-900 mb-2">Next Check-in</h4>
                              <p className="text-base font-semibold text-blue-900 mb-3">{nextScheduled.title}</p>
                              <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="font-medium">
                                  Due {formatDate(nextScheduled.dueDate)}
                                </span>
                              </div>
                              <p className="text-sm text-blue-700 mt-2 font-medium">
                                {diffDays === 0 
                                  ? 'Due today'
                                  : diffDays === 1
                                  ? 'Due tomorrow'
                                  : diffWeeks === 1
                                  ? 'Due in 1 week'
                                  : diffWeeks > 1
                                  ? `Due in ${diffWeeks} weeks`
                                  : `Due in ${diffDays} days`
                                }
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <>
                          <div className="text-6xl mb-4">📅</div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">No scheduled check-ins</h3>
                          <p className="text-gray-900 text-sm max-w-md mx-auto">
                            All your upcoming check-ins are ready to complete. Check the "To Do" tab!
                          </p>
                        </>
                      );
                    })() : (
                      <>
                        <div className="text-6xl mb-4">✅</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No completed check-ins yet</h3>
                        <p className="text-gray-900 text-sm max-w-md mx-auto">
                          Complete your first check-in to see your results and progress here.
                        </p>
                      </>
                    )}
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