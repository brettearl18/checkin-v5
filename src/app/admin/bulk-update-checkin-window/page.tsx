'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import CoachNavigation from '@/components/CoachNavigation';
import Link from 'next/link';

interface Form {
  id: string;
  title: string;
  category?: string;
  description?: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  assignmentCount: number;
}

export default function BulkUpdateCheckInWindowPage() {
  const { userProfile } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [selectedFormTitle, setSelectedFormTitle] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    updatedCount?: number;
    errorCount?: number;
  } | null>(null);

  // Fetch all forms on mount
  useEffect(() => {
    const fetchForms = async () => {
      try {
        setLoadingForms(true);
        const response = await fetch('/api/admin/bulk-update-checkin-window?action=forms');
        const data = await response.json();
        
        if (data.success && data.forms) {
          setForms(data.forms);
          // Auto-select "Vana Health 2026 Check In" if it exists
          const vanaForm = data.forms.find((f: Form) => 
            f.title.toLowerCase().includes('vana health 2026')
          );
          if (vanaForm) {
            setSelectedFormId(vanaForm.id);
            setSelectedFormTitle(vanaForm.title);
          }
        }
      } catch (error) {
        console.error('Error fetching forms:', error);
      } finally {
        setLoadingForms(false);
      }
    };

    fetchForms();
  }, []);

  // Fetch clients when form is selected
  useEffect(() => {
    if (selectedFormId) {
      const fetchClients = async () => {
        try {
          setLoadingClients(true);
          setClients([]);
          setResult(null);
          
          const response = await fetch(`/api/admin/bulk-update-checkin-window?formId=${selectedFormId}`);
          const data = await response.json();
          
          if (data.success && data.clients) {
            setClients(data.clients);
          }
        } catch (error) {
          console.error('Error fetching clients:', error);
        } finally {
          setLoadingClients(false);
        }
      };

      fetchClients();
    } else {
      setClients([]);
    }
  }, [selectedFormId]);

  const handleFormChange = (formId: string) => {
    setSelectedFormId(formId);
    const form = forms.find(f => f.id === formId);
    setSelectedFormTitle(form?.title || '');
    setResult(null);
  };

  const handleUpdate = async () => {
    if (!selectedFormId) {
      alert('Please select a form');
      return;
    }

    if (!confirm(`Are you sure you want to update the check-in window for ${clients.length} client(s)?`)) {
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
          formId: selectedFormId,
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
        // Refresh clients list
        const refreshResponse = await fetch(`/api/admin/bulk-update-checkin-window?formId=${selectedFormId}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.success && refreshData.clients) {
          setClients(refreshData.clients);
        }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <RoleProtected allowedRoles={['admin', 'coach']}>
      <div className="min-h-screen bg-gray-50">
        <CoachNavigation />
        
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bulk Update Check-In Window
            </h1>
            <p className="text-gray-600 mb-8">
              Select a check-in form to see all clients using it, then update their check-in window settings.
            </p>

            <div className="space-y-6">
              {/* Form Selection Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Check-In Form
                </label>
                {loadingForms ? (
                  <div className="px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500">
                    Loading forms...
                  </div>
                ) : (
                  <select
                    value={selectedFormId}
                    onChange={(e) => handleFormChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                  >
                    <option value="">-- Select a form --</option>
                    {forms.map((form) => (
                      <option key={form.id} value={form.id}>
                        {form.title} {form.category ? `(${form.category})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {selectedFormTitle && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: <span className="font-medium">{selectedFormTitle}</span>
                  </p>
                )}
              </div>

              {/* Clients List */}
              {selectedFormId && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Clients Using This Form
                    </h3>
                    {loadingClients ? (
                      <p className="text-sm text-gray-500 mt-1">Loading clients...</p>
                    ) : (
                      <p className="text-sm text-gray-500 mt-1">
                        {clients.length} client{clients.length !== 1 ? 's' : ''} found
                      </p>
                    )}
                  </div>
                  
                  {loadingClients ? (
                    <div className="p-8 text-center text-gray-500">
                      Loading clients...
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No clients found using this form.
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                              Client Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                              Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                              Assignments
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {clients.map((client) => (
                            <tr key={client.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  {client.firstName} {client.lastName}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">{client.email || 'N/A'}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(client.status)}`}>
                                  {client.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {client.assignmentCount}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <Link
                                  href={`/clients/${client.id}`}
                                  className="text-orange-600 hover:text-orange-900"
                                >
                                  View →
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* New Window Settings Display */}
              {selectedFormId && clients.length > 0 && (
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
                      <strong>Note:</strong> The "window open" email flag will be cleared for all assignments. 
                      This means clients will receive the "window open" email on the next window opening (Friday 9am), 
                      not immediately. This prevents duplicate emails if they already received one today.
                    </div>
                  </div>
                </div>
              )}

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
              {selectedFormId && clients.length > 0 && (
                <button
                  onClick={handleUpdate}
                  disabled={loading || !selectedFormId}
                  className="w-full px-6 py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-md hover:shadow-lg"
                >
                  {loading ? 'Updating...' : `Update Check-In Window for ${clients.length} Client${clients.length !== 1 ? 's' : ''}`}
                </button>
              )}

              {/* Warning */}
              {selectedFormId && clients.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 text-xl">⚠️</span>
                    <div className="text-sm text-yellow-800">
                      <strong>Warning:</strong> This action will update the check-in window for 
                      <strong> all {clients.length} client{clients.length !== 1 ? 's' : ''}</strong> listed above. 
                      The window will be changed to Friday 9:00 AM - Tuesday 12:00 PM. 
                      This cannot be easily undone. Please review the client list above before proceeding.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}
