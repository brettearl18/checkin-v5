'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import CoachNavigation from '@/components/CoachNavigation';

interface TestResult {
  success: boolean;
  message: string;
  results?: {
    checked: number;
    sent: number;
    skipped: number;
    errors?: string[];
  };
  timestamp?: string;
}

export default function TestScheduledEmailsPage() {
  const { userProfile } = useAuth();
  const [testEmail, setTestEmail] = useState<string>('');
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult | null }>({
    onboarding: null,
    windowOpen: null,
    dueReminder: null,
    overdue: null,
  });
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({
    onboarding: false,
    windowOpen: false,
    dueReminder: false,
    overdue: false,
  });

  const testEndpoint = async (endpoint: string, key: string) => {
    if (!window.confirm(`Send test request to ${endpoint}?`)) {
      return;
    }

    setTesting(prev => ({ ...prev, [key]: true }));
    setTestResults(prev => ({ ...prev, [key]: null }));

    try {
      const body: any = {};
      if (testEmail && testEmail.trim()) {
        body.testEmail = testEmail.trim();
        console.log(`[TEST] Sending request with test email: ${body.testEmail}`);
      }

      const response = await fetch(`/api/scheduled-emails/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      
      // Log debug info if available
      if (data.debug) {
        console.log(`[TEST DEBUG] ${key}:`, data.debug);
      }
      
      setTestResults(prev => ({
        ...prev,
        [key]: {
          ...data,
          timestamp: new Date().toISOString(),
        },
      }));
    } catch (error) {
      console.error(`Error testing ${endpoint}:`, error);
      setTestResults(prev => ({
        ...prev,
        [key]: {
          success: false,
          message: `Failed to test ${endpoint}. Please check the console for details.`,
          timestamp: new Date().toISOString(),
        },
      }));
    } finally {
      setTesting(prev => ({ ...prev, [key]: false }));
    }
  };

  // Only allow coaches/admins to access this page
  if (!userProfile || (userProfile.role !== 'coach' && userProfile.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You must be a coach or admin to access this page.</p>
        </div>
      </div>
    );
  }

  const emailTests = [
    {
      key: 'onboarding',
      title: 'Onboarding Reminders',
      description: 'Sends reminder emails to clients who haven\'t completed onboarding 24 hours after signup',
      endpoint: 'onboarding-reminders',
      schedule: 'Daily at 9:00 AM Perth time',
      color: 'from-orange-600 to-amber-600',
    },
    {
      key: 'windowOpen',
      title: 'Check-In Window Open',
      description: 'Notifies clients when their check-in window opens',
      endpoint: 'check-in-window-open',
      schedule: 'Every hour',
      color: 'from-green-600 to-emerald-600',
    },
    {
      key: 'dueReminder',
      title: 'Check-In Due Reminders',
      description: 'Reminds clients 24 hours before check-in is due',
      endpoint: 'check-in-due-reminders',
      schedule: 'Every hour',
      color: 'from-blue-600 to-cyan-600',
    },
    {
      key: 'overdue',
      title: 'Check-In Overdue Reminders',
      description: 'Reminds clients 1 day after check-in becomes overdue',
      endpoint: 'check-in-overdue',
      schedule: 'Daily at 10:00 AM Perth time',
      color: 'from-red-600 to-rose-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <CoachNavigation />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-8 py-6 border-b-2 border-teal-700">
            <h1 className="text-3xl font-bold text-white">Test Scheduled Emails</h1>
            <p className="text-teal-100 mt-2">Test each scheduled email endpoint manually</p>
          </div>

          <div className="p-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">About These Tests</h2>
              <p className="text-sm text-blue-800 mb-2">
                Each button will trigger the scheduled email endpoint, which will:
              </p>
              <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                <li>Find eligible clients/check-ins based on the email type</li>
                <li>Send emails to those who meet the criteria</li>
                <li>Return a summary of how many emails were sent, skipped, or had errors</li>
              </ul>
              <p className="text-sm text-blue-800 mt-3">
                <strong>Note:</strong> These endpoints respect the same logic as the scheduled jobs (e.g., only sends to clients who completed onboarding, prevents duplicate emails, etc.)
              </p>
            </div>

            {/* Test Email Override */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-yellow-900 mb-3">Test Email Override</h2>
              <p className="text-sm text-yellow-800 mb-4">
                Enter an email address below to override all recipient emails during testing. This is useful when your client emails in the database are test/fake addresses.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label htmlFor="test-email" className="block text-sm font-medium text-yellow-900 mb-2">
                    Test Email Address (optional)
                  </label>
                  <input
                    id="test-email"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="brett.earl@gmail.com"
                    className="w-full px-4 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-gray-900"
                  />
                </div>
              </div>
              {testEmail && (
                <p className="text-sm text-yellow-700 mt-3">
                  <strong>Active:</strong> All test emails will be sent to <strong>{testEmail}</strong> instead of the client emails in the database.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {emailTests.map((test) => {
                const isTesting = testing[test.key];
                const result = testResults[test.key];

                return (
                  <div
                    key={test.key}
                    className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className={`text-xl font-bold bg-gradient-to-r ${test.color} bg-clip-text text-transparent mb-2`}>
                          {test.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">{test.description}</p>
                        <p className="text-xs text-gray-500">
                          <strong>Schedule:</strong> {test.schedule}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => testEndpoint(test.endpoint, test.key)}
                      disabled={isTesting}
                      className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                        isTesting
                          ? 'bg-gray-400 cursor-not-allowed text-white'
                          : `bg-gradient-to-r ${test.color} hover:opacity-90 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5`
                      }`}
                    >
                      {isTesting ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Testing...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Test Now
                        </span>
                      )}
                    </button>

                            {result && (
                      <div
                        className={`mt-4 rounded-lg p-4 border-2 ${
                          result.success
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start">
                          {result.success ? (
                            <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          <div className="flex-1">
                            <p className={`font-semibold ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                              {result.success ? 'Test Completed' : 'Test Failed'}
                            </p>
                            <p className={`text-sm mt-1 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                              {result.message}
                            </p>
                            {result.debug && (
                              <p className={`text-xs mt-2 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                                <strong>Debug:</strong> Test mode: {result.debug.testModeActive ? 'Active' : 'Inactive'}, 
                                Test email: {result.debug.testEmailUsed || 'None'}
                              </p>
                            )}
                            {result.results && (
                              <div className="mt-3 text-xs space-y-1">
                                <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                                  <strong>Checked:</strong> {result.results.checked} |{' '}
                                  <strong>Sent:</strong> {result.results.sent} |{' '}
                                  <strong>Skipped:</strong> {result.results.skipped}
                                </p>
                                {result.results.errors && result.results.errors.length > 0 && (
                                  <div className="mt-2">
                                    <p className="font-semibold text-red-700">Errors:</p>
                                    <ul className="list-disc list-inside text-red-600">
                                      {result.results.errors.map((error, idx) => (
                                        <li key={idx}>{error}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                            {result.timestamp && (
                              <p className={`text-xs mt-2 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                                Tested at: {new Date(result.timestamp).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Understanding the Results</h3>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <strong>Checked:</strong> Total number of clients/check-ins examined
                  </div>
                </div>
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <strong>Sent:</strong> Number of emails successfully sent
                  </div>
                </div>
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <strong>Skipped:</strong> Number of clients/check-ins that didn't meet criteria (e.g., already completed, reminder already sent, onboarding not completed)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

