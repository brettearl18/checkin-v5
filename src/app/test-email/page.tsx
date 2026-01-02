'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import CoachNavigation from '@/components/CoachNavigation';

export default function TestEmailPage() {
  const { userProfile } = useAuth();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; recipient?: string; timestamp?: string } | null>(null);

  const handleSendTestEmail = async () => {
    if (!window.confirm('Send a test email to brett.earl@gmail.com?')) {
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: 'brett.earl@gmail.com',
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error sending test email:', error);
      setResult({
        success: false,
        message: 'Failed to send test email. Please check the console for details.',
      });
    } finally {
      setSending(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <CoachNavigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-8 py-6 border-b-2 border-teal-700">
            <h1 className="text-3xl font-bold text-white">Test Email Service</h1>
            <p className="text-teal-100 mt-2">Send a test email to verify Mailgun configuration</p>
          </div>

          <div className="p-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">Email Configuration</h2>
              <div className="space-y-2 text-sm text-blue-800">
                <p><strong>Recipient:</strong> brett.earl@gmail.com</p>
                <p><strong>From Name:</strong> Coach Silvi</p>
                <p><strong>Domain:</strong> {process.env.NEXT_PUBLIC_MAILGUN_DOMAIN || 'mg.vanahealth.com.au'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={handleSendTestEmail}
                disabled={sending}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  sending
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                }`}
              >
                {sending ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send Test Email
                  </span>
                )}
              </button>
            </div>

            {result && (
              <div
                className={`rounded-lg p-6 border-2 ${
                  result.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start">
                  {result.success ? (
                    <svg className="w-6 h-6 text-green-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-red-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg mb-2 ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                      {result.success ? 'Email Sent Successfully!' : 'Failed to Send Email'}
                    </h3>
                    <p className={result.success ? 'text-green-800' : 'text-red-800'}>{result.message}</p>
                    {result.success && result.recipient && (
                      <div className="mt-3 text-sm text-green-700">
                        <p><strong>Recipient:</strong> {result.recipient}</p>
                        {result.timestamp && (
                          <p><strong>Sent at:</strong> {new Date(result.timestamp).toLocaleString()}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What to Check</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Check your inbox (and spam folder) at brett.earl@gmail.com
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Verify the email appears to come from "Coach Silvi"
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Check the Mailgun dashboard for delivery status
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-gray-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Review the email formatting and styling
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



