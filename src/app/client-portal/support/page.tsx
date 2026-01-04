'use client';

import { useState, useEffect } from 'react';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// Import components from existing pages
import SubmitIssueForm from './components/SubmitIssueForm';
import PlatformUpdates from './components/PlatformUpdates';
import HelpGuides from './components/HelpGuides';
import FAQ from './components/FAQ';

type TabType = 'help' | 'faq' | 'report' | 'updates';

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState<TabType>('help');

  const tabs = [
    { id: 'help' as TabType, label: 'Help & How-To', icon: '📚' },
    { id: 'faq' as TabType, label: 'FAQ', icon: '❓' },
    { id: 'report' as TabType, label: 'Report Issue', icon: '🐛' },
    { id: 'updates' as TabType, label: 'Updates', icon: '📋' },
  ];

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-white flex flex-col lg:flex-row">
        <ClientNavigation />
        <div className="flex-1 w-full lg:ml-8 px-3 sm:px-4 lg:p-6 pt-20 lg:pt-6 overflow-x-hidden">
          <div className="max-w-5xl mx-auto w-full">
            {/* Header */}
            <div className="mb-4 sm:mb-6 lg:mb-8">
              <div className="px-3 sm:px-4 py-4 sm:py-5 lg:px-8 lg:py-6 border-b-2 mb-4 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Support & Help Center</h1>
                <p className="text-gray-600 text-xs sm:text-sm lg:text-base">
                  Find answers, report issues, and stay informed about platform updates
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto -mx-3 sm:-mx-4 lg:mx-0 px-3 sm:px-4 lg:px-0">
              <nav className="-mb-px flex space-x-2 sm:space-x-4 lg:space-x-8 min-w-max">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm lg:text-base transition-colors ${
                      activeTab === tab.id
                        ? 'border-yellow-500 text-yellow-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="mr-1 sm:mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-xl border border-gray-100 overflow-hidden mb-6">
              {activeTab === 'help' && <HelpGuides />}
              {activeTab === 'faq' && <FAQ />}
              {activeTab === 'report' && <SubmitIssueForm />}
              {activeTab === 'updates' && <PlatformUpdates />}
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

