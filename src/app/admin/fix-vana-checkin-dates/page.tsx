'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';

interface PreviewAssignment {
  assignmentId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  currentDueDate: string | null;
  currentStartDate: string | null;
  currentFirstCheckInDate: string | null;
  newDueDate: string;
  newStartDate: string;
  newFirstCheckInDate: string;
  willUpdate: boolean;
  reason?: string;
}

export default function FixVanaCheckInDatesPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [preview, setPreview] = useState<{
    total: number;
    willUpdate: number;
    willSkip: number;
    assignments: PreviewAssignment[];
    targetDates?: {
      week1DueDate: string;
      week1StartDate: string;
      week1FirstCheckInDate: string;
    };
  } | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPreview();
  }, []);

  const fetchPreview = async () => {
    try {
      setPreviewLoading(true);
      setError('');
      const response = await fetch('/api/admin/bulk-fix-vana-checkin-dates');
      const data = await response.json();
      
      if (data.success) {
        setPreview(data.preview);
      } else {
        setError(data.message || 'Failed to fetch preview');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFix = async () => {
    if (selectedAssignments.size === 0) {
      alert('Please select at least one assignment to update. Use the checkboxes to select specific clients.');
      return;
    }
    
    if (!confirm(`Are you sure you want to update ${selectedAssignments.size} selected assignment(s)? This will set Week 1 due date to Monday January 5, 2026, and start date to December 29, 2025.`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResult(null);
      
      const response = await fetch('/api/admin/bulk-fix-vana-checkin-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selectedAssignmentIds: Array.from(selectedAssignments)
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResult(data.results);
        // Clear selection after successful update
        setSelectedAssignments(new Set());
        // Refresh preview
        await fetchPreview();
      } else {
        setError(data.message || 'Failed to update assignments');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating assignments');
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignment = (assignmentId: string) => {
    const newSelected = new Set(selectedAssignments);
    if (newSelected.has(assignmentId)) {
      newSelected.delete(assignmentId);
    } else {
      newSelected.add(assignmentId);
    }
    setSelectedAssignments(newSelected);
  };

  const toggleSelectAll = () => {
    if (!preview) return;
    
    const updateableAssignments = preview.assignments
      .filter(a => a.willUpdate)
      .map(a => a.assignmentId);
    
    if (selectedAssignments.size === updateableAssignments.length) {
      // Deselect all
      setSelectedAssignments(new Set());
    } else {
      // Select all updateable
      setSelectedAssignments(new Set(updateableAssignments));
    }
  };

  return (
    <RoleProtected requiredRole="admin">
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Fix Vana Health 2026 Check-in Dates
            </h1>
            <p className="text-gray-600 mb-6">
              Updates all existing "Vana Health 2026 Check In" assignments to have Week 1 due date: Monday January 5, 2026 (9:00 AM)
            </p>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {result && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">Update Complete!</h3>
                <ul className="text-green-700 text-sm space-y-1">
                  <li>Total assignments: {result.total}</li>
                  <li>Updated: {result.updated}</li>
                  <li>Skipped: {result.skipped}</li>
                  {result.errors && result.errors.length > 0 && (
                    <li className="text-red-600">Errors: {result.errors.length}</li>
                  )}
                </ul>
              </div>
            )}

            {previewLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                <p className="text-gray-600">Loading preview...</p>
              </div>
            ) : preview ? (
              <>
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">Target Dates</h3>
                  <ul className="text-blue-800 text-sm space-y-1">
                    {preview.targetDates && (
                      <>
                        <li>Week 1 Due Date: {new Date(preview.targetDates.week1DueDate).toLocaleString()}</li>
                        <li>Week 1 Start Date: {preview.targetDates.week1StartDate}</li>
                        <li>Week 1 First Check-in Date: {preview.targetDates.week1FirstCheckInDate}</li>
                      </>
                    )}
                  </ul>
                </div>

                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Preview Summary</h3>
                  <ul className="text-gray-700 text-sm space-y-1">
                    <li>Total assignments: {preview.total}</li>
                    <li className="text-green-600 font-semibold">Will update: {preview.willUpdate}</li>
                    <li className="text-gray-500">Will skip: {preview.willSkip}</li>
                    <li className="text-blue-600 font-semibold mt-2">
                      Selected: {selectedAssignments.size} assignment(s)
                    </li>
                  </ul>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Assignments Preview</h3>
                    {preview.willUpdate > 0 && (
                      <button
                        onClick={toggleSelectAll}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {selectedAssignments.size === preview.assignments.filter(a => a.willUpdate).length
                          ? 'Deselect All'
                          : 'Select All Updateable'}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase w-12">
                            <input
                              type="checkbox"
                              checked={preview.assignments.filter(a => a.willUpdate).length > 0 && 
                                       selectedAssignments.size === preview.assignments.filter(a => a.willUpdate).length}
                              onChange={toggleSelectAll}
                              className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                            />
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Client Name</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Current Start Date</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">New Start Date</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Current Due Date</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">New Due Date</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {preview.assignments.slice(0, 50).map((assignment) => (
                          <tr key={assignment.assignmentId} className={assignment.willUpdate ? 'bg-yellow-50' : ''}>
                            <td className="px-4 py-2 text-center">
                              {assignment.willUpdate ? (
                                <input
                                  type="checkbox"
                                  checked={selectedAssignments.has(assignment.assignmentId)}
                                  onChange={() => toggleAssignment(assignment.assignmentId)}
                                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                              <div>{assignment.clientName}</div>
                              <div className="text-xs text-gray-500">{assignment.clientEmail}</div>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-600">
                              {assignment.currentStartDate 
                                ? new Date(assignment.currentStartDate).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })
                                : 'N/A'}
                            </td>
                            <td className="px-4 py-2 text-xs font-semibold text-gray-900">
                              {assignment.willUpdate 
                                ? new Date(assignment.newStartDate).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })
                                : assignment.currentStartDate 
                                  ? new Date(assignment.currentStartDate).toLocaleDateString('en-US', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })
                                  : 'N/A'}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-600">
                              {assignment.currentDueDate 
                                ? new Date(assignment.currentDueDate).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'N/A'}
                            </td>
                            <td className="px-4 py-2 text-xs font-semibold text-gray-900">
                              {assignment.willUpdate
                                ? new Date(assignment.newDueDate).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : assignment.currentDueDate
                                  ? new Date(assignment.currentDueDate).toLocaleDateString('en-US', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : 'N/A'}
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {assignment.willUpdate ? (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-semibold">Will Update</span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">Skip</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500">{assignment.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.assignments.length > 50 && (
                      <p className="text-sm text-gray-500 mt-2">Showing first 50 of {preview.assignments.length} assignments</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 items-center">
                  <button
                    onClick={handleFix}
                    disabled={loading || selectedAssignments.size === 0}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                      loading || selectedAssignments.size === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    {loading 
                      ? 'Updating...' 
                      : selectedAssignments.size > 0
                        ? `Update ${selectedAssignments.size} Selected Assignment(s)`
                        : 'Select assignments to update'}
                  </button>
                  <button
                    onClick={fetchPreview}
                    disabled={previewLoading}
                    className="px-6 py-3 rounded-lg font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
                  >
                    Refresh Preview
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-600">
                No preview data available
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

