'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';

export default function UpdateVanaFormPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/set-vana-form-questions-final', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formId: 'form-1765694942359-sk9mu6mmr'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update form');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleProtected allowedRoles={['coach', 'admin']}>
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow-xl rounded-2xl p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Update Vana Health 2026 Check In Form
            </h1>
            
            <p className="text-gray-600 mb-6">
              This will update the form to ensure all 28 questions are present, properly ordered,
              and textarea questions have weight 0.
            </p>

            <div className="mb-6">
              <button
                onClick={handleUpdate}
                disabled={loading}
                className={`w-full py-3 px-6 rounded-lg text-white font-semibold transition-all ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {loading ? 'Updating...' : 'Update Form'}
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-red-800 font-semibold mb-2">Error</h3>
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {result && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-green-800 font-semibold mb-2">Success!</h3>
                <div className="text-green-700 space-y-2">
                  <p><strong>Message:</strong> {result.message}</p>
                  <p><strong>Total Questions:</strong> {result.totalQuestions}</p>
                  <p><strong>First Question:</strong> {result.firstQuestion?.text}</p>
                  {result.created > 0 && (
                    <p><strong>Created:</strong> {result.created} new questions</p>
                  )}
                  {result.reused > 0 && (
                    <p><strong>Reused:</strong> {result.reused} existing questions</p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">What this does:</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Ensures all 28 questions from vanaCheckInQuestions exist in the database</li>
                <li>Updates textarea questions to have weight 0</li>
                <li>Sets "Did you complete all your training sessions?" as the first question</li>
                <li>Orders all questions correctly</li>
                <li>Updates the form's questions array with all question IDs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

