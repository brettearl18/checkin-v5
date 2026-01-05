'use client';

import { useState } from 'react';
import { RoleProtected } from '@/components/ProtectedRoute';

export default function TestSeedDataPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const handleClearData = async () => {
    if (!confirm('This will permanently delete ALL check-ins, responses, measurements, and AI analytics for info@vanahealth.com.au. This cannot be undone. Continue?')) {
      return;
    }

    setClearing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/clear-client-data?email=info@vanahealth.com.au', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          ...data,
          isClear: true
        });
      } else {
        setError(data.message || 'Failed to clear data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setClearing(false);
    }
  };

  const handleSeedData = async () => {
    if (!confirm('This will create 5 check-ins and measurements for info@vanahealth.com.au. Continue?')) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/seed-test-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.message || 'Failed to seed data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Seed Test Data</h1>
            <p className="text-gray-600 mb-6">
              This will create 5 completed check-ins and measurements for <strong>info@vanahealth.com.au</strong> using form <strong>form-1765694942359-sk9mu6mmr</strong>.
            </p>

            <div className="flex gap-4 mb-6">
              <button
                onClick={handleClearData}
                disabled={clearing}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                {clearing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Clearing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear All Data
                  </>
                )}
              </button>
            </div>

            <button
              onClick={handleSeedData}
              disabled={loading}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Seeding Data...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Seed Test Data
                </>
              )}
            </button>

            {error && (
              <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <h3 className="font-semibold text-red-800 mb-2">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {result && (
              <div className={`mt-6 p-6 border-2 rounded-xl ${
                result.isClear 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <h3 className={`font-semibold mb-4 ${
                  result.isClear ? 'text-red-800' : 'text-green-800'
                }`}>
                  {result.isClear ? 'Data Cleared!' : 'Success!'}
                </h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Client:</strong> {result.data?.clientName}</p>
                  
                  {result.isClear ? (
                    <>
                      <p><strong>Deleted:</strong></p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Check-ins: {result.data?.deleted?.checkIns || 0}</li>
                        <li>Form Responses: {result.data?.deleted?.responses || 0}</li>
                        <li>Measurements: {result.data?.deleted?.measurements || 0}</li>
                        <li>AI Analytics: {result.data?.deleted?.aiAnalytics || 0}</li>
                        <li>Weekly Summaries: {result.data?.deleted?.weeklySummaries || 0}</li>
                        <li>SWOT Analyses: {result.data?.deleted?.swotAnalyses || 0}</li>
                      </ul>
                    </>
                  ) : (
                    <>
                      <p><strong>Form:</strong> {result.data?.formTitle}</p>
                      <p><strong>Check-ins Created:</strong> {result.data?.seededCheckIns?.length || 0}</p>
                      
                      {result.data?.seededCheckIns && (
                        <div className="mt-4">
                          <p className="font-medium mb-2">Check-in Details:</p>
                          <div className="space-y-1">
                            {result.data.seededCheckIns.map((checkIn: any, idx: number) => (
                              <div key={idx} className="text-xs bg-white p-2 rounded border border-green-200">
                                Week {checkIn.week}: Score {checkIn.score}% - {new Date(checkIn.completedAt).toLocaleDateString()}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}


