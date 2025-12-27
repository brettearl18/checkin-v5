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
  const { userProfile } = useAuth();
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'needsAction' | 'upcoming' | 'pending' | 'completed' | 'overdue'>('needsAction');
  const [clientId, setClientId] = useState<string | null>(null);
  const [coachTimezone, setCoachTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [thresholds, setThresholds] = useState<ScoringThresholds>(getDefaultThresholds('lifestyle'));

  useEffect(() => {
    fetchClientId();
  }, [userProfile?.email]);

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
        console.error('No user email available');
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
        setCheckins(result.data.checkins);
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

  // Filter check-ins based on next 7 days and status
  const getUpcomingCheckins = () => {
    const now = new Date();
    
    // Calculate start of today and end of next 7 days
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    const endOfNextWeek = new Date(now);
    endOfNextWeek.setDate(now.getDate() + 7);
    endOfNextWeek.setHours(23, 59, 59, 999);

    return checkins.filter(checkin => {
      const dueDate = new Date(checkin.dueDate);
      
      // Check if the due date is within the next 7 days and not completed
      return dueDate >= startOfToday && dueDate <= endOfNextWeek && checkin.status !== 'completed';
    });
  };

  // Get check-ins that are available now (window is open)
  // This includes check-ins where the window is currently open, regardless of overdue status
  // This ensures that if a check-in is overdue but its window is open, it still shows
  const getAvailableCheckins = () => {
    return checkins.filter(checkin => {
      if (checkin.status === 'completed') return false;
      const checkInWindow = checkin.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
      const windowStatus = isWithinCheckInWindow(checkInWindow);
      return windowStatus.isOpen;
    });
  };

  // Get check-ins that need action (overdue + available now)
  // This includes:
  // 1. All overdue check-ins (regardless of window status)
  // 2. All check-ins with open windows (regardless of overdue status)
  // 3. All instances of recurring check-ins (each week shown separately)
  const getNeedsActionCheckins = () => {
    const now = new Date();
    const overdue = checkins.filter(c => {
      // Check if overdue by comparing dueDate to now
      const dueDate = new Date(c.dueDate);
      const hoursOverdue = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60);
      return hoursOverdue > 0 && c.status !== 'completed';
    });
    
    const available = getAvailableCheckins();
    
    // Combine both lists - each check-in (including different weeks of recurring) should show
    // Since recurring check-ins have different IDs for each week, no need to deduplicate
    const combined = [...overdue, ...available];
    
    // Remove duplicates by ID only (in case a check-in is both overdue AND has open window)
    return combined.filter((checkin, index, self) => 
      index === self.findIndex(c => c.id === checkin.id)
    );
  };

  // Sort check-ins by urgency: overdue > available now > upcoming > completed
  const sortByUrgency = (checkinsList: CheckIn[]) => {
    return [...checkinsList].sort((a, b) => {
      // Overdue first
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      
      // Then available now
      const aWindow = a.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
      const bWindow = b.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
      const aAvailable = isWithinCheckInWindow(aWindow).isOpen && a.status !== 'completed';
      const bAvailable = isWithinCheckInWindow(bWindow).isOpen && b.status !== 'completed';
      if (aAvailable && !bAvailable) return -1;
      if (bAvailable && !aAvailable) return 1;
      
      // Then by due date (earliest first)
      const aDue = new Date(a.dueDate).getTime();
      const bDue = new Date(b.dueDate).getTime();
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      return aDue - bDue;
    });
  };

  const filteredCheckins = (() => {
    let result: CheckIn[] = [];
    switch (filter) {
      case 'needsAction':
        result = getNeedsActionCheckins();
        break;
      case 'upcoming':
        result = getUpcomingCheckins();
        break;
      case 'pending':
        result = checkins.filter(c => c.status === 'pending');
        break;
      case 'completed':
        result = checkins.filter(c => c.status === 'completed');
        break;
      case 'overdue':
        result = checkins.filter(c => c.status === 'overdue');
        break;
      default:
        result = checkins;
    }
    // Always sort by urgency
    return sortByUrgency(result);
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
    
    // For pending check-ins, use window status
    const checkInWindow = checkin.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
    const windowStatus = isWithinCheckInWindow(checkInWindow);
    if (windowStatus.isOpen) return 'border-l-4 border-green-500';
    
    return 'border-l-4 border-yellow-500';
  };

  const stats = {
    upcoming: getUpcomingCheckins().length,
    pending: checkins.filter(c => c.status === 'pending').length,
    completed: checkins.filter(c => c.status === 'completed').length,
    overdue: checkins.filter(c => c.status === 'overdue').length,
    available: getAvailableCheckins().length,
    needsAction: getNeedsActionCheckins().length
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

            {/* Filters */}
            <div className="mb-4 lg:mb-6">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'needsAction', label: 'Needs Action', count: stats.needsAction, color: 'red' },
                  { key: 'upcoming', label: 'Upcoming', count: stats.upcoming, color: 'blue' },
                  { key: 'pending', label: 'Pending', count: stats.pending, color: 'yellow' },
                  { key: 'completed', label: 'Completed', count: stats.completed, color: 'green' },
                  { key: 'overdue', label: 'Overdue', count: stats.overdue, color: 'red' }
                ].map((filterOption) => (
                  <button
                    key={filterOption.key}
                    onClick={() => setFilter(filterOption.key as any)}
                    className={`px-3 py-2 lg:px-5 lg:py-2.5 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200 min-h-[36px] ${
                      filter === filterOption.key
                        ? filterOption.color === 'red'
                          ? 'bg-red-600 text-white shadow-lg'
                          : filterOption.color === 'green'
                          ? 'bg-green-600 text-white shadow-lg'
                          : filterOption.color === 'yellow'
                          ? 'bg-yellow-500 text-white shadow-lg'
                          : 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white/80 backdrop-blur-sm text-gray-900 hover:bg-white border border-gray-200/60 hover:shadow-md'
                    }`}
                  >
                    <span className="hidden sm:inline">{filterOption.label}</span>
                    <span className="sm:hidden">{filterOption.label.split(' ')[0]}</span>
                    {filterOption.count > 0 && <span className="ml-1">({filterOption.count})</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Check-ins List */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
              <div className="p-4 lg:p-5 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50">
                <h2 className="text-lg lg:text-xl font-bold text-gray-900">
                  {filter === 'needsAction' ? '🔴 Needs Your Action' : 
                   filter === 'upcoming' ? '📅 Upcoming Check-ins (Next 7 Days)' : 
                   filter === 'overdue' ? '⚠️ Overdue Check-ins' :
                   filter === 'completed' ? '✅ Completed Check-ins' :
                   `${filter.charAt(0).toUpperCase() + filter.slice(1)} Check-ins`}
                </h2>
                <p className="text-gray-900 text-xs lg:text-sm mt-0.5 lg:mt-1">
                  {filteredCheckins.length} check-in{filteredCheckins.length !== 1 ? 's' : ''} found
                </p>
              </div>
              
              <div className="p-4 lg:p-5">
                {filteredCheckins.length > 0 ? (
                  <div className="space-y-3">
                    {filteredCheckins.map((checkin) => {
                      const checkInWindow = checkin.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
                      const windowStatus = isWithinCheckInWindow(checkInWindow);
                      const isAvailable = windowStatus.isOpen && checkin.status !== 'completed';
                      const isOverdue = checkin.status === 'overdue';
                      const isCompleted = checkin.status === 'completed';
                      
                      // Determine the best action link for completed check-ins
                      const getCompletedCheckInLink = () => {
                        if (checkin.coachResponded && checkin.responseId) {
                          return `/client-portal/feedback/${checkin.responseId}`;
                        } else if (checkin.responseId) {
                          return `/client-portal/check-in/${checkin.id}/success`;
                        }
                        return null;
                      };

                      const completedLink = isCompleted ? getCompletedCheckInLink() : null;
                      const CardWrapper = completedLink ? Link : 'div';
                      const cardProps = completedLink ? { href: completedLink } : {};

                      return (
                        <CardWrapper
                          key={checkin.id}
                          {...cardProps}
                          className={`${getCardBorderColor(checkin)} bg-white/80 backdrop-blur-sm rounded-lg p-3 lg:p-4 hover:shadow-md transition-all duration-200 border border-gray-200/60 ${completedLink ? 'cursor-pointer' : ''}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            {/* Left: Main Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h3 className="text-sm lg:text-base font-bold text-gray-900 truncate">{checkin.title}</h3>
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
                                    {!windowStatus.isOpen && !isOverdue && !isCompleted && (
                                      <span className="px-1.5 py-0.5 rounded-full text-[10px] lg:text-xs font-medium bg-yellow-100 text-yellow-800 flex-shrink-0">
                                        Window Closed
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
                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 lg:py-1 rounded text-[10px] lg:text-xs ${
                                      windowStatus.isOpen 
                                        ? 'bg-green-50 text-green-800' 
                                        : 'bg-yellow-50 text-yellow-800'
                                    }`}>
                                      {windowStatus.isOpen ? '✅' : '⏰'} <span className="hidden sm:inline">{windowStatus.message}</span>
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
                                  {!windowStatus.isOpen && !isOverdue && !isCompleted && (
                                    <button
                                      disabled
                                      className="w-full sm:w-auto px-3 py-2 lg:px-4 lg:py-2 bg-gray-300 text-gray-600 rounded-lg text-xs lg:text-sm font-semibold cursor-not-allowed min-h-[36px]"
                                      title={getCheckInWindowDescription(checkInWindow)}
                                    >
                                      Window Closed
                                    </button>
                                  )}
                                  {isCompleted && (
                                    <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
                                      {checkin.coachResponded && checkin.responseId && (
                                        <Link
                                          href={`/client-portal/feedback/${checkin.responseId}`}
                                          className="w-full sm:w-auto px-3 py-2 lg:px-4 lg:py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 min-h-[36px]"
                                          onClick={(e) => e.stopPropagation()}
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
                                        onClick={(e) => e.stopPropagation()}
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
                    <div className="text-6xl mb-4">
                      {filter === 'needsAction' ? '🎯' :
                       filter === 'completed' ? '✅' : 
                       filter === 'overdue' ? '🎉' : 
                       filter === 'upcoming' ? '📅' : '📋'}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {filter === 'needsAction' ? 'All caught up!' :
                       filter === 'completed' ? 'No completed check-ins yet' :
                       filter === 'overdue' ? 'No overdue check-ins!' :
                       filter === 'upcoming' ? 'No check-ins this week' :
                       'No check-ins found'}
                    </h3>
                    <p className="text-gray-900 text-sm max-w-md mx-auto">
                      {filter === 'needsAction' 
                        ? 'You\'re all set! No check-ins need your immediate attention.'
                        : filter === 'completed' 
                        ? 'Complete your first check-in to see your results here.'
                        : filter === 'overdue'
                        ? 'Great job staying on top of your check-ins!'
                        : filter === 'upcoming'
                        ? 'No check-ins scheduled for this week. Check back later!'
                        : 'No check-ins have been assigned yet.'
                      }
                    </p>
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