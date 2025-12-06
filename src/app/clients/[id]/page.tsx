'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedOnly } from '@/components/ProtectedRoute';
import Link from 'next/link';
import { collection, getDocs, query, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending' | 'at-risk';
  assignedCoach: string;
  lastCheckIn?: string;
  progressScore?: number;
  completionRate?: number;
  totalCheckIns?: number;
  goals?: string[];
  createdAt: string;
  notes?: string;
  statusUpdatedAt?: string;
  statusReason?: string;
  profile?: {
    age?: number;
    gender?: string;
    occupation?: string;
    healthGoals?: string[];
    medicalHistory?: string[];
  };
}

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showQuickSendModal, setShowQuickSendModal] = useState(false);
  const [forms, setForms] = useState<any[]>([]);
  const [selectedForm, setSelectedForm] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [durationWeeks, setDurationWeeks] = useState(1);
  const [isRecurring, setIsRecurring] = useState(false);
  const [allocatedCheckIns, setAllocatedCheckIns] = useState<any[]>([]);
  const [loadingCheckIns, setLoadingCheckIns] = useState(false);
  const [hasLoadedCheckIns, setHasLoadedCheckIns] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocatingCheckIn, setAllocatingCheckIn] = useState(false);
  const [selectedAllocateForm, setSelectedAllocateForm] = useState('');
  const [allocateStartDate, setAllocateStartDate] = useState('');
  const [allocateDuration, setAllocateDuration] = useState(4);
  const [allocateFrequency, setAllocateFrequency] = useState('weekly');
  const [allocateDueTime, setAllocateDueTime] = useState('09:00');
  const [showCheckInManagementModal, setShowCheckInManagementModal] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<any>(null);
  const [deletingCheckIn, setDeletingCheckIn] = useState(false);
  const [updatingCheckIn, setUpdatingCheckIn] = useState(false);
  const [deletingSeries, setDeletingSeries] = useState(false);

  // Debug forms state changes
  useEffect(() => {
    console.log('🔍 Forms state changed:', forms.length, forms);
  }, [forms]);

  const clientId = params.id as string;

  const fetchClient = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setClient(data.client);
      } else {
        setError('Client not found');
      }
    } catch (error) {
      console.error('Error fetching client:', error);
      setError('Failed to load client data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllocatedCheckIns = async () => {
    if (!clientId || hasLoadedCheckIns) {
      return;
    }
    
    setLoadingCheckIns(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/check-ins`);
      if (response.ok) {
        const data = await response.json();
        setAllocatedCheckIns(data.checkIns || []);
        setHasLoadedCheckIns(true);
      } else {
        console.error('Failed to fetch check-ins');
        setAllocatedCheckIns([]);
      }
    } catch (error) {
      console.error('Error fetching allocated check-ins:', error);
      setAllocatedCheckIns([]);
    } finally {
      setLoadingCheckIns(false);
    }
  };

  useEffect(() => {
    fetchClient();
    // Reset check-ins state when clientId changes
    setAllocatedCheckIns([]);
    setLoadingCheckIns(false);
    setHasLoadedCheckIns(false);
  }, [clientId]);

  useEffect(() => {
    if (client && !hasLoadedCheckIns) {
      fetchAllocatedCheckIns();
    }
  }, [client, hasLoadedCheckIns]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'at-risk': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-800';
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'health': return 'bg-green-100 text-green-800';
      case 'progress': return 'bg-blue-100 text-blue-800';
      case 'nutrition': return 'bg-orange-100 text-orange-800';
      case 'fitness': return 'bg-purple-100 text-purple-800';
      case 'wellness': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to safely convert date fields
  const formatDate = (dateField: any) => {
    if (!dateField) return 'N/A';
    
    try {
      // Handle Firebase Timestamp objects
      if (dateField.toDate && typeof dateField.toDate === 'function') {
        return dateField.toDate().toLocaleDateString();
      }
      
      // Handle plain objects with _seconds (Firebase Timestamp serialized)
      if (dateField._seconds) {
        return new Date(dateField._seconds * 1000).toLocaleDateString();
      }
      
      // Handle Date objects or ISO strings
      if (dateField instanceof Date) {
        return dateField.toLocaleDateString();
      }
      
      // Handle ISO string dates
      const date = new Date(dateField);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
      
      return 'Invalid Date';
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const fetchForms = async () => {
    try {
      const coachId = userProfile?.uid;
      if (!coachId) {
        console.error('No coach ID available');
        return;
      }

      const response = await fetch(`/api/forms?coachId=${coachId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setForms(data.forms || []);
          console.log('Fetched forms:', data.forms?.length || 0);
        } else {
          console.error('Failed to fetch forms:', data.message);
          setForms([]);
        }
      } else {
        console.error('Failed to fetch forms:', response.status);
        setForms([]);
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
      setForms([]);
    }
  };

  const handleQuickSend = async () => {
    if (!selectedForm || !client) return;

    setIsSending(true);
    try {
      const selectedFormData = forms.find(f => f.id === selectedForm);
      
      if (isRecurring && (!startDate || durationWeeks < 1)) {
        alert('Please select a start date and duration for recurring check-ins.');
        setIsSending(false);
        return;
      }

      // Create assignments
      const assignments = [];
      
      if (isRecurring) {
        // Create recurring assignments
        const start = new Date(startDate);
        for (let week = 0; week < durationWeeks; week++) {
          const assignmentDate = new Date(start);
          assignmentDate.setDate(start.getDate() + (week * 7));
          
          assignments.push({
            formId: selectedForm,
            formTitle: selectedFormData?.title || '',
            clientId: client.id,
            clientName: `${client.firstName} ${client.lastName}`,
            clientEmail: client.email,
            assignedBy: userProfile?.uid || 'coach',
            assignedAt: new Date(),
            dueDate: assignmentDate,
            status: 'pending',
            isRecurring: true,
            recurringWeek: week + 1,
            totalWeeks: durationWeeks,
          });
        }
      } else {
        // Single assignment
        assignments.push({
          formId: selectedForm,
          formTitle: selectedFormData?.title || '',
          clientId: client.id,
          clientName: `${client.firstName} ${client.lastName}`,
          clientEmail: client.email,
          assignedBy: userProfile?.uid || 'coach',
          assignedAt: new Date(),
          status: 'pending',
          isRecurring: false,
        });
      }

      // Save assignments to Firestore
      for (const assignment of assignments) {
        await addDoc(collection(db, 'check_in_assignments'), assignment);
      }

      // Update form usage stats
      await updateDoc(doc(db, 'forms', selectedForm), {
        lastAssignedAt: new Date(),
        totalAssignments: (selectedFormData?.totalAssignments || 0) + assignments.length,
      });

      const message = isRecurring 
        ? `Recurring check-in scheduled for ${client.firstName} ${client.lastName} - ${durationWeeks} week(s) starting ${new Date(startDate).toLocaleDateString()}!`
        : `Check-in sent to ${client.firstName} ${client.lastName}!`;
      
      alert(message);
      setShowQuickSendModal(false);
      setSelectedForm('');
      setStartDate('');
      setDurationWeeks(1);
      setIsRecurring(false);
      
      // Refresh client data to show updated last check-in
      fetchClient();
      fetchAllocatedCheckIns();
    } catch (error) {
      console.error('Error sending check-in:', error);
      alert('Error sending check-in. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const openQuickSendModal = () => {
    fetchForms();
    setShowQuickSendModal(true);
    setSelectedForm('');
    setStartDate('');
    setDurationWeeks(1);
    setIsRecurring(false);
  };

  const handleStatusUpdate = async () => {
    if (!newStatus || !client) return;
    
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setClient(data.client);
        setShowStatusModal(false);
        setNewStatus('');
        setStatusReason('');
        // Refresh check-ins to get updated metrics
        setHasLoadedCheckIns(false);
      } else {
        const errorData = await response.json();
        alert(`Failed to update status: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openStatusModal = (currentStatus: string) => {
    setNewStatus(currentStatus);
    setStatusReason('');
    setShowStatusModal(true);
  };

  const openAllocateModal = () => {
    setSelectedAllocateForm('');
    setAllocateStartDate('');
    setAllocateDuration(4);
    setAllocateFrequency('weekly');
    setAllocateDueTime('09:00');
    setShowAllocateModal(true);
    fetchForms(); // Fetch forms when modal opens
  };

  const handleAllocateCheckIn = async () => {
    if (!selectedAllocateForm || !client) return;
    
    setAllocatingCheckIn(true);
    try {
      const selectedFormData = forms.find(f => f.id === selectedAllocateForm);
      
      const response = await fetch('/api/check-in-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formId: selectedAllocateForm,
          clientId: client.id,
          coachId: userProfile?.uid,
          frequency: allocateFrequency,
          duration: allocateDuration,
          startDate: allocateStartDate,
          dueTime: allocateDueTime,
          status: 'pending'
        }),
      });

      if (response.ok) {
        alert('Check-in allocated successfully!');
        setShowAllocateModal(false);
        setSelectedAllocateForm('');
        setAllocateStartDate('');
        setAllocateDuration(4);
        setAllocateFrequency('weekly');
        setAllocateDueTime('09:00');
        
        // Refresh check-ins
        setHasLoadedCheckIns(false);
        fetchAllocatedCheckIns();
      } else {
        const errorData = await response.json();
        alert(`Failed to allocate check-in: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error allocating check-in:', error);
      alert('Error allocating check-in. Please try again.');
    } finally {
      setAllocatingCheckIn(false);
    }
  };

  // Check-in management functions
  const handleDeleteCheckIn = async (checkInId: string) => {
    if (!confirm('Are you sure you want to delete this check-in? This action cannot be undone.')) {
      return;
    }

    setDeletingCheckIn(true);
    try {
      const response = await fetch(`/api/check-in-assignments/${checkInId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Check-in deleted successfully!');
        // Refresh check-ins
        setHasLoadedCheckIns(false);
        fetchAllocatedCheckIns();
      } else {
        const errorData = await response.json();
        alert(`Failed to delete check-in: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error deleting check-in:', error);
      alert('Error deleting check-in. Please try again.');
    } finally {
      setDeletingCheckIn(false);
    }
  };

  const handleUpdateCheckIn = async (checkInId: string, updateData: any) => {
    setUpdatingCheckIn(true);
    try {
      const response = await fetch(`/api/check-in-assignments/${checkInId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        alert('Check-in updated successfully!');
        setShowCheckInManagementModal(false);
        setSelectedCheckIn(null);
        // Refresh check-ins
        setHasLoadedCheckIns(false);
        fetchAllocatedCheckIns();
      } else {
        const errorData = await response.json();
        alert(`Failed to update check-in: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error updating check-in:', error);
      alert('Error updating check-in. Please try again.');
    } finally {
      setUpdatingCheckIn(false);
    }
  };

  const openCheckInManagementModal = (checkIn: any) => {
    setSelectedCheckIn(checkIn);
    setShowCheckInManagementModal(true);
  };

  const handleDeleteSeries = async (formId: string, formTitle: string, preserveHistory: boolean = true) => {
    const action = preserveHistory ? 'pending' : 'entire';
    const warning = preserveHistory 
      ? `Are you sure you want to delete the pending "${formTitle}" check-ins for ${client?.firstName} ${client?.lastName}? This will only remove pending check-ins and preserve all completed history.`
      : `⚠️ DANGER: Are you absolutely sure you want to delete the ENTIRE series of "${formTitle}" check-ins for ${client?.firstName} ${client?.lastName}? This will delete ALL check-ins (pending, completed, etc.) AND ALL RESPONSE HISTORY. This action cannot be undone and will permanently erase the client's progress data.`;

    if (!confirm(warning)) {
      return;
    }

    setDeletingSeries(true);
    try {
      const response = await fetch('/api/check-in-assignments/series', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId,
          formId: formId,
          preserveHistory: preserveHistory
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Series ${action} deleted successfully! ${result.message}`);
        // Refresh check-ins
        setHasLoadedCheckIns(false);
        fetchAllocatedCheckIns();
      } else {
        const errorData = await response.json();
        alert(`Failed to delete ${action} series: ${errorData.message}`);
      }
    } catch (error) {
      console.error(`Error deleting ${action} series:`, error);
      alert(`Error deleting ${action} series. Please try again.`);
    } finally {
      setDeletingSeries(false);
    }
  };

  // Quick Send Modal Component
  const QuickSendModal = () => {
    if (!showQuickSendModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Send Check-in to {client?.firstName} {client?.lastName}
              </h3>
              <button
                onClick={() => setShowQuickSendModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="px-6 py-4 space-y-4">
            {/* Form Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Select Form *
              </label>
              <select
                value={selectedForm}
                onChange={(e) => setSelectedForm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a form...</option>
                {forms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.title} ({form.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Recurring Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="recurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="recurring" className="ml-2 text-sm font-medium text-gray-900">
                Schedule recurring check-ins
              </label>
            </div>

            {/* Recurring Options */}
            {isRecurring && (
              <div className="space-y-4 border-t border-gray-200 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Duration (Weeks) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={durationWeeks}
                    onChange={(e) => setDurationWeeks(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter number of weeks"
                  />
                  <p className="mt-1 text-xs text-gray-500">Enter 1-52 weeks</p>
                </div>

                {/* Preview */}
                {startDate && durationWeeks > 0 && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Schedule Preview:</strong><br />
                      {durationWeeks} check-in{durationWeeks > 1 ? 's' : ''} starting {new Date(startDate).toLocaleDateString()}
                      {durationWeeks > 1 && (
                        <span>, ending {new Date(new Date(startDate).getTime() + (durationWeeks - 1) * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowQuickSendModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickSend}
                disabled={!selectedForm || isSending || (isRecurring && (!startDate || durationWeeks < 1))}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                {isSending ? 'Sending...' : (isRecurring ? 'Schedule Check-ins' : 'Send Check-in')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Status Update Modal Component
  const StatusUpdateModal = () => {
    if (!showStatusModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Update {client?.firstName} {client?.lastName}'s Status
              </h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="px-6 py-4 space-y-4">
            {/* Status Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                New Status *
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select status...</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="at-risk">At Risk</option>
              </select>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Why are you updating this status?"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowStatusModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={!newStatus || updatingStatus}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-md font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingStatus ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Allocate Check-in Modal Component
  const AllocateModal = () => {
    if (!showAllocateModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Allocate Check-in to {client?.firstName} {client?.lastName}
              </h3>
              <button
                onClick={() => setShowAllocateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="px-6 py-4 space-y-4">
            {/* Form Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Select Form *
              </label>
              <select
                value={selectedAllocateForm}
                onChange={(e) => setSelectedAllocateForm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a form...</option>
                {forms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.title} ({form.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Recurring Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="recurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="recurring" className="ml-2 text-sm font-medium text-gray-900">
                Schedule recurring check-ins
              </label>
            </div>

            {/* Recurring Options */}
            {isRecurring && (
              <div className="space-y-4 border-t border-gray-200 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={allocateStartDate}
                    onChange={(e) => setAllocateStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Duration (Weeks) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={allocateDuration}
                    onChange={(e) => setAllocateDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter number of weeks"
                  />
                  <p className="mt-1 text-xs text-gray-500">Enter 1-52 weeks</p>
                </div>

                {/* Frequency */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Frequency *
                  </label>
                  <select
                    value={allocateFrequency}
                    onChange={(e) => setAllocateFrequency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {/* Due Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Due Time *
                  </label>
                  <input
                    type="time"
                    value={allocateDueTime}
                    onChange={(e) => setAllocateDueTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Preview */}
                {allocateStartDate && allocateDuration > 0 && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Schedule Preview:</strong><br />
                      {isRecurring ? 'Recurring check-in' : 'Single check-in'} scheduled for {new Date(allocateStartDate).toLocaleDateString()} at {allocateDueTime}
                      {isRecurring && (
                        <span>, ending {new Date(new Date(allocateStartDate).getTime() + (allocateDuration - 1) * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowAllocateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAllocateCheckIn}
                disabled={!selectedAllocateForm || !allocateStartDate || allocatingCheckIn}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {allocatingCheckIn ? 'Allocating...' : 'Allocate Check-in'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
  }

  if (error || !client) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-12">
              <div className="text-gray-600 text-6xl mb-4">❌</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Client not found</h3>
              <p className="text-gray-800 mb-6">{error}</p>
              <Link
                href="/clients"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
              >
                Back to Clients
              </Link>
            </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
  }

  return (
    <AuthenticatedOnly>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Modern Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-2xl">
                    {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                  </span>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    {client.firstName} {client.lastName}
                  </h1>
                  <p className="text-gray-600 mt-1 text-lg">Client Profile & Progress</p>
                </div>
              </div>
              <div className="flex space-x-3">
                <Link
                  href={`/clients/${clientId}/edit`}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Edit Profile
                </Link>
                <Link
                  href="/clients"
                  className="text-gray-700 hover:text-gray-900 font-medium px-6 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200"
                >
                  ← Back to Clients
                </Link>
              </div>
            </div>

            {/* Status Cards */}
            <div className="flex items-center space-x-6">
              <div className={`flex items-center space-x-2 bg-white rounded-xl px-4 py-2 shadow-sm border ${
                client.status === 'active' ? 'border-green-100' :
                client.status === 'inactive' ? 'border-gray-100' :
                client.status === 'pending' ? 'border-yellow-100' :
                client.status === 'at-risk' ? 'border-red-100' : 'border-gray-100'
              }`}>
                <div className={`w-3 h-3 rounded-full animate-pulse ${
                  client.status === 'active' ? 'bg-green-500' :
                  client.status === 'inactive' ? 'bg-gray-500' :
                  client.status === 'pending' ? 'bg-yellow-500' :
                  client.status === 'at-risk' ? 'bg-red-500' : 'bg-gray-500'
                }`}></div>
                <span className={`font-medium ${
                  client.status === 'active' ? 'text-green-700' :
                  client.status === 'inactive' ? 'text-gray-700' :
                  client.status === 'pending' ? 'text-yellow-700' :
                  client.status === 'at-risk' ? 'text-red-700' : 'text-gray-700'
                }`}>{client.status}</span>
                <button
                  onClick={() => openStatusModal(client.status)}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Update Status"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Modern Client Overview Card */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-900">Client Overview</h2>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Contact Info */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Contact</h3>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-gray-900 font-medium">{client.email}</span>
                        </div>
                        {client.phone && (
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </div>
                            <span className="text-gray-900 font-medium">{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Status</h3>
                      <div className="flex items-center space-x-2">
                        <span className={`px-4 py-2 text-sm font-medium rounded-full ${getStatusColor(client.status)}`}>
                          {client.status}
                        </span>
                        <button
                          onClick={() => openStatusModal(client.status)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Update Status"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Last Activity */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Last Activity</h3>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-gray-900 font-medium">
                          {client.lastCheckIn ? 
                            formatDate(client.lastCheckIn) : 
                            'No activity'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Score Card - Replacing Profile Information */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-8 py-6 border-b border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-900">Progress Overview</h2>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Progress Score */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-4">Current Progress Score</h3>
                        <div className="space-y-4">
                          <div className="text-5xl font-bold text-gray-900">
                            {client.progressScore || 0}%
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${client.progressScore || 0}%` }}
                            ></div>
                          </div>
                          <div className="text-lg text-gray-600 font-medium">
                            {client.progressScore >= 80 ? '🎉 Excellent Progress' : 
                             client.progressScore >= 60 ? '👍 Good Progress' : '⚠️ Needs Attention'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Stats */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-gray-700 mb-4">Progress Statistics</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <span className="text-gray-700 font-medium">Total Check-ins</span>
                          </div>
                          <span className="text-2xl font-bold text-gray-900">{client.totalCheckIns || 0}</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <span className="text-gray-700 font-medium">Average Score</span>
                          </div>
                          <span className="text-2xl font-bold text-gray-900">
                            {client.progressScore || 0}%
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </div>
                            <span className="text-gray-700 font-medium">Completion Rate</span>
                          </div>
                          <span className="text-2xl font-bold text-gray-900">100%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Health Goals */}
              {client.goals && client.goals.length > 0 && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 px-8 py-6 border-b border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900">Health Goals</h2>
                  </div>
                  <div className="p-8">
                    <div className="flex flex-wrap gap-3">
                      {client.goals.map((goal, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 text-sm font-medium rounded-full border border-orange-200"
                        >
                          {goal}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Medical History */}
              {client.profile?.medicalHistory && client.profile.medicalHistory.length > 0 && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 px-8 py-6 border-b border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900">Medical History</h2>
                  </div>
                  <div className="p-8">
                    <ul className="space-y-3">
                      {client.profile.medicalHistory.map((condition, index) => (
                        <li key={index} className="flex items-center space-x-3">
                          <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                          <span className="text-gray-900 font-medium">{condition}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Notes */}
              {client.notes && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 px-8 py-6 border-b border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900">Notes</h2>
                  </div>
                  <div className="p-8">
                    <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
                  </div>
                </div>
              )}

              {/* Modern Check-ins Overview */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Check-ins Overview</h2>
                    <div className="flex space-x-4">
                      <span className="text-sm text-gray-600 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
                        {client.totalCheckIns || 0} total allocated
                      </span>
                      <span className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full shadow-sm border border-green-200">
                        {allocatedCheckIns.filter(c => c.status === 'completed').length} completed
                      </span>
                      <span className="text-sm text-yellow-600 bg-yellow-50 px-4 py-2 rounded-full shadow-sm border border-yellow-200">
                        {allocatedCheckIns.filter(c => c.status === 'pending').length} pending
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-8">
                  {loadingCheckIns ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                      <p className="text-gray-500 text-lg">Loading check-ins...</p>
                    </div>
                  ) : allocatedCheckIns.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-lg mb-4">No check-ins allocated yet</p>
                      <button
                        onClick={openQuickSendModal}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        Send first check-in
                      </button>
                    </div>
                  ) : (
                    <div id="check-ins-section" className="space-y-8">
                      {/* Series Management Section */}
                      {(() => {
                        // Group check-ins by form to identify series
                        const seriesMap = new Map();
                        allocatedCheckIns.forEach(checkIn => {
                          if (!seriesMap.has(checkIn.formId)) {
                            seriesMap.set(checkIn.formId, {
                              formId: checkIn.formId,
                              formTitle: checkIn.formTitle,
                              totalCheckIns: 0,
                              completedCheckIns: 0,
                              pendingCheckIns: 0,
                              isRecurring: checkIn.isRecurring,
                              totalWeeks: checkIn.totalWeeks
                            });
                          }
                          const series = seriesMap.get(checkIn.formId);
                          series.totalCheckIns++;
                          if (checkIn.status === 'completed') {
                            series.completedCheckIns++;
                          } else if (checkIn.status === 'pending') {
                            series.pendingCheckIns++;
                          }
                        });

                        const series = Array.from(seriesMap.values());
                        
                        if (series.length === 0) return null;

                        return (
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                              <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                              Check-in Series Management
                            </h3>
                            <div className="space-y-3">
                              {series.map((s) => (
                                <div key={s.formId} className="flex items-center justify-between p-4 bg-white rounded-lg border border-blue-100">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-gray-900">{s.formTitle}</h4>
                                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                      <span>Total: {s.totalCheckIns}</span>
                                      <span>Completed: {s.completedCheckIns}</span>
                                      <span>Pending: {s.pendingCheckIns}</span>
                                      {s.isRecurring && (
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                          {s.totalWeeks} weeks
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => handleDeleteSeries(s.formId, s.formTitle, true)}
                                      disabled={deletingSeries}
                                      className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Delete only pending check-ins, preserve completed history"
                                    >
                                      {deletingSeries ? 'Deleting...' : 'Delete Pending'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSeries(s.formId, s.formTitle, false)}
                                      disabled={deletingSeries}
                                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Delete entire series including all history (cannot be undone)"
                                    >
                                      {deletingSeries ? 'Deleting...' : 'Delete All'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-gray-600 mt-3">
                              💡 <strong>Delete Pending:</strong> Remove only future check-ins, preserve completed history. <strong>Delete All:</strong> Remove entire series including all history (cannot be undone).
                            </p>
                          </div>
                        );
                      })()}

                      {/* Completed Check-ins Section */}
                      {allocatedCheckIns.filter(c => c.status === 'completed').length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                            Completed Check-ins ({allocatedCheckIns.filter(c => c.status === 'completed').length})
                          </h3>
                          <div className="space-y-4">
                            {allocatedCheckIns.filter(c => c.status === 'completed').map((checkIn) => (
                              <div key={checkIn.id} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 hover:shadow-lg transition-all duration-200">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <h4 className="text-lg font-bold text-gray-900">{checkIn.formTitle}</h4>
                                      <p className="text-gray-600">{checkIn.responseCount} questions</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="px-4 py-2 text-sm font-medium rounded-full bg-green-100 text-green-800">
                                      {checkIn.score}%
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  <div className="flex items-center space-x-2">
                                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getCategoryColor(checkIn.category)}`}>
                                      {checkIn.category}
                                    </span>
                                    {checkIn.isRecurring && (
                                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                        Week {checkIn.recurringWeek} of {checkIn.totalWeeks}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    <span className="font-medium">Assigned:</span> {formatDate(checkIn.assignedAt)}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    <span className="font-medium">Completed:</span> {formatDate(checkIn.completedAt)}
                                  </div>
                                  <div className="flex space-x-2">
                                    <button className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors">
                                      View
                                    </button>
                                    <button className="text-gray-600 hover:text-gray-800 font-medium text-sm transition-colors">
                                      Progress
                                    </button>
                                    <div className="flex space-x-1">
                                      <button 
                                        onClick={() => handleDeleteSeries(checkIn.formId, checkIn.formTitle, true)}
                                        disabled={deletingSeries}
                                        className="text-orange-600 hover:text-orange-800 font-medium text-xs transition-colors disabled:opacity-50"
                                        title="Delete only pending check-ins, preserve completed history"
                                      >
                                        {deletingSeries ? 'Deleting...' : 'Delete Pending'}
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteSeries(checkIn.formId, checkIn.formTitle, false)}
                                        disabled={deletingSeries}
                                        className="text-red-600 hover:text-red-800 font-medium text-xs transition-colors disabled:opacity-50"
                                        title="Delete entire series including all history (cannot be undone)"
                                      >
                                        {deletingSeries ? 'Deleting...' : 'Delete All'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pending Check-ins Section */}
                      {allocatedCheckIns.filter(c => c.status === 'pending').length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></span>
                            Pending Check-ins ({allocatedCheckIns.filter(c => c.status === 'pending').length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allocatedCheckIns.filter(c => c.status === 'pending').slice(0, 6).map((checkIn) => (
                              <div key={checkIn.id} className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200 hover:shadow-lg transition-all duration-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                                      Pending
                                    </span>
                                    <div className="relative">
                                      <button
                                        onClick={() => openCheckInManagementModal(checkIn)}
                                        className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <h4 className="text-sm font-bold text-gray-900 mb-2">{checkIn.formTitle}</h4>
                                <div className="space-y-2 text-xs text-gray-600">
                                  <div>Assigned: {formatDate(checkIn.assignedAt)}</div>
                                  {checkIn.isRecurring && (
                                    <div>Week {checkIn.recurringWeek} of {checkIn.totalWeeks}</div>
                                  )}
                                </div>
                                <div className="mt-3 pt-3 border-t border-yellow-200 flex justify-between items-center">
                                  <button
                                    onClick={() => openCheckInManagementModal(checkIn)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCheckIn(checkIn.id)}
                                    disabled={deletingCheckIn}
                                    className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors disabled:opacity-50"
                                  >
                                    {deletingCheckIn ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              </div>
                            ))}
                            {allocatedCheckIns.filter(c => c.status === 'pending').length > 6 && (
                              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 flex items-center justify-center">
                                <div className="text-center">
                                  <div className="w-10 h-10 bg-gray-300 rounded-lg flex items-center justify-center mx-auto mb-2">
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    +{allocatedCheckIns.filter(c => c.status === 'pending').length - 6} more pending
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Quick Stats */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Quick Stats</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total Check-ins</span>
                    <span className="font-bold text-gray-900">{client.totalCheckIns || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Average Score</span>
                    <span className="font-bold text-gray-900">
                      {allocatedCheckIns.length > 0 
                        ? Math.round(allocatedCheckIns.reduce((sum, c) => sum + c.score, 0) / allocatedCheckIns.length)
                        : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Completion Rate</span>
                    <span className="font-bold text-gray-900">100%</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-6 space-y-3">
                  <button
                    onClick={openQuickSendModal}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Send Check-in
                  </button>
                  <button
                    onClick={openAllocateModal}
                    className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Allocate Check-in
                  </button>
                  <Link
                    href={`/clients/${clientId}/progress`}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                  >
                    View Progress
                  </Link>
                  <Link
                    href={`/clients/${clientId}/forms`}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                  >
                    Form Responses
                  </Link>
                  <button
                    onClick={() => {
                      // Scroll to check-ins section
                      const checkInsSection = document.getElementById('check-ins-section');
                      if (checkInsSection) {
                        checkInsSection.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Manage Check-ins
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-red-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {client.lastCheckIn ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="text-gray-900 font-medium">Last check-in</p>
                          <p className="text-gray-500 text-sm">
                            {formatDate(client.lastCheckIn)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                        <div>
                          <p className="text-gray-900 font-medium">No check-ins yet</p>
                          <p className="text-gray-500 text-sm">Send first check-in</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <QuickSendModal />
      <StatusUpdateModal />
      
      {/* Allocate Check-in Modal */}
      {showAllocateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 px-6 py-4 border-b border-gray-100 rounded-t-2xl">
              <h3 className="text-xl font-bold text-gray-900">Allocate Check-in</h3>
              <p className="text-gray-600 mt-1">Assign a check-in form to {client?.firstName}</p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Form Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Select Form *
                </label>
                <select
                  value={selectedAllocateForm}
                  onChange={(e) => setSelectedAllocateForm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Choose a form...</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={allocateStartDate}
                  onChange={(e) => setAllocateStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Frequency
                </label>
                <select
                  value={allocateFrequency}
                  onChange={(e) => setAllocateFrequency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Duration (weeks)
                </label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={allocateDuration}
                  onChange={(e) => setAllocateDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Due Time */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Due Time
                </label>
                <input
                  type="time"
                  value={allocateDueTime}
                  onChange={(e) => setAllocateDueTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowAllocateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAllocateCheckIn}
                  disabled={!selectedAllocateForm || !allocateStartDate || allocatingCheckIn}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {allocatingCheckIn ? 'Allocating...' : 'Allocate Check-in'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Management Modal */}
      {showCheckInManagementModal && selectedCheckIn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Manage Check-in
                </h3>
                <button
                  onClick={() => setShowCheckInManagementModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Form Title
                </label>
                <p className="text-gray-700 font-medium">{selectedCheckIn.formTitle}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Status
                </label>
                <select
                  value={selectedCheckIn.status}
                  onChange={(e) => setSelectedCheckIn({...selectedCheckIn, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={selectedCheckIn.dueDate ? new Date(selectedCheckIn.dueDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => setSelectedCheckIn({...selectedCheckIn, dueDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Notes
                </label>
                <textarea
                  value={selectedCheckIn.notes || ''}
                  onChange={(e) => setSelectedCheckIn({...selectedCheckIn, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add notes about this check-in..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => handleDeleteCheckIn(selectedCheckIn.id)}
                  disabled={deletingCheckIn}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {deletingCheckIn ? 'Deleting...' : 'Delete Check-in'}
                </button>
                <button
                  onClick={() => handleUpdateCheckIn(selectedCheckIn.id, {
                    status: selectedCheckIn.status,
                    dueDate: selectedCheckIn.dueDate,
                    notes: selectedCheckIn.notes
                  })}
                  disabled={updatingCheckIn}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {updatingCheckIn ? 'Updating...' : 'Update Check-in'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedOnly>
  );
} 