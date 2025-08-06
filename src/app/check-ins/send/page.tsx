'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Form {
  id: string;
  title: string;
  description?: string;
  category: string;
  estimatedTime: number;
  isActive: boolean;
  questions: string[];
  createdAt: any;
}

interface Client {
  id: string;
  name: string;
  email: string;
  status: string;
  coachId?: string;
}

interface CheckInAssignment {
  id: string;
  formId: string;
  formTitle: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  assignedBy: string;
  assignedAt: any;
  dueDate?: any;
  status: 'pending' | 'sent' | 'completed' | 'overdue';
  sentAt?: any;
  completedAt?: any;
  responseId?: string;
}

export default function SendCheckInPage() {
  const [forms, setForms] = useState<Form[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedForm, setSelectedForm] = useState<string>('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [recentAssignments, setRecentAssignments] = useState<CheckInAssignment[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch forms
        const formsQuery = query(
          collection(db, 'forms'),
          orderBy('createdAt', 'desc')
        );
        const formsSnapshot = await getDocs(formsQuery);
        const formsData: Form[] = [];
        formsSnapshot.forEach((doc) => {
          formsData.push({ id: doc.id, ...doc.data() } as Form);
        });
        setForms(formsData);

        // Fetch clients
        const clientsQuery = query(
          collection(db, 'clients'),
          orderBy('name', 'asc')
        );
        const clientsSnapshot = await getDocs(clientsQuery);
        const clientsData: Client[] = [];
        clientsSnapshot.forEach((doc) => {
          clientsData.push({ id: doc.id, ...doc.data() } as Client);
        });
        setClients(clientsData);

        // Fetch recent assignments
        const assignmentsQuery = query(
          collection(db, 'check_in_assignments'),
          orderBy('assignedAt', 'desc')
        );
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        const assignmentsData: CheckInAssignment[] = [];
        assignmentsSnapshot.forEach((doc) => {
          assignmentsData.push({ id: doc.id, ...doc.data() } as CheckInAssignment);
        });
        setRecentAssignments(assignmentsData.slice(0, 10)); // Last 10 assignments

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleClientToggle = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAllClients = () => {
    setSelectedClients(clients.map(client => client.id));
  };

  const handleDeselectAllClients = () => {
    setSelectedClients([]);
  };

  const handleSendCheckIns = async () => {
    if (!selectedForm || selectedClients.length === 0) {
      alert('Please select a form and at least one client.');
      return;
    }

    setIsSending(true);
    try {
      const selectedFormData = forms.find(f => f.id === selectedForm);
      const selectedClientsData = clients.filter(c => selectedClients.includes(c.id));

      // Create assignments for each selected client
      const assignments = selectedClientsData.map(client => ({
        formId: selectedForm,
        formTitle: selectedFormData?.title || '',
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email,
        assignedBy: 'coach', // TODO: Get actual coach ID from auth
        assignedAt: new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'pending' as const,
      }));

      // Save assignments to Firestore
      for (const assignment of assignments) {
        await addDoc(collection(db, 'check_in_assignments'), assignment);
      }

      // Update form usage stats
      await updateDoc(doc(db, 'forms', selectedForm), {
        lastAssignedAt: new Date(),
        totalAssignments: (selectedFormData?.totalAssignments || 0) + assignments.length,
      });

      alert(`Successfully assigned check-in to ${assignments.length} client(s)!`);
      
      // Reset form
      setSelectedForm('');
      setSelectedClients([]);
      setDueDate('');
      
      // Refresh recent assignments
      const assignmentsQuery = query(
        collection(db, 'check_in_assignments'),
        orderBy('assignedAt', 'desc')
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignmentsData: CheckInAssignment[] = [];
      assignmentsSnapshot.forEach((doc) => {
        assignmentsData.push({ id: doc.id, ...doc.data() } as CheckInAssignment);
      });
      setRecentAssignments(assignmentsData.slice(0, 10));

    } catch (error) {
      console.error('Error sending check-ins:', error);
      alert('Error sending check-ins. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'sent': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Send Check-in</h1>
              <p className="mt-2 text-gray-600">Assign check-in forms to your clients</p>
            </div>
            <Link
              href="/check-ins"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Back to Check-ins
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Assign Check-in</h2>
              </div>
              <div className="p-6 space-y-6">
                {/* Form Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  {selectedForm && (
                    <div className="mt-2 text-sm text-gray-600">
                      {forms.find(f => f.id === selectedForm)?.description}
                    </div>
                  )}
                </div>

                {/* Client Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Clients *
                    </label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={handleSelectAllClients}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAllClients}
                        className="text-xs text-gray-600 hover:text-gray-800"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded-md p-4 max-h-64 overflow-y-auto">
                    {clients.length === 0 ? (
                      <p className="text-gray-500 text-sm">No clients available</p>
                    ) : (
                      <div className="space-y-2">
                        {clients.map((client) => (
                          <label key={client.id} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedClients.includes(client.id)}
                              onChange={() => handleClientToggle(client.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-3 text-sm text-gray-900">
                              {client.name} ({client.email})
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedClients.length > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      {selectedClients.length} client(s) selected
                    </p>
                  )}
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Leave empty to send immediately
                  </p>
                </div>

                {/* Send Button */}
                <div className="pt-4">
                  <button
                    onClick={handleSendCheckIns}
                    disabled={!selectedForm || selectedClients.length === 0 || isSending}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? 'Sending...' : `Send Check-in to ${selectedClients.length} Client(s)`}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Assignments */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Recent Assignments</h2>
              </div>
              <div className="p-6">
                {recentAssignments.length === 0 ? (
                  <p className="text-gray-500 text-sm">No recent assignments</p>
                ) : (
                  <div className="space-y-4">
                    {recentAssignments.map((assignment) => (
                      <div key={assignment.id} className="border-l-4 border-gray-200 pl-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {assignment.formTitle}
                            </p>
                            <p className="text-xs text-gray-600">
                              {assignment.clientName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(assignment.assignedAt)}
                            </p>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                            {assignment.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 