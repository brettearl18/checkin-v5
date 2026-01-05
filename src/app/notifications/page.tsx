'use client';

import React, { useState } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { AuthenticatedOnly } from '@/components/ProtectedRoute';
import Link from 'next/link';

const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, loading } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.isRead)
    : notifications;

  const getNotificationIcon = (type: string) => {
    // Use SVG icons instead of emojis for better consistency
    switch (type) {
      case 'check_in_due':
        return (
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#daa450' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        );
      case 'message_received':
        return (
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#daa450' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'goal_achieved':
        return (
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#daa450' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        );
      case 'check_in_completed':
        return (
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#daa450' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'form_assigned':
        return (
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#daa450' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'coach_message':
      case 'coach_feedback_ready':
        return (
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#daa450' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      case 'system_alert':
        return (
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#daa450' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#daa450' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        );
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'check_in_due':
        return 'bg-yellow-100 text-yellow-800';
      case 'message_received':
        return 'bg-blue-100 text-blue-800';
      case 'goal_achieved':
        return 'bg-green-100 text-green-800';
      case 'check_in_completed':
        return 'bg-green-100 text-green-800';
      case 'form_assigned':
        return 'bg-purple-100 text-purple-800';
      case 'coach_message':
        return 'bg-indigo-100 text-indigo-800';
      case 'system_alert':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    
    let date: Date;
    
    try {
      // Handle Firebase Timestamp with toDate method
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp._seconds) {
        // Handle Firestore Timestamp object with _seconds
        date = new Date(timestamp._seconds * 1000);
      } else if (timestamp instanceof Date) {
        // Handle Date object
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        // Handle ISO string
        date = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        // Handle Unix timestamp (milliseconds)
        date = new Date(timestamp);
      } else {
        // Fallback: try to create Date from timestamp
        date = new Date(timestamp);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Just now';
      }
      
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    } catch (error) {
      // If anything goes wrong, return a safe default
      console.warn('Error formatting timestamp:', error, timestamp);
      return 'Just now';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    
    let date: Date;
    
    // Handle Firebase Timestamp
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp._seconds) {
      // Handle Firestore Timestamp object
      date = new Date(timestamp._seconds * 1000);
    } else if (typeof timestamp === 'string') {
      // Handle ISO string
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      // Handle Date object
      date = timestamp;
    } else {
      // Fallback
      date = new Date(timestamp);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="animate-pulse">
              <div className="h-8 sm:h-10 bg-gray-200 rounded-2xl w-1/3 sm:w-1/4 mb-6"></div>
              <div className="space-y-3 sm:space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 p-4 sm:p-6">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
  }

  return (
    <AuthenticatedOnly>
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {/* Header Section */}
          <div className="mb-6 sm:mb-8 rounded-2xl lg:rounded-3xl border-2 overflow-hidden" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Notifications</h1>
                  <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                    {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Filter Tabs */}
                  <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-sm">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                        filter === 'all'
                          ? 'text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                      style={filter === 'all' ? { backgroundColor: '#daa450' } : {}}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      onClick={() => setFilter('unread')}
                      className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                        filter === 'unread'
                          ? 'text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                      style={filter === 'unread' ? { backgroundColor: '#daa450' } : {}}
                    >
                      Unread ({unreadCount})
                    </button>
                  </div>

                  {/* Actions */}
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="px-4 sm:px-6 py-2 text-sm sm:text-base font-medium rounded-xl text-white transition-all duration-200 shadow-sm hover:shadow-md"
                      style={{ backgroundColor: '#daa450' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c9943f'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-6 sm:p-8 text-center">
              <div className="text-5xl sm:text-6xl mb-4">🔔</div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                {filter === 'unread' 
                  ? 'You\'re all caught up! Check back later for new notifications.'
                  : 'You\'ll see notifications here when you receive messages, check-ins, and updates.'
                }
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 text-white rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                style={{ backgroundColor: '#daa450' }}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border transition-all hover:shadow-md ${
                    !notification.isRead ? 'border-2' : 'border border-gray-100'
                  }`}
                  style={!notification.isRead ? { borderColor: '#daa450', backgroundColor: '#fef9e7' } : {}}
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <div className="text-2xl sm:text-3xl">
                          {getNotificationIcon(notification.type)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className={`text-base sm:text-lg font-semibold ${
                                !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                              }`}>
                                {notification.title}
                              </h3>
                              <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getNotificationColor(notification.type)}`}>
                                {notification.type.replace('_', ' ')}
                              </span>
                              {!notification.isRead && (
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#daa450' }}></div>
                              )}
                            </div>
                            <p className="text-sm sm:text-base text-gray-600 mb-3">{notification.message}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                              <span className="text-xs sm:text-sm text-gray-500">
                                {formatTimeAgo(notification.createdAt)} • {formatDate(notification.createdAt)}
                              </span>
                              <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                                {!notification.isRead && (
                                  <button
                                    onClick={() => markAsRead(notification.id)}
                                    className="text-xs sm:text-sm font-medium transition-colors"
                                    style={{ color: '#daa450' }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#c9943f'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#daa450'}
                                  >
                                    Mark as read
                                  </button>
                                )}
                                {notification.actionUrl && (
                                  <Link
                                    href={notification.actionUrl}
                                    className="text-xs sm:text-sm font-medium transition-colors"
                                    style={{ color: '#daa450' }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#c9943f'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#daa450'}
                                  >
                                    View
                                  </Link>
                                )}
                                <button
                                  onClick={() => deleteNotification(notification.id)}
                                  className="text-xs sm:text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthenticatedOnly>
  );
};
