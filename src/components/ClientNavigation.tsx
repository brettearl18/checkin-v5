'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBadge from './NotificationBadge';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  description: string;
}

const clientNavItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/client-portal',
    icon: '📊',
    description: 'Overview of your progress'
  },
  {
    name: 'Check-ins',
    href: '/client-portal/check-ins',
    icon: '✅',
    description: 'Complete assigned check-ins'
  },
  {
    name: 'Progress',
    href: '/client-portal/progress',
    icon: '📈',
    description: 'View your progress reports'
  },
  {
    name: 'History',
    href: '/client-portal/history',
    icon: '📋',
    description: 'View response history'
  },
  {
    name: 'Goals',
    href: '/client-portal/goals',
    icon: '🎯',
    description: 'Set and track your goals'
  },
  {
    name: 'Messages',
    href: '/client-portal/messages',
    icon: '💬',
    description: 'Communicate with your coach'
  },
  {
    name: 'Resources',
    href: '/client-portal/resources',
    icon: '📚',
    description: 'Access wellness resources'
  },
  {
    name: 'Profile',
    href: '/client-portal/profile',
    icon: '👤',
    description: 'Manage your profile'
  }
];

export default function ClientNavigation() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const { userProfile, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === '/client-portal') {
      return pathname === '/client-portal';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className={`bg-white shadow-lg transition-all duration-300 h-screen flex flex-col ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-bold text-gray-900">Client Portal</h2>
              <p className="text-sm text-gray-600">Track your wellness journey</p>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title={isCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <span className="text-gray-600">
              {isCollapsed ? '→' : '←'}
            </span>
          </button>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {clientNavItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center p-3 rounded-lg transition-colors ${
              isActive(item.href)
                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
            title={isCollapsed ? item.name : undefined}
          >
            <span className="text-xl mr-3">{item.icon}</span>
            {!isCollapsed && (
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-gray-500">{item.description}</div>
              </div>
            )}
          </Link>
        ))}
        <Link
          href="/notifications"
          className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            pathname === '/notifications'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Notifications
          <NotificationBadge className="ml-auto" />
        </Link>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {userProfile?.firstName?.charAt(0) || 'C'}
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">
                  {userProfile?.firstName} {userProfile?.lastName}
                </div>
                <div className="text-xs text-gray-500">Client</div>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className={`p-2 rounded-md hover:bg-red-50 hover:text-red-700 transition-colors ${
              isCollapsed ? 'w-full' : ''
            }`}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <span className="text-red-600">
              {isCollapsed ? '🚪' : 'Logout'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
} 