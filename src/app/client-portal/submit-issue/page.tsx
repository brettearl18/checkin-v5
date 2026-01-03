'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import { useRouter } from 'next/navigation';

export default function SubmitIssuePage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    issueType: 'bug',
    title: '',
    description: '',
    stepsToReproduce: '',
    consoleErrors: '',
    pageUrl: '',
  });
  const [browserInfo, setBrowserInfo] = useState({
    userAgent: '',
    screenResolution: '',
    timezone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Auto-populate browser info and current URL
    if (typeof window !== 'undefined') {
      setFormData(prev => ({
        ...prev,
        pageUrl: window.location.href,
      }));

      setBrowserInfo({
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!formData.title.trim() || !formData.description.trim()) {
        setError('Please fill in all required fields');
        setSubmitting(false);
        return;
      }

      // Get Firebase ID token for authentication
      let idToken: string | null = null;
      if (typeof window !== 'undefined' && userProfile?.uid) {
        try {
          const { auth } = await import('@/lib/firebase-client');
          if (auth?.currentUser) {
            idToken = await auth.currentUser.getIdToken();
          }
        } catch (authError) {
          console.warn('Could not get auth token:', authError);
        }
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/client-portal/submit-issue', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...formData,
          browserInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit issue report');
      }

      setSuccess(true);
      // Reset form
      setFormData({
        issueType: 'bug',
        title: '',
        description: '',
        stepsToReproduce: '',
        consoleErrors: '',
        pageUrl: window.location.href,
      });

      // Redirect after 3 seconds
      setTimeout(() => {
        router.push('/client-portal');
      }, 3000);
    } catch (err: any) {
      console.error('Error submitting issue:', err);
      setError(err.message || 'Failed to submit issue report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-white flex">
          <ClientNavigation />
          <div className="flex-1 ml-4 lg:ml-8 p-5 lg:p-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 lg:p-12 text-center">
                <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 lg:w-10 lg:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Issue Report Submitted!</h2>
                <p className="text-gray-600 text-base lg:text-lg mb-6">
                  Thank you for reporting this issue. We've received your report and will look into it as soon as possible.
                </p>
                <p className="text-sm text-gray-500">
                  Redirecting you to your dashboard...
                </p>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-white flex">
        <ClientNavigation />
        <div className="flex-1 ml-4 lg:ml-8 p-5 lg:p-6">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="mb-6 lg:mb-8">
              <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2 mb-4 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Submit an Issue</h1>
                <p className="text-gray-600 text-sm lg:text-base">
                  Found a bug or having trouble? Let us know and we'll fix it as soon as possible.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl lg:rounded-3xl shadow-xl border border-gray-100 p-6 lg:p-8">
              {error && (
                <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Issue Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issue Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.issueType}
                  onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
                  className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white focus:ring-2 focus:outline-none transition-all text-sm lg:text-base min-h-[48px] lg:min-h-[44px]"
                  style={{ focusRingColor: '#daa450' }}
                  onFocus={(e) => e.target.style.borderColor = '#daa450'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  required
                >
                  <option value="bug">Bug/Error</option>
                  <option value="feature">Feature Request</option>
                  <option value="performance">Performance Issue</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Brief description of the issue"
                  className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white focus:ring-2 focus:outline-none transition-all text-sm lg:text-base min-h-[48px] lg:min-h-[44px]"
                  style={{ focusRingColor: '#daa450' }}
                  onFocus={(e) => e.target.style.borderColor = '#daa450'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  required
                  maxLength={200}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.title.length}/200 characters</p>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what happened, what you were trying to do, and what you expected vs. what actually happened"
                  rows={6}
                  className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white focus:ring-2 focus:outline-none transition-all text-sm lg:text-base resize-y"
                  style={{ focusRingColor: '#daa450' }}
                  onFocus={(e) => e.target.style.borderColor = '#daa450'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  required
                />
              </div>

              {/* Steps to Reproduce */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Steps to Reproduce (Optional)
                </label>
                <textarea
                  value={formData.stepsToReproduce}
                  onChange={(e) => setFormData({ ...formData, stepsToReproduce: e.target.value })}
                  placeholder="1. First step&#10;2. Second step&#10;3. Third step"
                  rows={4}
                  className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white focus:ring-2 focus:outline-none transition-all text-sm lg:text-base resize-y"
                  style={{ focusRingColor: '#daa450' }}
                  onFocus={(e) => e.target.style.borderColor = '#daa450'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <p className="text-xs text-gray-500 mt-1">Help us reproduce the issue by listing the steps you took</p>
              </div>

              {/* Console Errors */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Browser Console Errors (Optional)
                </label>
                <div className="mb-2">
                  <details className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                    <summary className="text-sm font-medium text-blue-900 cursor-pointer">
                      How to access Browser Console
                    </summary>
                    <div className="mt-3 text-xs text-blue-800 space-y-2">
                      <p><strong>Chrome/Edge:</strong> Press F12 or Right-click → Inspect, then click "Console" tab</p>
                      <p><strong>Safari:</strong> Enable Developer menu (Safari → Preferences → Advanced → Show Develop menu), then press Cmd+Option+C</p>
                      <p><strong>Firefox:</strong> Press F12, then click "Console" tab</p>
                      <p className="mt-2">Look for red error messages, right-click and copy them, then paste below.</p>
                    </div>
                  </details>
                </div>
                <textarea
                  value={formData.consoleErrors}
                  onChange={(e) => setFormData({ ...formData, consoleErrors: e.target.value })}
                  placeholder="Paste console errors here if any..."
                  rows={4}
                  className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white focus:ring-2 focus:outline-none transition-all text-sm lg:text-base font-mono resize-y"
                  style={{ focusRingColor: '#daa450' }}
                  onFocus={(e) => e.target.style.borderColor = '#daa450'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              {/* Page URL */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Page URL
                </label>
                <input
                  type="text"
                  value={formData.pageUrl}
                  onChange={(e) => setFormData({ ...formData, pageUrl: e.target.value })}
                  className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-gray-50 text-sm lg:text-base min-h-[48px] lg:min-h-[44px]"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">Auto-populated with current page URL</p>
              </div>

              {/* Browser Info (Hidden but will be sent) */}
              <div className="mb-6 text-xs text-gray-500">
                <p>Your browser information will be automatically included in the report.</p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors font-semibold text-sm lg:text-base min-h-[48px] lg:min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 lg:py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base min-h-[48px] lg:min-h-[44px]"
                  style={{ backgroundColor: '#daa450' }}
                  onMouseEnter={(e) => {
                    if (!submitting) {
                      e.currentTarget.style.backgroundColor = '#c89540';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!submitting) {
                      e.currentTarget.style.backgroundColor = '#daa450';
                    }
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Issue Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

