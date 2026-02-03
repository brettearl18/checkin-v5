'use client';

import Link from 'next/link';
import { useMemo } from 'react';

interface CheckIn {
  id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue' | 'open';
  formId: string;
  recurringWeek?: number;
}

interface MeasurementTask {
  dueDate: string;
  status: 'upcoming' | 'due' | 'overdue';
  daysUntil: number;
}

interface OnboardingTodos {
  hasWeight: boolean;
  hasMeasurements: boolean;
  hasBeforePhotos: boolean;
}

interface UnifiedTask {
  id: string;
  type: 'check-in' | 'measurement' | 'onboarding';
  title: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue' | 'open' | 'due' | 'upcoming';
  daysUntil: number;
  actionUrl: string;
  actionLabel: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface UnifiedTaskListProps {
  checkIns: CheckIn[];
  measurementTask: MeasurementTask | null;
  onboardingTodos: OnboardingTodos;
}

export default function UnifiedTaskList({
  checkIns,
  measurementTask,
  onboardingTodos,
}: UnifiedTaskListProps) {
  const tasks = useMemo(() => {
    const unifiedTasks: UnifiedTask[] = [];

    // Add check-ins
    checkIns.forEach((checkIn) => {
      if (checkIn.status === 'completed') return;

      const dueDate = new Date(checkIn.dueDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let status: 'pending' | 'overdue' | 'open' = 'pending';
      if (daysDiff < 0) {
        status = 'overdue';
      } else if (checkIn.status === 'open') {
        status = 'open';
      }

      unifiedTasks.push({
        id: checkIn.id,
        type: 'check-in',
        title: checkIn.title || 'Check-in',
        dueDate: checkIn.dueDate,
        status,
        daysUntil: daysDiff,
        actionUrl: `/client-portal/check-in/${checkIn.id}`,
        actionLabel: status === 'overdue' ? 'Complete Now' : 'Start Check-in',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        color: status === 'overdue' ? '#dc2626' : '#daa450',
        bgColor: status === 'overdue' ? '#fee2e2' : '#fef3c7',
      });
    });

    // Add measurement task
    if (measurementTask) {
      unifiedTasks.push({
        id: 'measurement-task',
        type: 'measurement',
        title: 'Update Measurements & Photos',
        dueDate: measurementTask.dueDate,
        status: measurementTask.status === 'overdue' ? 'overdue' : measurementTask.status === 'due' ? 'pending' : 'pending',
        daysUntil: measurementTask.daysUntil,
        actionUrl: '/client-portal/measurements',
        actionLabel: 'Update Now',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
        color: measurementTask.status === 'overdue' ? '#dc2626' : '#10b981',
        bgColor: measurementTask.status === 'overdue' ? '#fee2e2' : '#d1fae5',
      });
    }

    // Add onboarding tasks
    if (!onboardingTodos.hasWeight) {
      unifiedTasks.push({
        id: 'onboarding-weight',
        type: 'onboarding',
        title: 'Add Your Starting Weight',
        dueDate: new Date().toISOString(),
        status: 'pending',
        daysUntil: 0,
        actionUrl: '/client-portal/measurements',
        actionLabel: 'Add Weight',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        ),
        color: '#6366f1',
        bgColor: '#e0e7ff',
      });
    }

    if (!onboardingTodos.hasMeasurements) {
      unifiedTasks.push({
        id: 'onboarding-measurements',
        type: 'onboarding',
        title: 'Complete Body Measurements',
        dueDate: new Date().toISOString(),
        status: 'pending',
        daysUntil: 0,
        actionUrl: '/client-portal/measurements',
        actionLabel: 'Add Measurements',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ),
        color: '#6366f1',
        bgColor: '#e0e7ff',
      });
    }

    if (!onboardingTodos.hasBeforePhotos) {
      unifiedTasks.push({
        id: 'onboarding-photos',
        type: 'onboarding',
        title: 'Upload Before Photos',
        dueDate: new Date().toISOString(),
        status: 'pending',
        daysUntil: 0,
        actionUrl: '/client-portal/progress-images',
        actionLabel: 'Upload Photos',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
        color: '#6366f1',
        bgColor: '#e0e7ff',
      });
    }

    // Sort by due date (earliest first)
    return unifiedTasks.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    });
  }, [checkIns, measurementTask, onboardingTodos]);

  // Group tasks
  const groupedTasks = useMemo(() => {
    const dueToday: UnifiedTask[] = [];
    const thisWeek: UnifiedTask[] = [];
    const upcoming: UnifiedTask[] = [];

    tasks.forEach((task) => {
      const daysDiff = task.daysUntil;

      if (daysDiff <= 0) {
        // Overdue or due today
        dueToday.push(task);
      } else if (daysDiff <= 7) {
        // This week (1-7 days)
        thisWeek.push(task);
      } else {
        // Upcoming (more than 7 days)
        upcoming.push(task);
      }
    });

    return { dueToday, thisWeek, upcoming };
  }, [tasks]);

  const getStatusBadge = (task: UnifiedTask) => {
    if (task.daysUntil < 0) {
      return (
        <span className="px-2 py-0.5 text-xs font-semibold text-red-700 bg-red-100 rounded-full">
          {Math.abs(task.daysUntil)} day{Math.abs(task.daysUntil) !== 1 ? 's' : ''} overdue
        </span>
      );
    } else if (task.daysUntil === 0) {
      return (
        <span className="px-2 py-0.5 text-xs font-semibold text-orange-700 bg-orange-100 rounded-full">
          Due Today
        </span>
      );
    } else if (task.daysUntil <= 7) {
      return (
        <span className="px-2 py-0.5 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full">
          Due in {task.daysUntil} day{task.daysUntil !== 1 ? 's' : ''}
        </span>
      );
    } else {
      return (
        <span className="px-2 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-full">
          Due {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      );
    }
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      return `${Math.abs(daysDiff)} day${Math.abs(daysDiff) !== 1 ? 's' : ''} ago`;
    } else if (daysDiff === 0) {
      return 'Today';
    } else if (daysDiff === 1) {
      return 'Tomorrow';
    } else if (daysDiff <= 7) {
      return `In ${daysDiff} days`;
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-600 font-medium">All caught up!</p>
          <p className="text-gray-500 text-sm mt-1">No tasks due at the moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">My Tasks</h2>
        <Link
          href="/client-portal/check-ins"
          className="text-sm font-medium text-[#daa450] hover:text-[#c89440] transition-colors"
        >
          View All
        </Link>
      </div>

      <div className="space-y-6">
        {/* Due Today / Overdue */}
        {(groupedTasks.dueToday.length > 0) && (
          <div>
            <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Due Today / Overdue ({groupedTasks.dueToday.length})
            </h3>
            <div className="space-y-3">
              {groupedTasks.dueToday.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-xl border-2"
                  style={{
                    borderColor: task.color,
                    backgroundColor: task.bgColor + '40',
                  }}
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: task.color, color: 'white' }}
                  >
                    {task.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900">{task.title}</h4>
                      {getStatusBadge(task)}
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      {formatDueDate(task.dueDate)}
                    </p>
                    <Link
                      href={task.actionUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: task.color }}
                    >
                      {task.actionLabel}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* This Week */}
        {groupedTasks.thisWeek.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
              This Week ({groupedTasks.thisWeek.length})
            </h3>
            <div className="space-y-3">
              {groupedTasks.thisWeek.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-xl border"
                  style={{
                    borderColor: task.color + '60',
                    backgroundColor: task.bgColor + '20',
                  }}
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: task.color, color: 'white' }}
                  >
                    {task.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900">{task.title}</h4>
                      {getStatusBadge(task)}
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      {formatDueDate(task.dueDate)}
                    </p>
                    <Link
                      href={task.actionUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: task.color }}
                    >
                      {task.actionLabel}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {groupedTasks.upcoming.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              Upcoming ({groupedTasks.upcoming.length})
            </h3>
            <div className="space-y-3">
              {groupedTasks.upcoming.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50"
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: task.color, color: 'white' }}
                  >
                    {task.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-gray-900">{task.title}</h4>
                      {getStatusBadge(task)}
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      {formatDueDate(task.dueDate)}
                    </p>
                    <Link
                      href={task.actionUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: task.color }}
                    >
                      {task.actionLabel}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
              {groupedTasks.upcoming.length > 3 && (
                <Link
                  href="/client-portal/check-ins"
                  className="block text-center text-sm font-medium text-[#daa450] hover:text-[#c89440] py-2"
                >
                  View {groupedTasks.upcoming.length - 3} more upcoming tasks
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
