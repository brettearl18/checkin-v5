'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PlatformUpdate {
  id: string;
  date: string;
  category: 'bug-fix' | 'new-feature' | 'maintenance' | 'downtime' | 'security' | 'performance';
  title: string;
  description: string;
  details?: string;
  status: 'completed' | 'in-progress' | 'planned';
  impact?: 'low' | 'medium' | 'high' | 'critical';
}

const categoryConfig = {
  'bug-fix': { label: 'Bug Fix', icon: '🐛', color: 'bg-red-100 text-red-800 border-red-200' },
  'new-feature': { label: 'New Feature', icon: '✨', color: 'bg-green-100 text-green-800 border-green-200' },
  'maintenance': { label: 'Maintenance', icon: '🔧', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'downtime': { label: 'Downtime', icon: '⚠️', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'security': { label: 'Security', icon: '🔒', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'performance': { label: 'Performance', icon: '⚡', color: 'bg-orange-100 text-orange-800 border-orange-200' },
};

const statusConfig = {
  'completed': { label: 'Completed', color: 'bg-green-100 text-green-800' },
  'in-progress': { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  'planned': { label: 'Planned', color: 'bg-blue-100 text-blue-800' },
};

export default function PlatformUpdates() {
  const [updates, setUpdates] = useState<PlatformUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/client-portal/platform-updates', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch updates: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setUpdates(data.updates || []);
      } else {
        throw new Error(data.message || 'Failed to load updates');
      }
    } catch (err: any) {
      console.error('Error fetching updates:', err);
      setError(err.message || 'Failed to load platform updates. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUpdates = selectedCategory === 'all'
    ? updates
    : updates.filter(update => update.category === selectedCategory);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="p-3 sm:p-4 lg:p-8">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-2">Platform Updates & Changes</h2>
        <p className="text-gray-600 text-xs sm:text-sm lg:text-base">
          Stay informed about improvements, bug fixes, and maintenance to the platform
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 flex flex-wrap gap-2 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
            selectedCategory === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Updates
        </button>
        {Object.entries(categoryConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
              selectedCategory === key
                ? `${config.color.split(' ')[0]} ${config.color.split(' ')[1]} border-2 ${config.color.split(' ')[2]}`
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {config.icon} {config.label}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading updates...</p>
        </div>
      )}

      {/* Updates List */}
      {!loading && filteredUpdates.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-600">No updates found.</p>
          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="mt-4 text-blue-600 hover:text-blue-800 underline"
            >
              View all updates
            </button>
          )}
        </div>
      )}

      {!loading && filteredUpdates.length > 0 && (
        <div className="space-y-4">
          {filteredUpdates.map((update) => {
            const category = categoryConfig[update.category];
            const status = statusConfig[update.status];
            
            return (
              <div
                key={update.id}
                className="bg-white border-2 border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xl sm:text-2xl flex-shrink-0">{category.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold border ${category.color}`}>
                          {category.label}
                        </span>
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold ${status.color}`}>
                          {status.label}
                        </span>
                        {update.impact && (
                          <span className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-gray-100 text-gray-700">
                            Impact: {update.impact}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap flex-shrink-0">
                    {formatDate(update.date)}
                  </span>
                </div>

                <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-2 break-words">{update.title}</h3>
                <p className="text-xs sm:text-sm text-gray-700 mb-3 whitespace-pre-wrap break-words overflow-wrap-anywhere">{update.description}</p>
                
                {update.details && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium text-xs sm:text-sm">
                      Read more details
                    </summary>
                    <div className="mt-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words overflow-wrap-anywhere">{update.details}</p>
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Link to Report Issue */}
      <div className="mt-6 sm:mt-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6">
        <p className="text-sm sm:text-base text-gray-700 mb-3">
          <strong>Found an issue or have feedback?</strong>
        </p>
        <button
          onClick={() => {
            const event = new CustomEvent('switchTab', { detail: 'report' });
            window.dispatchEvent(event);
          }}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-xs sm:text-sm cursor-pointer"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Submit an Issue
        </button>
      </div>
    </div>
  );
}

