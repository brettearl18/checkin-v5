'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import CoachNavigation from '@/components/CoachNavigation';

interface Form {
  id: string;
  title: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  assignmentCount: number;
}

export default function VerifyCheckInWindowClientsPage() {
  const { userProfile } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [selectedFormTitle, setSelectedFormTitle] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);

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

  useEffect(() => {
    if (selectedFormId) {
      const fetchClients = async () => {
        try {
          setLoadingClients(true);
          setClients([]);
          
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
              Verify Clients for Check-In Window Update
            </h1>
            <p className="text-gray-600 mb-8">
              Select a form to see all clients that will be affected by the bulk update.
            </p>

            <div className="space-y-6">
              {/* Form Selection */}
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
                        {form.title}
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

              {/* Summary Stats */}
              {selectedFormId && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-blue-600">Total Clients</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {loadingClients ? '...' : clients.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-blue-600">Active Clients</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {loadingClients ? '...' : clients.filter(c => c.status === 'active').length}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-blue-600">Total Assignments</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {loadingClients ? '...' : clients.reduce((sum, c) => sum + c.assignmentCount, 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                              #
                            </th>
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
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {clients.map((client, index) => (
                            <tr key={client.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {index + 1}
                              </td>
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Action Button */}
              {selectedFormId && clients.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Ready to Update?
                  </h3>
                  <p className="text-sm text-gray-700 mb-4">
                    The above <strong>{clients.length} client{clients.length !== 1 ? 's' : ''}</strong> will have their check-in window updated to:
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Start</div>
                      <div className="text-lg font-medium text-gray-900">Friday 9:00 AM</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">End</div>
                      <div className="text-lg font-medium text-gray-900">Tuesday 12:00 PM</div>
                    </div>
                  </div>
                  <a
                    href="/admin/bulk-update-checkin-window"
                    className="inline-block w-full px-6 py-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors shadow-md hover:shadow-lg text-center"
                  >
                    Proceed to Bulk Update →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

