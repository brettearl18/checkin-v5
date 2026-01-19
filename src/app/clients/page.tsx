'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import CoachNavigation from '@/components/CoachNavigation';
import Link from 'next/link';
import {
  getTrafficLightStatus,
  getTrafficLightIcon,
  getTrafficLightColor,
  getDefaultThresholds,
  type ScoringThresholds,
  type TrafficLightStatus
} from '@/lib/scoring-utils';
import ClientOfTheWeekCompact from '@/components/ClientOfTheWeekCompact';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending' | 'paused' | 'completed' | 'archived';
  assignedCoach: string;
  lastCheckIn?: string;
  progressScore?: number;
  completionRate?: number;
  totalCheckIns?: number;
  completedCheckIns?: number;
  goals?: string[];
  createdAt: string;
  pausedUntil?: string;
  profile?: {
    age?: number;
    gender?: string;
    occupation?: string;
    healthGoals?: string[];
    medicalHistory?: string[];
  };
  scoringThresholds?: ScoringThresholds;
  overdueCheckIns?: number;
  daysSinceLastCheckIn?: number;
  recentCheckIns?: Array<{
    id: string;
    score: number;
    completedAt: string;
    trafficLightStatus: TrafficLightStatus;
  }>;
  lastCheckInScore?: number;
  lastCheckInTrafficLight?: TrafficLightStatus;
}

export default function ClientsPage() {
  const { userProfile, logout } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending' | 'needsAttention' | 'archived'>('all');
  const [clientTableSortBy, setClientTableSortBy] = useState<string>('name');
  const [clientTableSortOrder, setClientTableSortOrder] = useState<'asc' | 'desc'>('asc');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<{ clientId: string; status: string; pausedUntil?: string } | null>(null);
  const [clientsWithMetrics, setClientsWithMetrics] = useState<Client[]>([]);
  const [deletingClient, setDeletingClient] = useState<string | null>(null);
  
  // Bulk selection state
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [bulkActionMenuOpen, setBulkActionMenuOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  
  // Quick actions state
  const [quickActionsClientId, setQuickActionsClientId] = useState<string | null>(null);
  
  // Export state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  // Filter presets state
  const [filterPresets, setFilterPresets] = useState<Array<{ id: string; name: string; filter: any; sort: any }>>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    if (userProfile?.uid) {
      fetchClients();
    } else if (userProfile === null) {
      // User profile is loaded but user is not authenticated
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, statusFilter, clientTableSortBy, clientTableSortOrder]);

  const fetchClients = async () => {
    try {
      if (!userProfile?.uid) {
        setLoading(false);
        return;
      }

      // Use the new optimized inventory endpoint that aggregates all data
      const response = await fetch(
        `/api/clients/inventory?coachId=${userProfile.uid}&status=${statusFilter === 'all' ? 'all' : statusFilter}&sortBy=${clientTableSortBy}&sortOrder=${clientTableSortOrder}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.clients) {
          const inventoryClients = data.data.clients;
          
          // Transform inventory data to match existing Client interface
          const transformedClients: Client[] = inventoryClients.map((item: any) => {
            const m = item.metrics;
            const thresholds = getDefaultThresholds('moderate');
            
            return {
              id: item.id,
              firstName: item.firstName,
              lastName: item.lastName,
              email: item.email,
              phone: item.phone,
              status: item.status,
              createdAt: item.createdAt,
              assignedCoach: userProfile.uid,
              lastCheckIn: m.lastCheckInDate,
              progressScore: m.progressScore,
              completionRate: m.completionRate,
              totalCheckIns: m.totalCheckIns,
              completedCheckIns: m.completedCheckIns,
              overdueCheckIns: m.overdueCheckIns,
              daysSinceLastCheckIn: m.daysSinceLastCheckIn,
              scoringThresholds: thresholds,
              recentCheckIns: m.recentCheckIns.map((ci: any) => ({
                id: ci.id || '',
                score: ci.score,
                completedAt: ci.completedAt,
                trafficLightStatus: ci.trafficLight
              })),
              lastCheckInScore: m.lastCheckInScore,
              lastCheckInTrafficLight: m.lastCheckInTrafficLight
            };
          });
          
          setClients(transformedClients);
          setClientsWithMetrics(transformedClients);
        } else {
          // Fallback to old endpoint if new one fails
          console.warn('Inventory endpoint failed, falling back to legacy endpoint');
          const fallbackResponse = await fetch(`/api/clients?coachId=${userProfile.uid}`);
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            setClients(fallbackData.clients || []);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
      // Fallback to old endpoint on error
      try {
        const fallbackResponse = await fetch(`/api/clients?coachId=${userProfile.uid}`);
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          setClients(fallbackData.clients || []);
        }
      } catch (fallbackError) {
        console.error('Fallback endpoint also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    const clientName = client ? `${client.firstName} ${client.lastName}` : 'this client';
    
    const confirmMessage = client?.status === 'archived'
      ? `⚠️ PERMANENT DELETION WARNING ⚠️\n\nAre you absolutely sure you want to PERMANENTLY DELETE ${clientName}?\n\nThis will permanently delete:\n- All check-in assignments\n- All form responses\n- All measurements\n- All goals\n- All progress images\n- All coach feedback\n- All onboarding data\n- Client profile and scoring settings\n\nThis action CANNOT be undone!\n\nType "DELETE" to confirm:`
      : `Are you sure you want to delete ${clientName}?\n\nNote: Only archived clients can be permanently deleted. Please archive this client first if you want to delete them permanently.`;

    if (client?.status === 'archived') {
      const userInput = prompt(confirmMessage);
      if (userInput !== 'DELETE') {
        alert('Deletion cancelled. You must type "DELETE" exactly to confirm permanent deletion.');
        return;
      }
    } else {
      if (!confirm(confirmMessage)) {
        return;
      }
      alert('Only archived clients can be permanently deleted. Please archive this client first.');
      return;
    }

    setDeletingClient(clientId);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (response.ok && data.success) {
        // Remove from local state
        setClients(clients.filter(client => client.id !== clientId));
        setClientsWithMetrics(clientsWithMetrics.filter(client => client.id !== clientId));
        alert(`Client ${clientName} and all related data have been permanently deleted.`);
      } else {
        alert(data.error || 'Failed to delete client');
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('An error occurred while deleting the client. Please try again.');
    } finally {
      setDeletingClient(null);
    }
  };

  // Client-side search filtering only (status filtering is handled server-side)
  // Use useMemo to optimize search filtering performance
  const filteredClients = useMemo(() => {
    const clientsToFilter = clientsWithMetrics.length > 0 ? clientsWithMetrics : clients;
    
    if (!searchTerm) return clientsToFilter; // No search term, return all
    
    const searchLower = searchTerm.toLowerCase();
    return clientsToFilter.filter(client => {
      return (client.firstName?.toLowerCase() || '').includes(searchLower) ||
             (client.lastName?.toLowerCase() || '').includes(searchLower) ||
             (client.email?.toLowerCase() || '').includes(searchLower);
    });
  }, [clientsWithMetrics, clients, searchTerm]);

  // Bulk selection handlers
  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };
  
  const toggleSelectAll = () => {
    if (selectedClients.size === filteredClients.length && filteredClients.length > 0) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map(c => c.id)));
    }
  };
  
  const clearSelection = () => {
    setSelectedClients(new Set());
    setBulkActionMenuOpen(false);
  };
  
  // Bulk actions handlers
  const handleBulkAction = async (action: 'email' | 'status' | 'archive') => {
    if (selectedClients.size === 0) return;
    const selectedIds = Array.from(selectedClients);
    setBulkActionLoading(true);
    try {
      if (action === 'email') {
        const subject = prompt('Enter email subject:');
        if (!subject) { setBulkActionLoading(false); return; }
        const message = prompt('Enter email message:');
        if (!message) { setBulkActionLoading(false); return; }
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/emails/manual-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token || ''}` },
          body: JSON.stringify({ clientIds: selectedIds, emailType: 'custom', subject, customContent: message })
        });
        const result = await response.json();
        if (result.success) {
          alert(`Successfully sent ${result.summary.successful} email(s)`);
          clearSelection();
        } else {
          alert(`Error: ${result.message}`);
        }
      } else if (action === 'status') {
        const newStatus = prompt('Enter new status (active/paused/completed/inactive/archived):');
        if (!newStatus) { setBulkActionLoading(false); return; }
        await Promise.all(selectedIds.map(id => fetch(`/api/clients/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })));
        alert(`Updated ${selectedIds.length} client(s)`);
        clearSelection();
        fetchClients();
      } else if (action === 'archive') {
        if (!confirm(`Archive ${selectedIds.length} client(s)?`)) { setBulkActionLoading(false); return; }
        await Promise.all(selectedIds.map(id => fetch(`/api/clients/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'archived' }) })));
        alert(`Archived ${selectedIds.length} client(s)`);
        clearSelection();
        fetchClients();
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      alert('Error performing bulk action');
    } finally {
      setBulkActionLoading(false);
      setBulkActionMenuOpen(false);
    }
  };
  
  // Export functionality
  const handleExport = async (clientIds?: string[], format: 'csv' | 'pdf' | 'excel' = 'csv') => {
    const clientsToExport = clientIds ? filteredClients.filter(c => clientIds.includes(c.id)) : filteredClients;
    if (format === 'csv') {
      const headers = ['Name', 'Email', 'Phone', 'Status', 'Progress Score', 'Completion Rate', 'Total Check-ins', 'Completed Check-ins', 'Weeks on Program', 'Last Check-in'];
      const rows = clientsToExport.map(client => {
        let weeksOnProgram = 0;
        try {
          const dateToUse = (client as any).joinDate || client.createdAt;
          let startDate: Date;
          if (typeof dateToUse === 'string') startDate = new Date(dateToUse);
          else if (dateToUse?.toDate) startDate = dateToUse.toDate();
          else startDate = new Date(dateToUse);
          weeksOnProgram = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        } catch { weeksOnProgram = 0; }
        return [`${client.firstName} ${client.lastName}`, client.email || '', client.phone || '', client.status || '', client.progressScore?.toString() || '0', `${client.completionRate || 0}%`, client.totalCheckIns?.toString() || '0', client.completedCheckIns?.toString() || '0', weeksOnProgram.toString(), client.lastCheckIn || 'Never'];
      });
      const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `clients-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      setExportMenuOpen(false);
    } else {
      alert(`${format.toUpperCase()} export coming soon!`);
    }
  };
  
  // Filter presets handlers
  const saveFilterPreset = () => {
    if (!presetName.trim()) { alert('Please enter a preset name'); return; }
    const preset = { id: Date.now().toString(), name: presetName.trim(), filter: { status: statusFilter, search: searchTerm }, sort: { by: clientTableSortBy, order: clientTableSortOrder } };
    const presets = [...filterPresets, preset];
    setFilterPresets(presets);
    localStorage.setItem('clientFilterPresets', JSON.stringify(presets));
    setShowPresetModal(false);
    setPresetName('');
    alert('Filter preset saved!');
  };
  const loadFilterPreset = (preset: typeof filterPresets[0]) => {
    setStatusFilter(preset.filter.status);
    setSearchTerm(preset.filter.search);
    setClientTableSortBy(preset.sort.by);
    setClientTableSortOrder(preset.sort.order);
  };
  const deleteFilterPreset = (presetId: string) => {
    const presets = filterPresets.filter(p => p.id !== presetId);
    setFilterPresets(presets);
    localStorage.setItem('clientFilterPresets', JSON.stringify(presets));
  };

  // Load presets from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('clientFilterPresets');
    if (saved) {
      try {
        setFilterPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading filter presets:', e);
      }
    }
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.relative')) {
        setBulkActionMenuOpen(false);
        setExportMenuOpen(false);
        setQuickActionsClientId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-slate-100 text-slate-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-800';
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-[#FAFAFA] flex">
          <div className="w-64 bg-white shadow-xl border-r border-gray-100">
            {/* Sidebar loading skeleton */}
            <div className="animate-pulse">
              <div className="h-32 bg-gray-200"></div>
              <div className="p-4 space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow p-6">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-white flex flex-col lg:flex-row">
        {/* Desktop Sidebar Navigation */}
        <div className="hidden lg:block">
          <CoachNavigation />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:ml-4 lg:mr-8 lg:mt-6 lg:mb-6 lg:max-w-7xl lg:mx-auto">
          {/* Mobile Header */}
          <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200">
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Clients</h1>
                <p className="text-xs text-gray-600 mt-0.5">Manage your clients</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/clients/photos"
                  className="p-2 rounded-full text-white transition-all min-h-[44px] flex items-center justify-center"
                  style={{ backgroundColor: '#daa450' }}
                  title="View Photos Gallery"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </Link>
                <Link
                  href="/clients/create"
                  className="px-4 py-2 rounded-full text-sm font-medium text-white transition-all min-h-[44px] flex items-center justify-center"
                  style={{ backgroundColor: '#daa450' }}
                >
                  + Add
                </Link>
              </div>
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block mb-6">
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b-2 rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Clients</h1>
                  <p className="text-gray-600 text-sm">Manage your client relationships and track their progress</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/clients/photos"
                    className="px-4 py-3 rounded-2xl font-medium transition-all duration-200 shadow-sm hover:shadow-md text-white flex items-center gap-2"
                    style={{ backgroundColor: '#daa450' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    View Photos Gallery
                  </Link>
                  <Link
                    href="/clients/create"
                    className="px-6 py-3 rounded-2xl font-medium transition-all duration-200 shadow-sm hover:shadow-md text-white"
                    style={{ backgroundColor: '#daa450' }}
                  >
                    Add New Client
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 lg:px-0">

            {/* Client of the Week - Compact */}
            {userProfile?.uid && (
              <div className="mb-4 lg:mb-6">
                <ClientOfTheWeekCompact coachId={userProfile.uid} />
              </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-6 mb-6 lg:mb-8">
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-10 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 truncate">Total</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{clients.length}</div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">All clients</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b-2" style={{ backgroundColor: '#f0fdf4', borderColor: '#34C759' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-10 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#34C759' }}>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 truncate">Active</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    {clients.filter(c => c.status === 'active').length}
                  </div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Currently active</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-10 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 truncate">Pending</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    {clients.filter(c => c.status === 'pending').length}
                  </div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Awaiting approval</div>
                </div>
              </div>

              {/* At-Risk Clients Card */}
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b-2" style={{ backgroundColor: '#fef2f2', borderColor: '#FF3B30' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-10 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FF3B30' }}>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 truncate">At-Risk</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    {clientsWithMetrics.filter(c => {
                      if (c.status === 'archived') return false;
                      if (!c.progressScore) return false;
                      const status = getTrafficLightStatus(c.progressScore, c.scoringThresholds || getDefaultThresholds('lifestyle'));
                      return status === 'red';
                    }).length}
                  </div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Red status</div>
                </div>
              </div>

              {/* Overdue Check-ins Card */}
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b-2" style={{ backgroundColor: '#fff7ed', borderColor: '#FF9500' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-10 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FF9500' }}>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 truncate">Overdue</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    {clientsWithMetrics.reduce((sum, c) => sum + (c.overdueCheckIns || 0), 0)}
                  </div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Check-ins overdue</div>
                </div>
              </div>

              {/* Avg Progress Score Card */}
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b-2 border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-10 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 truncate">Avg Progress</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    {(() => {
                      const activeClients = clientsWithMetrics.filter(c => c.status !== 'archived');
                      const clientsWithScores = activeClients.filter(c => c.progressScore !== undefined);
                      if (clientsWithScores.length === 0) return 0;
                      const totalScore = clientsWithScores.reduce((sum, c) => sum + (c.progressScore || 0), 0);
                      return Math.round(totalScore / clientsWithScores.length);
                    })()}%
                  </div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Average score</div>
                </div>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
                {/* Search Bar */}
                <div className="flex-1 w-full md:max-w-md">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 text-sm min-h-[44px]"
                      style={{ focusRingColor: '#daa450' }}
                    />
                  </div>
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
                  <span className="text-xs sm:text-sm text-gray-600 font-medium sm:whitespace-nowrap">Filter:</span>
                  <div className="flex bg-gray-100 rounded-2xl p-1 overflow-x-auto">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap min-h-[44px] flex items-center justify-center ${
                        statusFilter === 'all'
                          ? 'bg-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                      style={statusFilter === 'all' ? { color: '#daa450' } : {}}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setStatusFilter('active')}
                      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap min-h-[44px] flex items-center justify-center ${
                        statusFilter === 'active'
                          ? 'bg-white text-[#34C759] shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => setStatusFilter('needsAttention')}
                      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap min-h-[44px] flex items-center justify-center ${
                        statusFilter === 'needsAttention'
                          ? 'bg-white text-[#FF3B30] shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      Needs Attention
                    </button>
                    <button
                      onClick={() => setStatusFilter('archived')}
                      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap min-h-[44px] flex items-center justify-center ${
                        statusFilter === 'archived'
                          ? 'bg-white text-gray-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      Archived
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Inventory Table */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden mb-6 lg:mb-8">
              <div className="px-4 py-3 sm:px-6 sm:py-4 lg:px-10 lg:py-8 border-b-2 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Client Inventory</h2>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <span className="text-xs sm:text-sm text-gray-600">
                      {filteredClients.length} {statusFilter === 'needsAttention' ? 'need attention' : statusFilter === 'archived' ? 'archived clients' : 'total clients'}
                    </span>
                    <div className="flex items-center gap-2">
                      {/* Filter Presets */}
                      {filterPresets.length > 0 && (
                        <div className="relative">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                const preset = filterPresets.find(p => p.id === e.target.value);
                                if (preset) loadFilterPreset(preset);
                              }
                            }}
                            className="px-3 py-2 border border-gray-200 rounded-2xl text-xs sm:text-sm bg-white min-h-[44px]"
                            defaultValue=""
                          >
                            <option value="">Load Preset...</option>
                            {filterPresets.map(preset => (
                              <option key={preset.id} value={preset.id}>{preset.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button
                        onClick={() => setShowPresetModal(true)}
                        className="px-3 py-2 border border-gray-200 rounded-2xl text-xs sm:text-sm bg-white hover:bg-gray-50 min-h-[44px] flex items-center gap-1"
                        title="Save current filter as preset"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        Save Preset
                      </button>
                      {/* Export Button */}
                      <div className="relative">
                        <button
                          onClick={() => setExportMenuOpen(!exportMenuOpen)}
                          className="px-3 py-2 border border-gray-200 rounded-2xl text-xs sm:text-sm bg-white hover:bg-gray-50 min-h-[44px] flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Export
                        </button>
                        {exportMenuOpen && (
                          <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                            <button
                              onClick={() => handleExport(undefined, 'csv')}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              Export to CSV
                            </button>
                            <button
                              onClick={() => handleExport(undefined, 'pdf')}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              Export to PDF
                            </button>
                            <button
                              onClick={() => handleExport(undefined, 'excel')}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              Export to Excel
                            </button>
                          </div>
                        )}
                      </div>
                      <select
                        value={`${clientTableSortBy}-${clientTableSortOrder}`}
                        onChange={(e) => {
                          const [sortBy, sortOrder] = e.target.value.split('-') as [string, 'asc' | 'desc'];
                          setClientTableSortBy(sortBy);
                          setClientTableSortOrder(sortOrder);
                        }}
                        className="px-3 py-2 border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 bg-white min-h-[44px]"
                        style={{ focusRingColor: '#daa450' }}
                      >
                        <option value="name-asc">Name A-Z</option>
                        <option value="name-desc">Name Z-A</option>
                        <option value="weeks-asc">Weeks (Low to High)</option>
                        <option value="weeks-desc">Weeks (High to Low)</option>
                        <option value="score-asc">Score (Low to High)</option>
                        <option value="score-desc">Score (High to Low)</option>
                        <option value="status-asc">Status A-Z</option>
                        <option value="status-desc">Status Z-A</option>
                        <option value="lastCheckIn-desc">Last Check-in (Recent)</option>
                        <option value="lastCheckIn-asc">Last Check-in (Oldest)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              {/* Bulk Action Toolbar */}
              {selectedClients.size > 0 && (
                <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      {selectedClients.size} client{selectedClients.size > 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={clearSelection}
                      className="text-xs text-gray-600 hover:text-gray-900 underline"
                    >
                      Clear selection
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setBulkActionMenuOpen(!bulkActionMenuOpen)}
                        disabled={bulkActionLoading}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        Bulk Actions
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {bulkActionMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                          <button
                            onClick={() => handleBulkAction('email')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Send Email
                          </button>
                          <button
                            onClick={() => handleBulkAction('status')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Update Status
                          </button>
                          <button
                            onClick={() => handleBulkAction('archive')}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            Archive
                          </button>
                          <button
                            onClick={() => handleExport(Array.from(selectedClients), 'csv')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-t border-gray-200"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export Selected
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">
                        <input
                          type="checkbox"
                          checked={selectedClients.size === filteredClients.length && filteredClients.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                        />
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Progress</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Trend</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Weeks</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Avg Score</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Engagement</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Last Check-in</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Calculate weeks on program and sort clients
                      const clientsWithWeeks = filteredClients.map(client => {
                        // Use joinDate if available, otherwise fall back to createdAt
                        let startDate: Date;
                        try {
                          const dateToUse = (client as any).joinDate || client.createdAt;
                          if (dateToUse) {
                            if (typeof dateToUse === 'string') {
                              startDate = new Date(dateToUse);
                            } else if (dateToUse.seconds || dateToUse._seconds) {
                              startDate = new Date((dateToUse.seconds || dateToUse._seconds) * 1000);
                            } else if (dateToUse.toDate && typeof dateToUse.toDate === 'function') {
                              startDate = dateToUse.toDate();
                            } else {
                              startDate = new Date(dateToUse);
                            }
                          } else {
                            // If no date found, use current date (will show 0 weeks)
                            startDate = new Date();
                          }
                          
                          // Validate the date
                          if (isNaN(startDate.getTime())) {
                            startDate = new Date();
                          }
                        } catch {
                          startDate = new Date();
                        }
                        
                        const now = new Date();
                        const timeDiff = now.getTime() - startDate.getTime();
                        const weeksOnProgram = isNaN(timeDiff) ? 0 : Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 7)));
                        
                        let lastCheckInDate: Date | null = null;
                        if (client.lastCheckIn) {
                          try {
                            if (typeof client.lastCheckIn === 'string') {
                              lastCheckInDate = new Date(client.lastCheckIn);
                            } else if (client.lastCheckIn.seconds) {
                              lastCheckInDate = new Date(client.lastCheckIn.seconds * 1000);
                            } else {
                              lastCheckInDate = new Date(client.lastCheckIn);
                            }
                            if (isNaN(lastCheckInDate.getTime())) {
                              lastCheckInDate = null;
                            }
                          } catch {
                            lastCheckInDate = null;
                          }
                        }
                        
                        return {
                          ...client,
                          weeksOnProgram: isNaN(weeksOnProgram) ? 0 : weeksOnProgram,
                          displayName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown',
                          lastCheckInDate
                        };
                      });

                      // Sort clients
                      const sortedClients = [...clientsWithWeeks].sort((a, b) => {
                        let aValue: any, bValue: any;
                        
                        switch (clientTableSortBy) {
                          case 'name':
                            aValue = a.displayName.toLowerCase();
                            bValue = b.displayName.toLowerCase();
                            break;
                          case 'weeks':
                            aValue = a.weeksOnProgram;
                            bValue = b.weeksOnProgram;
                            break;
                          case 'score':
                            aValue = a.progressScore || 0;
                            bValue = b.progressScore || 0;
                            break;
                          case 'status':
                            aValue = a.status || 'unknown';
                            bValue = b.status || 'unknown';
                            break;
                          case 'lastCheckIn':
                            aValue = a.lastCheckInDate ? a.lastCheckInDate.getTime() : 0;
                            bValue = b.lastCheckInDate ? b.lastCheckInDate.getTime() : 0;
                            break;
                          default:
                            return 0;
                        }
                        
                        if (aValue < bValue) return clientTableSortOrder === 'asc' ? -1 : 1;
                        if (aValue > bValue) return clientTableSortOrder === 'asc' ? 1 : -1;
                        return 0;
                      });

                      if (sortedClients.length === 0) {
                        return (
                          <tr>
                            <td colSpan={10} className="px-4 py-8 text-center">
                              <div className="text-gray-500">
                                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                                <p className="text-lg font-medium">No clients found</p>
                                <p className="text-sm mt-1">Add your first client to get started</p>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const formatTimeAgo = (timestamp: string) => {
                        const now = new Date();
                        const time = new Date(timestamp);
                        const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
                        
                        if (diffInHours < 1) return 'Just now';
                        if (diffInHours < 24) return `${diffInHours}h ago`;
                        const diffInDays = Math.floor(diffInHours / 24);
                        return `${diffInDays}d ago`;
                      };

                      const getStatusBadge = (status: string) => {
                        const statusLower = status?.toLowerCase() || 'active';
                        const statusConfig: { [key: string]: { label: string; className: string } } = {
                          active: {
                            label: 'Active',
                            className: 'bg-green-100 text-green-800 border-green-200'
                          },
                          pending: {
                            label: 'Pending',
                            className: 'bg-orange-100 text-orange-800 border-orange-200'
                          },
                          inactive: {
                            label: 'Inactive',
                            className: 'bg-gray-100 text-gray-800 border-gray-200'
                          },
                          paused: {
                            label: 'Paused',
                            className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
                          },
                          completed: {
                            label: 'Completed',
                            className: 'bg-blue-100 text-blue-800 border-blue-200'
                          },
                          archived: {
                            label: 'Archived',
                            className: 'bg-gray-100 text-gray-600 border-gray-300'
                          }
                        };
                        
                        const config = statusConfig[statusLower] || statusConfig.active;
                        return (
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${config.className}`}>
                            {config.label}
                          </span>
                        );
                      };

                      return sortedClients.map((client) => {
                        const score = typeof client.progressScore === 'number' && !isNaN(client.progressScore) ? client.progressScore : 0;
                        const completionRate = typeof client.completionRate === 'number' && !isNaN(client.completionRate) ? client.completionRate : 0;
                        const totalCheckIns = typeof client.totalCheckIns === 'number' && !isNaN(client.totalCheckIns) ? client.totalCheckIns : 0;
                        const completedCheckIns = typeof client.completedCheckIns === 'number' && !isNaN(client.completedCheckIns) ? client.completedCheckIns : 0;
                        const weeksOnProgram = typeof client.weeksOnProgram === 'number' && !isNaN(client.weeksOnProgram) ? client.weeksOnProgram : 0;
                        
                        // Get traffic light status
                        const thresholds = client.scoringThresholds || getDefaultThresholds('lifestyle');
                        const trafficLightStatus = score > 0 
                          ? getTrafficLightStatus(score, thresholds)
                          : null;
                        
                        // Determine if client needs attention (for background highlighting only, badge removed)
                        const hasOverdue = (client.overdueCheckIns || 0) > 0;
                        const daysSinceLastCheckIn = client.daysSinceLastCheckIn;
                        const needsAttention = hasOverdue || 
                          (daysSinceLastCheckIn !== undefined && daysSinceLastCheckIn > 7) ||
                          trafficLightStatus === 'red' ||
                          (completionRate < 50 && totalCheckIns > 0);
                        
                        return (
                          <tr 
                            key={client.id} 
                            className={`hover:bg-gray-50 transition-colors ${
                              needsAttention ? 'bg-red-50/30' : ''
                            }`}
                          >
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-semibold text-xs mr-2">
                                  {client.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-medium text-gray-900 truncate">{client.displayName}</div>
                                    {getStatusBadge(client.status || 'active')}
                                  </div>
                                  {client.phone && (
                                    <div className="text-xs text-gray-500">{client.phone}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-center">
                              {trafficLightStatus ? (
                                <div className="flex flex-col items-center">
                                  <div className="text-xl mb-0.5">
                                    {getTrafficLightIcon(trafficLightStatus)}
                                  </div>
                                  <span className={`text-[10px] font-medium ${
                                    trafficLightStatus === 'red' ? 'text-red-600' :
                                    trafficLightStatus === 'orange' ? 'text-orange-600' : 'text-green-600'
                                  }`}>
                                    {trafficLightStatus.charAt(0).toUpperCase() + trafficLightStatus.slice(1)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-center">
                              {client.recentCheckIns && client.recentCheckIns.length > 0 ? (
                                <div className="flex items-center justify-center gap-0.5" title={client.recentCheckIns.map((ci, idx) => 
                                  `Check-in ${idx + 1}: ${ci.score}% (${ci.trafficLightStatus}) - ${new Date(ci.completedAt).toLocaleDateString()}`
                                ).join('\n')}>
                                  {client.recentCheckIns.map((ci, idx) => (
                                    <div key={ci.id || idx} className="text-lg" title={`${ci.score}% - ${new Date(ci.completedAt).toLocaleDateString()}`}>
                                      {getTrafficLightIcon(ci.trafficLightStatus)}
                                    </div>
                                  ))}
                                  {/* Fill remaining slots if less than 4 */}
                                  {Array.from({ length: 4 - client.recentCheckIns.length }).map((_, idx) => (
                                    <div key={`empty-${idx}`} className="text-lg text-gray-300">
                                      ⚪
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-center">
                              <div className="text-sm font-medium text-gray-900">{isNaN(weeksOnProgram) ? '0' : String(weeksOnProgram)}</div>
                              <div className="text-[10px] text-gray-500">weeks</div>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-center">
                              <div className={`text-sm font-bold ${
                                score >= 80 ? 'text-green-600' :
                                score >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {score > 0 && !isNaN(score) ? `${score}%` : 'N/A'}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-center">
                              <div className="flex flex-col items-center">
                                <div className="text-xs font-semibold text-gray-900 mb-1">
                                  {totalCheckIns > 0 
                                    ? `${completedCheckIns || 0}/${totalCheckIns}`
                                    : '0/0'
                                  }
                                </div>
                                <div className="text-[10px] text-gray-600 mb-1.5">
                                  ({isNaN(completionRate) ? '0' : String(completionRate)}%)
                                </div>
                                <div className="w-16 bg-gray-200 rounded-full h-1.5 mx-auto">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all ${
                                      completionRate >= 80 ? 'bg-green-500' :
                                      completionRate >= 60 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(isNaN(completionRate) ? 0 : completionRate, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              {client.lastCheckInDate ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    {client.lastCheckInTrafficLight && (
                                      <div className="text-base" title={`Score: ${client.lastCheckInScore}%`}>
                                        {getTrafficLightIcon(client.lastCheckInTrafficLight)}
                                      </div>
                                    )}
                                    <div className="text-xs text-gray-900">
                                      {client.lastCheckInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                  </div>
                                  <div className="flex items-center flex-wrap gap-1 mt-0.5">
                                    <span className="text-[10px] text-gray-500">
                                      {formatTimeAgo(client.lastCheckInDate.toISOString())}
                                    </span>
                                    {daysSinceLastCheckIn !== undefined && !isNaN(daysSinceLastCheckIn) && (
                                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                                        daysSinceLastCheckIn > 14 ? 'bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20' :
                                        daysSinceLastCheckIn > 7 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                        'bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20'
                                      }`}>
                                        {daysSinceLastCheckIn === 0 ? 'Today' :
                                         daysSinceLastCheckIn === 1 ? '1 day ago' :
                                         `${daysSinceLastCheckIn} days ago`}
                                      </span>
                                    )}
                                    {hasOverdue && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20">
                                        {client.overdueCheckIns} overdue
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span className="text-xs text-gray-400">Never</span>
                                  {hasOverdue && (
                                    <div className="mt-0.5">
                                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20">
                                        {client.overdueCheckIns} overdue
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                <Link
                                  href={`/clients/${client.id}/progress`}
                                  className="text-orange-600 hover:text-orange-700 text-xs font-medium"
                                >
                                  View →
                                </Link>
                                {client.status === 'archived' && (
                                  <button
                                    onClick={() => handleDeleteClient(client.id)}
                                    disabled={deletingClient === client.id}
                                    className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Permanently delete this archived client"
                                  >
                                    {deletingClient === client.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="lg:hidden space-y-3 p-4">
                {(() => {
                  // Calculate weeks on program and sort clients (same logic as desktop)
                  const clientsWithWeeks = filteredClients.map(client => {
                    let startDate: Date;
                    try {
                      const dateToUse = (client as any).joinDate || client.createdAt;
                      if (dateToUse) {
                        if (typeof dateToUse === 'string') {
                          startDate = new Date(dateToUse);
                        } else if (dateToUse.seconds || dateToUse._seconds) {
                          startDate = new Date((dateToUse.seconds || dateToUse._seconds) * 1000);
                        } else if (dateToUse.toDate && typeof dateToUse.toDate === 'function') {
                          startDate = dateToUse.toDate();
                        } else {
                          startDate = new Date(dateToUse);
                        }
                      } else {
                        startDate = new Date();
                      }
                      if (isNaN(startDate.getTime())) {
                        startDate = new Date();
                      }
                    } catch {
                      startDate = new Date();
                    }
                    
                    const now = new Date();
                    const timeDiff = now.getTime() - startDate.getTime();
                    const weeksOnProgram = isNaN(timeDiff) ? 0 : Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 7)));
                    
                    let lastCheckInDate: Date | null = null;
                    if (client.lastCheckIn) {
                      try {
                        if (typeof client.lastCheckIn === 'string') {
                          lastCheckInDate = new Date(client.lastCheckIn);
                        } else if (client.lastCheckIn.seconds) {
                          lastCheckInDate = new Date(client.lastCheckIn.seconds * 1000);
                        } else {
                          lastCheckInDate = new Date(client.lastCheckIn);
                        }
                        if (isNaN(lastCheckInDate.getTime())) {
                          lastCheckInDate = null;
                        }
                      } catch {
                        lastCheckInDate = null;
                      }
                    }
                    
                    return {
                      ...client,
                      weeksOnProgram: isNaN(weeksOnProgram) ? 0 : weeksOnProgram,
                      displayName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown',
                      lastCheckInDate
                    };
                  });

                  // Sort clients (same logic as desktop)
                  const sortedClients = [...clientsWithWeeks].sort((a, b) => {
                    let aValue: any, bValue: any;
                    switch (clientTableSortBy) {
                      case 'name':
                        aValue = a.displayName.toLowerCase();
                        bValue = b.displayName.toLowerCase();
                        break;
                      case 'weeks':
                        aValue = a.weeksOnProgram;
                        bValue = b.weeksOnProgram;
                        break;
                      case 'score':
                        aValue = a.progressScore || 0;
                        bValue = b.progressScore || 0;
                        break;
                      case 'status':
                        aValue = a.status || 'unknown';
                        bValue = b.status || 'unknown';
                        break;
                      case 'lastCheckIn':
                        aValue = a.lastCheckInDate ? a.lastCheckInDate.getTime() : 0;
                        bValue = b.lastCheckInDate ? b.lastCheckInDate.getTime() : 0;
                        break;
                      default:
                        return 0;
                    }
                    if (aValue < bValue) return clientTableSortOrder === 'asc' ? -1 : 1;
                    if (aValue > bValue) return clientTableSortOrder === 'asc' ? 1 : -1;
                    return 0;
                  });

                  if (sortedClients.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                          <p className="text-base font-medium">No clients found</p>
                          <p className="text-sm mt-1">Add your first client to get started</p>
                        </div>
                      </div>
                    );
                  }

                  const formatTimeAgo = (timestamp: string) => {
                    const now = new Date();
                    const time = new Date(timestamp);
                    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
                    if (diffInHours < 1) return 'Just now';
                    if (diffInHours < 24) return `${diffInHours}h ago`;
                    const diffInDays = Math.floor(diffInHours / 24);
                    return `${diffInDays}d ago`;
                  };

                  const getStatusBadge = (status: string) => {
                    const statusLower = status?.toLowerCase() || 'active';
                    const statusConfig: { [key: string]: { label: string; className: string } } = {
                      active: {
                        label: 'Active',
                        className: 'bg-green-100 text-green-800 border-green-200'
                      },
                      pending: {
                        label: 'Pending',
                        className: 'bg-orange-100 text-orange-800 border-orange-200'
                      },
                      inactive: {
                        label: 'Inactive',
                        className: 'bg-gray-100 text-gray-800 border-gray-200'
                      },
                      paused: {
                        label: 'Paused',
                        className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      },
                      completed: {
                        label: 'Completed',
                        className: 'bg-blue-100 text-blue-800 border-blue-200'
                      },
                      archived: {
                        label: 'Archived',
                        className: 'bg-gray-100 text-gray-600 border-gray-300'
                      }
                    };
                    
                    const config = statusConfig[statusLower] || statusConfig.active;
                    return (
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${config.className}`}>
                        {config.label}
                      </span>
                    );
                  };

                  return sortedClients.map((client) => {
                    const score = typeof client.progressScore === 'number' && !isNaN(client.progressScore) ? client.progressScore : 0;
                    const completionRate = typeof client.completionRate === 'number' && !isNaN(client.completionRate) ? client.completionRate : 0;
                    const totalCheckIns = typeof client.totalCheckIns === 'number' && !isNaN(client.totalCheckIns) ? client.totalCheckIns : 0;
                    const completedCheckIns = typeof client.completedCheckIns === 'number' && !isNaN(client.completedCheckIns) ? client.completedCheckIns : 0;
                    const weeksOnProgram = typeof client.weeksOnProgram === 'number' && !isNaN(client.weeksOnProgram) ? client.weeksOnProgram : 0;
                    
                    const thresholds = client.scoringThresholds || getDefaultThresholds('lifestyle');
                    const trafficLightStatus = score > 0 
                      ? getTrafficLightStatus(score, thresholds)
                      : null;
                    
                    const hasOverdue = (client.overdueCheckIns || 0) > 0;
                    const daysSinceLastCheckIn = client.daysSinceLastCheckIn;
                    const needsAttention = hasOverdue || 
                      (daysSinceLastCheckIn !== undefined && daysSinceLastCheckIn > 7) ||
                      trafficLightStatus === 'red' ||
                      (completionRate < 50 && totalCheckIns > 0);
                    
                    return (
                      <Link
                        key={client.id}
                        href={`/clients/${client.id}`}
                        className={`block bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-4 transition-all ${
                          needsAttention ? 'bg-red-50/30 border-red-100' : 'hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {client.displayName.charAt(0).toUpperCase()}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-semibold text-gray-900 truncate">{client.displayName}</h3>
                                  {getStatusBadge(client.status || 'active')}
                                </div>
                                {client.phone && (
                                  <p className="text-xs text-gray-500 mt-0.5">{client.phone}</p>
                                )}
                              </div>
                              {trafficLightStatus && (
                                <div className="flex-shrink-0">
                                  <div className="text-2xl">
                                    {getTrafficLightIcon(trafficLightStatus)}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              {/* Weeks */}
                              <div className="bg-gray-50 rounded-lg p-2">
                                <div className="text-[10px] text-gray-500 mb-0.5">Weeks</div>
                                <div className="text-sm font-semibold text-gray-900">{weeksOnProgram}</div>
                              </div>
                              
                              {/* Avg Score */}
                              <div className="bg-gray-50 rounded-lg p-2">
                                <div className="text-[10px] text-gray-500 mb-0.5">Avg Score</div>
                                <div className={`text-sm font-semibold ${
                                  score >= 80 ? 'text-green-600' :
                                  score >= 60 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {score > 0 && !isNaN(score) ? `${score}%` : 'N/A'}
                                </div>
                              </div>
                              
                              {/* Engagement */}
                              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-2.5 col-span-2 border border-green-200">
                                <div className="text-[10px] font-medium text-green-700 mb-1.5 uppercase tracking-wide">Engagement</div>
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="text-sm font-bold text-gray-900">
                                    {totalCheckIns > 0 
                                      ? `${completedCheckIns || 0}/${totalCheckIns}`
                                      : '0/0'
                                    }
                                  </div>
                                  <div className="text-xs font-semibold text-green-700">
                                    ({isNaN(completionRate) ? '0' : String(completionRate)}%)
                                  </div>
                                </div>
                                <div className="w-full bg-green-200 rounded-full h-2 overflow-hidden">
                                  <div 
                                    className={`h-2 rounded-full transition-all ${
                                      completionRate >= 80 ? 'bg-green-600' :
                                      completionRate >= 60 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(isNaN(completionRate) ? 0 : completionRate, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Recent Trend & Last Check-in */}
                            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500">Trend:</span>
                                {client.recentCheckIns && client.recentCheckIns.length > 0 ? (
                                  <div className="flex items-center gap-1">
                                    {client.recentCheckIns.map((ci, idx) => (
                                      <div key={ci.id || idx} className="text-base">
                                        {getTrafficLightIcon(ci.trafficLightStatus)}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1.5">
                                {client.lastCheckInTrafficLight && (
                                  <div className="text-base">
                                    {getTrafficLightIcon(client.lastCheckInTrafficLight)}
                                  </div>
                                )}
                                <div className="text-[10px] text-gray-500">
                                  {client.lastCheckInDate 
                                    ? formatTimeAgo(client.lastCheckInDate.toISOString())
                                    : 'Never'
                                  }
                                </div>
                              </div>
                            </div>
                            
                            {/* Badges */}
                            {(hasOverdue || daysSinceLastCheckIn !== undefined) && (
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {hasOverdue && (
                                  <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20">
                                    {client.overdueCheckIns} overdue
                                  </span>
                                )}
                                {daysSinceLastCheckIn !== undefined && !isNaN(daysSinceLastCheckIn) && (
                                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                    daysSinceLastCheckIn > 14 ? 'bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20' :
                                    daysSinceLastCheckIn > 7 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                    'bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20'
                                  }`}>
                                    {daysSinceLastCheckIn === 0 ? 'Today' :
                                     daysSinceLastCheckIn === 1 ? '1 day ago' :
                                     `${daysSinceLastCheckIn} days ago`}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="lg:hidden mt-4 px-4">
            <CoachNavigation />
          </div>
        </div>
      </div>

      {/* Filter Preset Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPresetModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Save Filter Preset</h3>
                <button onClick={() => setShowPresetModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Preset Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., Active Clients, Needs Attention"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveFilterPreset();
                    if (e.key === 'Escape') setShowPresetModal(false);
                  }}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={saveFilterPreset}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
                >
                  Save Preset
                </button>
                <button
                  onClick={() => { setShowPresetModal(false); setPresetName(''); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Update Client Status
                </h3>
                <button
                  onClick={() => setStatusModal(null)}
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
                  Status
                </label>
                <select
                  value={statusModal.status}
                  onChange={(e) => setStatusModal({ 
                    ...statusModal, 
                    status: e.target.value,
                    pausedUntil: e.target.value !== 'paused' ? undefined : statusModal.pausedUntil
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {statusModal.status === 'paused' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Paused Until
                  </label>
                  <input
                    type="date"
                    value={statusModal.pausedUntil ? (typeof statusModal.pausedUntil === 'string' ? statusModal.pausedUntil.split('T')[0] : new Date(statusModal.pausedUntil).toISOString().split('T')[0]) : ''}
                    onChange={(e) => setStatusModal({ ...statusModal, pausedUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Client will automatically resume on this date
                  </p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setStatusModal(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setUpdatingStatus(statusModal.clientId);
                    try {
                      const response = await fetch(`/api/clients/${statusModal.clientId}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          status: statusModal.status,
                          pausedUntil: statusModal.status === 'paused' && statusModal.pausedUntil ? statusModal.pausedUntil : null,
                          statusUpdatedAt: new Date().toISOString()
                        }),
                      });

                      if (response.ok) {
                        // Update local state
                        setClients(clients.map(c => 
                          c.id === statusModal.clientId 
                            ? { ...c, status: statusModal.status as any, pausedUntil: statusModal.pausedUntil }
                            : c
                        ));
                        setStatusModal(null);
                      } else {
                        alert('Failed to update status');
                      }
                    } catch (error) {
                      console.error('Error updating status:', error);
                      alert('Error updating status');
                    } finally {
                      setUpdatingStatus(null);
                    }
                  }}
                  disabled={updatingStatus === statusModal.clientId || (statusModal.status === 'paused' && !statusModal.pausedUntil)}
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-medium transition-all duration-200 shadow-sm disabled:opacity-50"
                >
                  {updatingStatus === statusModal.clientId ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </RoleProtected>
  );
} 