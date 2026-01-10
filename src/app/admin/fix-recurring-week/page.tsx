'use client';

import { useState } from 'react';
import { RoleProtected } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

export default function FixRecurringWeekPage() {
  const { user } = useAuth();
  const [responseId, setResponseId] = useState('8vMCTRsb7oLMeOfpA7NP');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper to get auth token
  const getAuthToken = async (): Promise<string | null> => {
    try {
      if (typeof window !== 'undefined' && user) {
        const { auth } = await import('@/lib/firebase-client');
        if (auth?.currentUser) {
          return await auth.currentUser.getIdToken();
        }
      }
    } catch (err) {
      console.error('Error getting auth token:', err);
    }
    return null;
  };

  const checkStatus = async () => {
    if (!responseId.trim()) {
      setError('Please enter a response ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const idToken = await getAuthToken();
      const headers: HeadersInit = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/admin/fix-recurring-week?responseId=${encodeURIComponent(responseId)}`, {
        headers
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setResult(data);
        if (data.needsFix) {
          setError(null);
        } else {
          setError(null);
        }
      } else {
        setError(data.message || 'Failed to check status');
        setResult(null);
      }
    } catch (err: any) {
      setError(`Failed to check: ${err.message}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const fixResponse = async () => {
    if (!responseId.trim()) {
      setError('Please enter a response ID');
      return;
    }

    if (!confirm(`Are you sure you want to fix response ${responseId}?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const idToken = await getAuthToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/admin/fix-recurring-week', {
        method: 'POST',
        headers,
        body: JSON.stringify({ responseId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult(data);
        if (data.result?.updated) {
          setError(null);
        } else if (data.result?.skipped) {
          setError(null);
        }
      } else {
        setError(data.message || 'Failed to fix response');
        setResult(null);
      }
    } catch (err: any) {
      setError(`Failed to fix: ${err.message}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleProtected allowedRoles={['admin']}>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                🔧 Fix RecurringWeek
              </h1>
              <p className="text-gray-600">
                Admin tool to backfill missing recurringWeek in formResponses documents
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="responseId" className="block text-sm font-medium text-gray-700 mb-2">
                Response ID:
              </label>
              <input
                type="text"
                id="responseId"
                value={responseId}
                onChange={(e) => setResponseId(e.target.value)}
                placeholder="Enter response ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
            </div>

            <div className="flex gap-3 mb-6">
              <button
                onClick={checkStatus}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Checking...' : 'Check Status'}
              </button>
              <button
                onClick={fixResponse}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Fixing...' : 'Fix Response'}
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {result && (
              <div className={`mb-6 p-4 rounded-md border ${
                result.needsFix === false 
                  ? 'bg-green-50 border-green-200' 
                  : result.result?.updated 
                    ? 'bg-green-50 border-green-200'
                    : 'bg-blue-50 border-blue-200'
              }`}>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {result.needsFix === false 
                    ? '✅ Response is already correct'
                    : result.result?.updated
                      ? '✅ Successfully fixed!'
                      : 'ℹ️ Status Information'}
                </h3>
                <pre className="text-sm text-gray-700 overflow-x-auto bg-white p-3 rounded border border-gray-200">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}

            {result && result.result?.updated && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800 text-sm">
                  ✅ <strong>Fix applied successfully!</strong><br />
                  Response ID: {result.result.responseId}<br />
                  recurringWeek: {result.result.recurringWeek}<br />
                  {result.result.fromAssignment && '(Copied from assignment document)'}
                </p>
              </div>
            )}

            {result && result.needsFix === false && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-800 text-sm">
                  ✅ <strong>Response already has recurringWeek set:</strong><br />
                  Value: {result.recurringWeek}<br />
                  No fix needed.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Quick Actions:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Click "Check Status" to see if the response needs fixing</li>
              <li>Click "Fix Response" to update the recurringWeek field</li>
              <li>After fixing, click "Check Status" again to verify</li>
            </ul>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

