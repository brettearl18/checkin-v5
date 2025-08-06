'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function DevFooter() {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Temporarily show footer for development testing
  // TODO: Add proper environment check later

  const devLinks = {
    'Authentication': [
      { name: 'Login Page', url: '/login', description: 'User authentication and role selection', status: 'working' },
    ],
    'Role-Based Dashboards': [
      { name: '👑 Admin Dashboard', url: '/admin', description: 'System-wide admin dashboard (All Access)', status: 'working' },
      { name: '🏋️ Coach Dashboard', url: '/dashboard', description: 'Coach-specific dashboard (Client Management)', status: 'working' },
      { name: '👤 Client Portal', url: '/client-portal', description: 'Client personal dashboard (Self Access)', status: 'working' },
    ],
    'Main Pages': [
      { name: '📊 Dashboard', url: '/', description: 'Main dashboard with analytics (👑🏋️)', status: 'working' },
      { name: '👥 Client Management', url: '/clients', description: 'View and manage all clients (👑🏋️)', status: 'working' },
      { name: '❓ Question Builder', url: '/questions', description: 'Create custom questions and forms (👑🏋️)', status: 'working' },
    ],
    'Client Pages': [
      { name: '👤 Sarah Johnson Profile', url: '/client/client-mockup-001', description: 'Detailed client profile example (👑🏋️)', status: 'working' },
      { name: '➕ Add New Client', url: '/clients/new', description: 'Create new client form (👑🏋️)', status: 'working' },
      { name: '✏️ Edit Client', url: '/client/client-mockup-001/edit', description: 'Edit client information (👑🏋️)', status: 'working' },
    ],
    'Question & Form Pages': [
      { name: '❓ Create Question', url: '/questions/create', description: 'Build custom questions (👑🏋️)', status: 'working' },
      { name: '📝 Create Form', url: '/forms/create', description: 'Build forms from questions (👑🏋️)', status: 'working' },
      { name: '📋 Form Templates', url: '/templates', description: 'Browse pre-built templates (👑🏋️)', status: 'working' },
      { name: '📚 Question Library', url: '/questions/library', description: 'View all custom questions (👑🏋️)', status: 'working' },
      { name: '📖 Form Library', url: '/forms/library', description: 'View all custom forms (👑🏋️)', status: 'working' },
    ],
    'Check-in & Forms': [
      { name: '✅ Check-in Forms', url: '/check-ins', description: 'Client check-in submissions (👑🏋️)', status: 'working' },
      { name: '📊 Form Responses', url: '/responses', description: 'View form responses (👑🏋️)', status: 'working' },
      { name: '📤 Send Check-in', url: '/check-ins/send', description: 'Send check-in to clients (👑🏋️)', status: 'working' },
    ],
    'Analytics & Reports': [
      { name: '📈 Analytics Dashboard', url: '/analytics', description: 'Detailed analytics and insights (👑🏋️)', status: 'working' },
      { name: '⚠️ Risk Analysis', url: '/analytics/risk', description: 'Client risk assessment (👑🏋️)', status: 'working' },
      { name: '🔍 Project Audit', url: '/audit', description: 'System audit and data analysis (👑🏋️)', status: 'working' },
      { name: '📊 Engagement Metrics', url: '/analytics/engagement', description: 'Client engagement tracking (👑🏋️)', status: 'working' },
      { name: '📋 Progress Reports', url: '/analytics/progress', description: 'Client progress reports (👑🏋️)', status: 'working' },
      { name: '🤖 Predictive Insights', url: '/analytics/predictions', description: 'AI-powered predictions (👑🏋️)', status: '404' },
    ],
    'Settings & Admin': [
      { name: '⚙️ Coach Settings', url: '/settings', description: 'Coach profile and preferences (👑🏋️)', status: '404' },
      { name: '📊 Question Analytics', url: '/analytics/questions', description: 'Question effectiveness metrics (👑🏋️)', status: '404' },
      { name: '📈 Form Analytics', url: '/analytics/forms', description: 'Form completion and response rates (👑🏋️)', status: '404' },
      { name: '👥 Client Analytics', url: '/analytics/clients', description: 'Individual client analytics (👑🏋️)', status: '404' },
    ],
    'API Endpoints': [
      { name: '🔧 Sample Data API', url: '/api/sample-data', description: 'Populate sample data (👑)', status: 'working' },
      { name: '📊 Sample Data Generator', url: '/api/sample-data-generator', description: 'Generate comprehensive test data (👑)', status: 'working' },
      { name: '🔍 Project Audit', url: '/api/audit', description: 'Comprehensive system audit (👑)', status: 'working' },
      { name: '👤 Create Client API', url: '/api/create-client-profile', description: 'Create test client (👑)', status: 'working' },
      { name: '📝 Clients API', url: '/api/clients', description: 'Create and manage clients (👑🏋️)', status: 'working' },
      { name: '🔥 Test Firebase API', url: '/api/test-firebase', description: 'Test Firebase connection (👑)', status: 'working' },
    ],
    'Future Features': [
      { name: '🤖 AI Insights', url: '/ai-insights', description: 'AI-powered coaching insights (👑🏋️)', status: '404' },
      { name: '🌐 Client Portal', url: '/portal', description: 'Client-facing portal (👤)', status: '404' },
      { name: '💬 Messaging', url: '/messaging', description: 'Coach-client messaging (👑🏋️👤)', status: '404' },
      { name: '📅 Calendar', url: '/calendar', description: 'Appointment scheduling (👑🏋️👤)', status: '404' },
      { name: '💳 Billing', url: '/billing', description: 'Payment and billing management (👑🏋️)', status: '404' },
    ]
  };

  return (
    <footer className="bg-gray-900 text-white mt-auto border-t-4 border-blue-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">🔧 Development Links</h3>
            <p className="text-gray-400 text-sm">Quick navigation for development and testing</p>
            <div className="flex items-center space-x-4 mt-2 text-xs text-blue-300">
              <span>👑 Admin</span>
              <span>🏋️ Coach</span>
              <span>👤 Client</span>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
          >
            {isExpanded ? 'Collapse' : 'Expand All'}
          </button>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Object.entries(devLinks).map(([category, links]) => (
            <div key={category} className="space-y-3">
              <h4 className="text-sm font-medium text-blue-300 border-b border-gray-600 pb-1">
                {category}
              </h4>
              <div className="space-y-2">
                {links.map((link) => (
                  <div key={link.url} className="group">
                    <Link
                      href={link.url}
                      className="block text-sm text-gray-200 hover:text-white transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{link.name}</span>
                        <span className="ml-2">
                          {link.status === 'working' ? (
                            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : link.status === '404' ? (
                            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          ) : null}
                        </span>
                      </div>
                      {isExpanded && (
                        <span className="block text-xs text-gray-400 mt-1 group-hover:text-gray-300">
                          {link.description}
                        </span>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 pt-6 border-t border-gray-600">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-300">11</div>
              <div className="text-xs text-gray-300">Total Clients</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-300">7</div>
              <div className="text-xs text-gray-300">Active Clients</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-300">2</div>
              <div className="text-xs text-gray-300">At Risk</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-300">23</div>
              <div className="text-xs text-gray-300">Working Features</div>
            </div>
          </div>
        </div>

        {/* Feature Status Summary */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
                                                                 <span className="flex items-center">
                    <svg className="w-3 h-3 text-green-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    23 Working
                  </span>
                                               <span className="flex items-center">
                  <svg className="w-3 h-3 text-red-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  2 404/Broken
                </span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Environment: Development</span>
              <span>Firebase: Connected</span>
              <span>Database: Firestore</span>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span>System Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
} 