'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBadge from './NotificationBadge';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  description: string;
}

const getPageTitle = (pathname: string): string => {
  if (pathname === '/dashboard') return 'Dashboard';
  if (pathname.startsWith('/clients')) return 'My Clients';
  if (pathname.startsWith('/messages')) return 'Messages';
  if (pathname.startsWith('/analytics')) return 'Analytics';
  if (pathname.startsWith('/forms')) return 'Forms';
  if (pathname.startsWith('/questions')) return 'Questions Library';
  if (pathname.startsWith('/check-ins')) return 'Check-ins';
  if (pathname.startsWith('/responses')) return 'Responses';
  if (pathname.startsWith('/test-scheduled-emails')) return 'Test Scheduled Emails';
  if (pathname.startsWith('/test-email')) return 'Test Email';
  return 'Coach Portal';
};

const coachNavItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
      </svg>
    ),
    description: 'Overview of your business'
  },
  {
    name: 'My Clients',
    href: '/clients',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
    description: 'Manage client profiles'
  },
  {
    name: 'Messages',
    href: '/messages',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    description: 'Communicate with clients'
  },
  {
    name: 'Check-ins',
    href: '/check-ins',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: 'View check-ins & responses'
  },
  {
    name: 'Responses',
    href: '/responses',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    description: 'View client responses'
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    description: 'View progress reports'
  },
  {
    name: 'Forms',
    href: '/forms',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: 'Create and manage forms'
  },
  {
    name: 'Questions Library',
    href: '/questions/library',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: 'Manage question templates'
  }
];

export default function CoachNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { userProfile, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const currentPageTitle = getPageTitle(pathname);

  return (
    <div className="relative">
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 bg-white border border-gray-300 rounded-lg p-2 shadow-lg"
      >
        <span className="text-xl">☰</span>
      </button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setIsOpen(false)} />
      )}

      {/* Navigation menu */}
      <div className={`
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        fixed lg:static inset-y-0 left-0 z-50
        w-64
        bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-r border-gray-100
        transform transition-all duration-300 ease-in-out
        overflow-y-auto flex flex-col
      `}>
        {/* Sidebar Header */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Coach Hub</h1>
              <p className="text-orange-100 text-sm">{currentPageTitle}</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="px-4 py-6 flex-1">
          <div className="space-y-2">
            {coachNavItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200
                  ${isActive(item.href)
                    ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-500'
                    : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'
                  }
                `}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isActive(item.href) ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <div className={isActive(item.href) ? 'text-orange-600' : 'text-gray-600'}>
                    {item.icon}
                  </div>
                </div>
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-gray-200"></div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <h3 className="px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Quick Actions</h3>
            
            <Link
              href="/clients/create"
              onClick={() => setIsOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200"
            >
              <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span>Add Client</span>
            </Link>

            <Link
              href="/forms/create"
              onClick={() => setIsOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200"
            >
              <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span>Create Form</span>
            </Link>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-gray-200"></div>

          {/* Tools Section */}
          <div className="space-y-2">
            <h3 className="px-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">Tools</h3>
            
            <Link
              href="/test-scheduled-emails"
              onClick={() => setIsOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${
                isActive('/test-scheduled-emails')
                  ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-500'
                  : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isActive('/test-scheduled-emails') ? 'bg-orange-100' : 'bg-gray-100'
              }`}>
                <svg className={`w-4 h-4 ${isActive('/test-scheduled-emails') ? 'text-orange-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span>Test Scheduled Emails</span>
            </Link>

            <Link
              href="/test-email"
              onClick={() => setIsOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${
                isActive('/test-email')
                  ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-500'
                  : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isActive('/test-email') ? 'bg-orange-100' : 'bg-gray-100'
              }`}>
                <svg className={`w-4 h-4 ${isActive('/test-email') ? 'text-orange-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span>Test Email</span>
            </Link>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-gray-200"></div>

          {/* User Profile */}
          <div className="px-4">
            <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-orange-50 rounded-2xl border border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {userProfile?.firstName?.charAt(0) || 'C'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {userProfile?.firstName} {userProfile?.lastName}
                </p>
                <p className="text-xs text-gray-700">Coach</p>
              </div>
              <button
                onClick={logout}
                className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center hover:bg-red-200 transition-colors"
              >
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </nav>

        {/* Close button for mobile */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
        >
          <span className="text-xl">✕</span>
        </button>
      </div>
    </div>
  );
}
