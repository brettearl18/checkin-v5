'use client';

import { useState, useEffect, useRef } from 'react';
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

const clientNavItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/client-portal',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
      </svg>
    ),
    description: 'Overview of your progress'
  },
  {
    name: 'Check-ins',
    href: '/client-portal/check-ins',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: 'Complete assigned check-ins'
  },
  {
    name: 'Progress',
    href: '/client-portal/progress',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    description: 'View your progress reports'
  },
  {
    name: 'Progress Images',
    href: '/client-portal/progress-images',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: 'Upload and view progress photos'
  },
  {
    name: 'History',
    href: '/client-portal/history',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: 'View response history'
  },
  {
    name: 'Goals',
    href: '/client-portal/goals',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: 'Set and track your goals'
  },
  {
    name: 'Messages',
    href: '/client-portal/messages',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    description: 'Communicate with your coach'
  },
  {
    name: 'Resources',
    href: '/client-portal/resources',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    description: 'Access wellness resources'
  },
  {
    name: 'Profile',
    href: '/client-portal/profile',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    description: 'Manage your profile'
  },
  {
    name: 'Onboarding Setup',
    href: '/client-portal/onboarding-setup',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: 'Complete your baseline data'
  },
  {
    name: 'Measurements',
    href: '/client-portal/measurements',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
      </svg>
    ),
    description: 'Track weight and measurements'
  }
];

export default function ClientNavigation() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const { userProfile, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === '/client-portal') {
      return pathname === '/client-portal';
    }
    return pathname.startsWith(href);
  };

  // Fetch client ID
  useEffect(() => {
    const fetchClientId = async () => {
      if (userProfile?.email) {
        try {
          const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}`);
          const result = await response.json();
          if (result.success && result.data.client) {
            setClientId(result.data.client.id);
          }
        } catch (error) {
          console.error('Error fetching client ID:', error);
        }
      }
    };
    fetchClientId();
  }, [userProfile?.email]);

  // Close menu when route changes
  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  // Handle profile image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientId', clientId);

      const response = await fetch('/api/client-portal/profile-image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        // Reload the page to refresh the profile image
        window.location.reload();
      } else {
        alert(`Failed to upload image: ${result.message}`);
      }
    } catch (error) {
      console.error('Error uploading profile image:', error);
      alert('Failed to upload profile image. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clientName = userProfile ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() : 'Client Portal';
  const initials = userProfile ? `${userProfile.firstName?.charAt(0) || ''}${userProfile.lastName?.charAt(0) || ''}`.toUpperCase() : 'CP';

  return (
    <>
      {/* Hidden file input - shared by all upload buttons */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />
      
      {/* Mobile Hamburger Button - Only visible on mobile */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#daa450]"
        aria-label="Open navigation menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile Slide-in Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 bg-white shadow-2xl h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-6" style={{ backgroundColor: '#daa450' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || !clientId}
                    className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center overflow-hidden hover:bg-opacity-30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {userProfile?.avatar ? (
                      <img src={userProfile.avatar} alt={clientName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-sm font-medium">{initials.substring(0, 2)}</span>
                    )}
                  </button>
                  <div>
                    <h1 className="text-white font-bold text-base truncate max-w-[150px]">{clientName}</h1>
                    <p className="text-white text-xs opacity-90">Wellness journey</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/20 text-white"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="px-4 py-4 flex-1 overflow-y-auto">
              <div className="space-y-2">
                {clientNavItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${
                      isActive(item.href)
                        ? 'bg-[#fef9e7] text-gray-900 shadow-sm border-l-4'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    style={isActive(item.href) ? { borderLeftColor: '#daa450' } : {}}
                  >
                    <div className={`w-8 h-8 rounded-2xl flex items-center justify-center ${
                      isActive(item.href)
                        ? ''
                        : 'bg-gray-100'
                    }`}
                    style={isActive(item.href) ? { backgroundColor: '#daa450' } : {}}
                    >
                      <div className={isActive(item.href) ? 'text-white' : 'text-gray-600'}>
                        {item.icon}
                      </div>
                    </div>
                    <span>{item.name}</span>
                  </Link>
                ))}
                <Link
                  href="/notifications"
                  onClick={handleLinkClick}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${
                    pathname === '/notifications'
                      ? 'bg-[#fef9e7] text-gray-900 shadow-sm border-l-4'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  style={pathname === '/notifications' ? { borderLeftColor: '#daa450' } : {}}
                >
                  <div className={`w-8 h-8 rounded-2xl flex items-center justify-center ${
                    pathname === '/notifications'
                      ? ''
                      : 'bg-gray-100'
                  }`}
                  style={pathname === '/notifications' ? { backgroundColor: '#daa450' } : {}}
                  >
                    <svg className={`w-4 h-4 ${pathname === '/notifications' ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <span className="flex-1">Notifications</span>
                  <NotificationBadge className="ml-auto" />
                </Link>
              </div>
            </nav>

            {/* User Section */}
            <div className="px-4 py-4 border-t border-gray-100 bg-white">
              <div className="flex items-center space-x-3 mb-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !clientId}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm overflow-hidden hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  style={{ backgroundColor: userProfile?.avatar ? 'transparent' : '#daa450' }}
                  title="Click to upload profile image"
                >
                  {userProfile?.avatar ? (
                    <img src={userProfile.avatar} alt={clientName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{initials.substring(0, 2)}</span>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {userProfile?.firstName} {userProfile?.lastName}
                  </div>
                  <div className="text-xs text-gray-700">Client</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full px-4 py-2 rounded-lg hover:bg-red-50 hover:text-red-700 transition-all duration-200 text-red-600 text-sm font-medium text-center"
              >
                Logout
              </button>
            </div>
          </div>
          <button
            type="button"
            className="flex-1 bg-black/30"
            aria-label="Close navigation menu"
            onClick={() => setIsMenuOpen(false)}
          />
        </div>
      )}

      {/* Desktop Sidebar - Hidden on mobile */}
      <div className={`hidden lg:flex ${isCollapsed ? 'w-16' : 'w-64'} bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-r border-gray-100 transition-all duration-300 h-screen flex-col`}>
      {/* Sidebar Header */}
      <div className="px-6 py-8" style={{ backgroundColor: '#daa450' }}>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !clientId}
            className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center overflow-hidden hover:bg-opacity-30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            title={isCollapsed ? "Click to upload profile image" : undefined}
          >
            {userProfile?.avatar ? (
              <img src={userProfile.avatar} alt={clientName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-base font-medium">{initials.substring(0, 2)}</span>
            )}
          </button>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-white font-bold text-lg truncate">{clientName}</h1>
              <p className="text-white text-sm opacity-90">Wellness journey</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="px-4 py-6 flex-1 overflow-y-auto">
        <div className="space-y-2">
          {clientNavItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${
                isActive(item.href)
                  ? 'bg-[#fef9e7] text-gray-900 shadow-sm border-l-4'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              style={isActive(item.href) ? { borderLeftColor: '#daa450' } : {}}
              title={isCollapsed ? item.name : undefined}
            >
              <div className={`w-8 h-8 rounded-2xl flex items-center justify-center ${
                isActive(item.href)
                  ? ''
                  : 'bg-gray-100'
              }`}
              style={isActive(item.href) ? { backgroundColor: '#daa450' } : {}}
              >
                <div className={isActive(item.href) ? 'text-white' : 'text-gray-600'}>
                  {item.icon}
                </div>
              </div>
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          ))}
          <Link
            href="/notifications"
            className={`flex items-center space-x-3 px-4 py-3 rounded-2xl font-medium transition-all duration-200 ${
              pathname === '/notifications'
                ? 'bg-[#fef9e7] text-gray-900 shadow-sm border-l-4'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
            style={pathname === '/notifications' ? { borderLeftColor: '#daa450' } : {}}
          >
            <div className={`w-8 h-8 rounded-2xl flex items-center justify-center ${
              pathname === '/notifications'
                ? ''
                : 'bg-gray-100'
            }`}
            style={pathname === '/notifications' ? { backgroundColor: '#daa450' } : {}}
            >
              <svg className={`w-4 h-4 ${pathname === '/notifications' ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            {!isCollapsed && (
              <>
                <span className="flex-1">Notifications</span>
                <NotificationBadge className="ml-auto" />
              </>
            )}
          </Link>
        </div>
      </nav>

      {/* User Section */}
      <div className="px-4 py-4 border-t border-gray-100 bg-white">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !clientId}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 shadow-sm overflow-hidden hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: userProfile?.avatar ? 'transparent' : '#daa450' }}
                title="Click to upload profile image"
              >
                {userProfile?.avatar ? (
                  <img src={userProfile.avatar} alt={clientName} className="w-full h-full object-cover" />
                ) : (
                  <span>{initials.substring(0, 2)}</span>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {userProfile?.firstName} {userProfile?.lastName}
                </div>
                <div className="text-xs text-gray-700">Client</div>
              </div>
            </div>
          )}
          {isCollapsed && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !clientId}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium mx-auto shadow-sm overflow-hidden hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: userProfile?.avatar ? 'transparent' : '#daa450' }}
              title="Click to upload profile image"
            >
              {userProfile?.avatar ? (
                <img src={userProfile.avatar} alt={clientName} className="w-full h-full object-cover" />
              ) : (
                <span>{initials.substring(0, 2)}</span>
              )}
            </button>
          )}
          <button
            onClick={logout}
            className={`p-2 rounded-lg hover:bg-red-50 hover:text-red-700 transition-all duration-200 ${
              isCollapsed ? 'w-full flex justify-center mt-2' : ''
            }`}
            title={isCollapsed ? 'Logout' : undefined}
          >
            {isCollapsed ? (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            ) : (
              <span className="text-red-600 text-sm font-medium">Logout</span>
            )}
          </button>
        </div>
      </div>
      </div>
    </>
  );
} 