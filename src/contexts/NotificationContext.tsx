'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

interface Notification {
  id: string;
  userId: string;
  type: 'check_in_due' | 'message_received' | 'goal_achieved' | 'check_in_completed' | 'form_assigned' | 'coach_message' | 'system_alert';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: any;
  actionUrl?: string;
  metadata?: {
    clientId?: string;
    coachId?: string;
    formId?: string;
    assignmentId?: string;
    messageId?: string;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!userProfile?.uid || !isMounted) return;

    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`/api/notifications?userId=${userProfile.uid}&limit=50`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check if response is ok before parsing
      if (!response.ok) {
        console.error('Failed to fetch notifications:', response.status, response.statusText);
        // Don't throw, just log and return empty state only if it's a client error
        if (response.status >= 400 && response.status < 500) {
          setNotifications([]);
          setUnreadCount(0);
          setTotalCount(0);
        }
        return;
      }

      const data = await response.json();

      if (!isMounted) return; // Check again after async operation

      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setTotalCount(data.totalCount || 0);
      } else {
        console.error('Failed to fetch notifications:', data.message);
        // Set empty state on failure
        setNotifications([]);
        setUnreadCount(0);
        setTotalCount(0);
      }
    } catch (error: any) {
      // Handle network errors gracefully
      if (error.name === 'AbortError') {
        console.warn('Notification fetch aborted (timeout or component unmounted)');
        return;
      }
      
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        // Network error - don't clear existing notifications, just log
        console.warn('Network error fetching notifications - will retry on next interval');
      } else {
        console.error('Error fetching notifications:', error);
        // Only clear on non-network errors
        if (isMounted) {
          setNotifications([]);
          setUnreadCount(0);
          setTotalCount(0);
        }
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  }, [userProfile?.uid, isMounted]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId, isRead: true }),
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, isRead: true }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.uid) return;
    
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          markAllAsRead: true,
          userId: userProfile.uid 
        }),
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, isRead: true }))
        );
        setUnreadCount(0);
      } else {
        console.error('Failed to mark all notifications as read:', response.status);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [userProfile?.uid]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const notification = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setTotalCount(prev => prev - 1);
        if (notification && !notification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setTotalCount(0);
  }, []);

  // Fetch notifications on mount and when user changes
  useEffect(() => {
    if (userProfile?.uid) {
      fetchNotifications();
    } else {
      clearNotifications();
    }
  }, [userProfile?.uid, fetchNotifications, clearNotifications]);

  // Set up polling for new notifications (every 2 minutes instead of 30 seconds)
  useEffect(() => {
    if (!userProfile?.uid) return;

    const interval = setInterval(() => {
      if (isMounted) {
        fetchNotifications();
      }
    }, 120000); // 2 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, [userProfile?.uid, fetchNotifications, isMounted]);

  // When app becomes visible (user returns), fetch notifications immediately
  // This ensures users see all pending/missed notifications when they come back
  useEffect(() => {
    if (!userProfile?.uid || typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        // User returned to the app - check for new notifications immediately
        fetchNotifications();
      }
    };

    const handleFocus = () => {
      if (isMounted) {
        // App window focused - check for new notifications
        fetchNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userProfile?.uid, fetchNotifications, isMounted]);

  // Track mount status
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    totalCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}; 