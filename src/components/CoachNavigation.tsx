'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  description: string;
}

const coachNavItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: '📊',
    description: 'Overview of your business'
  },
  {
    name: 'My Clients',
    href: '/clients',
    icon: '👥',
    description: 'Manage client profiles'
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: '📈',
    description: 'View progress reports'
  },
  {
    name: 'Forms & Check-ins',
    href: '/forms',
    icon: '📝',
    description: 'Create and manage forms'
  },
  {
    name: 'Questions Library',
    href: '/questions/library',
    icon: '❓',
    description: 'Manage question templates'
  },
  {
    name: 'Check-ins',
    href: '/check-ins',
    icon: '✅',
    description: 'Send and track check-ins'
  },
  {
    name: 'Responses',
    href: '/responses',
    icon: '📋',
    description: 'View client responses'
  },
  {
    name: 'Audit',
    href: '/audit',
    icon: '🔍',
    description: 'System audit logs'
  }
];

export default function CoachNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

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
        ${isCollapsed ? 'w-16 lg:w-16' : 'w-80 lg:w-64'}
        bg-white border-r border-gray-200
        transform transition-all duration-300 ease-in-out
        overflow-y-auto
      `}>
        <div className="p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {!isCollapsed && (
                <>
                  <h2 className="text-xl font-bold text-gray-900">Coach Portal</h2>
                  <button
                    onClick={() => setIsCollapsed(true)}
                    className="lg:block hidden text-gray-400 hover:text-gray-600"
                  >
                    <span className="text-xl">◀</span>
                  </button>
                </>
              )}
              {isCollapsed && (
                <button
                  onClick={() => setIsCollapsed(false)}
                  className="lg:block hidden text-gray-400 hover:text-gray-600 mx-auto"
                >
                  <span className="text-xl">▶</span>
                </button>
              )}
            </div>
            {!isCollapsed && (
              <p className="text-sm text-gray-600">Manage your coaching business</p>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="space-y-2">
            {coachNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center p-3 rounded-lg transition-colors
                  ${isActive(item.href)
                    ? 'bg-blue-50 border border-blue-200 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
                title={isCollapsed ? item.name : undefined}
              >
                <span className="text-xl mr-3">{item.icon}</span>
                {!isCollapsed && (
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                )}
                {!isCollapsed && isActive(item.href) && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                )}
              </Link>
            ))}
          </nav>

          {/* Quick Actions */}
          {!isCollapsed && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href="/clients/new"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center p-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <span className="mr-2">➕</span>
                  Add New Client
                </Link>
                <Link
                  href="/forms/create"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center p-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <span className="mr-2">📝</span>
                  Create New Form
                </Link>
                <Link
                  href="/questions/create"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center p-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <span className="mr-2">❓</span>
                  Add New Question
                </Link>
              </div>
            </div>
          )}

          {/* Close button for mobile */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <span className="text-xl">✕</span>
          </button>
        </div>
      </div>
    </div>
  );
} 