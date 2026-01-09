'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import CoachNavigation from '@/components/CoachNavigation';

export default function BulkUpdateCheckInWindowPage() {
  const { userProfile } = useAuth();
  const [formTitle, setFormTitle] = useState('Vana Health 2026 Check In');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    updatedCount?: number;
    errorCount?: number;
  } | null>(null);

  const handleUpdate = async () => {
    if (!formTitle.trim()) {
      alert('Please enter a form title');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/bulk-update-checkin-window', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formTitle: formTitle.trim(),
          checkInWindow: {
            enabled: true,
            startDay: 'friday',
            startTime: '09:00',
            endDay: 'tuesday',
            endTime: '12:00'
          }
        }),
      });

      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        alert(`Success! ${data.message}`);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error updating check-in window:', error);
      setResult({
        success: false,
        message: 'Failed to update check-in window. Please try again.'
      });
      alert('Error updating check-in window. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleProtected allowedRoles={['admin', 'coach']}>
      <div className="min-h-screen bg-gray-50">
        <CoachNavigation />
        
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bulk Update Check-In Window
            </h1>
            <p className="text-gray-600 mb-8">
              Update the check-in window for all clients using a specific form.
            </p>

            <div className="space-y-6">
              {/* Form Title Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Form Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Vana Health 2026 Check In"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter the exact form title to update all check-in assignments
                </p>
              </div>

              {/* New Window Settings Display */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  New Check-In Window Settings
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Start Day & Time</div>
                    <div className="text-lg font-medium text-gray-900">
                      Friday 9:00 AM
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">End Day & Time</div>
                    <div className="text-lg font-medium text-gray-900">
                      Tuesday 12:00 PM
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white rounded-lg border border-amber-200">
                  <div className="text-sm text-gray-700">
                    <strong>Note:</strong> This will update <strong>all</strong> check-in assignments 
                    for the specified form. The window will be set to Friday 9:00 AM to Tuesday 12:00 PM.
                  </div>
                </div>
              </div>

              {/* Result Display */}
              {result && (
                <div className={`p-4 rounded-xl ${
                  result.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className={`font-semibold ${
                    result.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {result.success ? '✓ Success' : '✗ Error'}
                  </div>
                  <div className={`mt-1 ${
                    result.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {result.message}
                  </div>
                  {result.updatedCount !== undefined && (
                    <div className="mt-2 text-sm text-gray-600">
                      Updated: {result.updatedCount} assignment(s)
                      {result.errorCount && result.errorCount > 0 && (
                        <span className="text-red-600 ml-4">
                          Errors: {result.errorCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleUpdate}
                disabled={loading || !formTitle.trim()}
                className="w-full px-6 py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-md hover:shadow-lg"
              >
                {loading ? 'Updating...' : 'Update All Check-In Windows'}
              </button>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-600 text-xl">⚠️</span>
                  <div className="text-sm text-yellow-800">
                    <strong>Warning:</strong> This action will update the check-in window for 
                    <strong> all clients</strong> using this form. This cannot be easily undone. 
                    Please verify the form title before proceeding.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

