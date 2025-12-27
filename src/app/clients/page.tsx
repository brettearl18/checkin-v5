'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import {
  getTrafficLightStatus,
  getTrafficLightIcon,
  getTrafficLightColor,
  getDefaultThresholds,
  type ScoringThresholds,
  type TrafficLightStatus
} from '@/lib/scoring-utils';

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

  useEffect(() => {
    if (userProfile?.uid) {
      fetchClients();
    } else if (userProfile === null) {
      // User profile is loaded but user is not authenticated
      setLoading(false);
    }
  }, [userProfile]);

  const fetchClients = async () => {
    try {
      if (!userProfile?.uid) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/clients?coachId=${userProfile.uid}`);
      if (response.ok) {
        const data = await response.json();
        const clientsData = data.clients || [];
        setClients(clientsData);
        
        // Fetch additional metrics for each client
        const clientsWithMetricsData = await Promise.all(
          clientsData.map(async (client: Client) => {
            try {
              // Fetch check-ins for this client
              const checkInsResponse = await fetch(`/api/clients/${client.id}/check-ins`);
              if (checkInsResponse.ok) {
                const checkInsData = await checkInsResponse.json();
                const checkIns = checkInsData.checkIns || [];
                
                // Calculate overdue check-ins
                const now = new Date();
                const overdueCount = checkIns.filter((ci: any) => {
                  if (ci.status === 'completed') return false;
                  if (!ci.dueDate) return false;
                  const dueDate = new Date(ci.dueDate);
                  return dueDate < now;
                }).length;
                
                // Calculate days since last check-in
                let daysSinceLastCheckIn: number | undefined;
                if (client.lastCheckIn) {
                  const lastCheckInDate = new Date(client.lastCheckIn);
                  const diffTime = now.getTime() - lastCheckInDate.getTime();
                  daysSinceLastCheckIn = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                }
                
                // Get scoring thresholds (default to lifestyle for now)
                const thresholds = getDefaultThresholds('lifestyle');
                
                return {
                  ...client,
                  overdueCheckIns: overdueCount,
                  daysSinceLastCheckIn,
                  scoringThresholds: thresholds,
                  ...checkInsData.metrics
                };
              }
            } catch (error) {
              console.error(`Error fetching metrics for client ${client.id}:`, error);
            }
            
            // Return client with default values if fetch fails
            return {
              ...client,
              overdueCheckIns: 0,
              daysSinceLastCheckIn: client.lastCheckIn ? Math.floor((Date.now() - new Date(client.lastCheckIn).getTime()) / (1000 * 60 * 60 * 24)) : undefined,
              scoringThresholds: getDefaultThresholds('lifestyle')
            };
          })
        );
        
        setClientsWithMetrics(clientsWithMetricsData);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (confirm('Are you sure you want to delete this client?')) {
      try {
        const response = await fetch(`/api/clients/${clientId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setClients(clients.filter(client => client.id !== clientId));
        }
      } catch (error) {
        console.error('Error deleting client:', error);
      }
    }
  };

  const filteredClients = (clientsWithMetrics.length > 0 ? clientsWithMetrics : clients).filter(client => {
    const matchesSearch = (client.firstName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (client.lastName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (client.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'needsAttention') {
      // Filter for clients that need attention
      const hasOverdue = (client.overdueCheckIns || 0) > 0;
      const lowScore = client.progressScore !== undefined && client.progressScore < 60;
      const noActivity = client.daysSinceLastCheckIn !== undefined && client.daysSinceLastCheckIn > 7;
      const lowCompletion = (client.completionRate || 0) < 50;
      const trafficLight = client.progressScore !== undefined 
        ? getTrafficLightStatus(client.progressScore, client.scoringThresholds || getDefaultThresholds('lifestyle'))
        : null;
      const isRedOrOrange = trafficLight === 'red' || trafficLight === 'orange';
      
      return matchesSearch && (hasOverdue || lowScore || noActivity || lowCompletion || isRedOrOrange);
    }
    
    // Handle archived clients separately - don't show them unless archive filter is selected
    if (client.status === 'archived' && statusFilter !== 'archived') {
      return false;
    }
    
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex">
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex">
        {/* Modern Sidebar */}
        <div className="w-64 bg-white shadow-xl border-r border-gray-100">
          {/* Sidebar Header */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-6 py-8">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Coach Hub</h1>
                <p className="text-blue-100 text-sm">Clients</p>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="px-4 py-6">
            <div className="space-y-2">
              {/* Dashboard */}
              <Link
                href="/dashboard"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                  </svg>
                </div>
                <span>Dashboard</span>
              </Link>

              {/* Clients - HIGHLIGHTED */}
              <Link
                href="/clients"
                className="flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-xl font-medium transition-all duration-200 shadow-sm border border-blue-100"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <span>Clients</span>
              </Link>

              {/* Messages */}
              <Link
                href="/messages"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span>Messages</span>
              </Link>

              {/* Check-ins */}
              <Link
                href="/check-ins"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span>Check-ins</span>
              </Link>

              {/* Responses */}
              <Link
                href="/responses"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span>Responses</span>
              </Link>

              {/* Analytics */}
              <Link
                href="/analytics"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span>Analytics</span>
              </Link>

              {/* Forms */}
              <Link
                href="/forms"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span>Forms</span>
              </Link>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-gray-200"></div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <h3 className="px-4 text-sm font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</h3>
              
              <Link
                href="/clients/create"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:text-green-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <span>Add Client</span>
              </Link>

              <Link
                href="/forms/create"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:text-purple-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <span>Create Form</span>
              </Link>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-gray-200"></div>

            {/* User Profile */}
            <div className="px-4">
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {userProfile?.firstName?.charAt(0) || 'C'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {userProfile?.firstName} {userProfile?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">Coach</p>
                </div>
                <button
                  onClick={logout}
                  className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center hover:bg-red-200 transition-colors"
                >
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Modern Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Clients
                  </h1>
                  <p className="text-gray-600 mt-2 text-lg">Manage your client relationships and track their progress</p>
                </div>
                <Link
                  href="/clients/create"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Add New Client
                </Link>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-500">Total Clients</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">{clients.length}</div>
                  <div className="text-sm text-gray-500 mt-1">All clients</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-500">Active Clients</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">
                    {clients.filter(c => c.status === 'active').length}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Currently active</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-50 to-red-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-500">Pending Clients</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">
                    {clients.filter(c => c.status === 'pending').length}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Awaiting approval</div>
                </div>
              </div>

              {/* At-Risk Clients Card */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-pink-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-500">At-Risk</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">
                    {clientsWithMetrics.filter(c => {
                      // Exclude archived clients
                      if (c.status === 'archived') return false;
                      if (!c.progressScore) return false;
                      const status = getTrafficLightStatus(c.progressScore, c.scoringThresholds || getDefaultThresholds('lifestyle'));
                      return status === 'red';
                    }).length}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Red status</div>
                </div>
              </div>

              {/* Overdue Check-ins Card */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-500">Overdue</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">
                    {clientsWithMetrics.reduce((sum, c) => sum + (c.overdueCheckIns || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Check-ins overdue</div>
                </div>
              </div>

              {/* Avg Progress Score Card */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-500">Avg Progress</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900">
                    {(() => {
                      // Filter out archived clients from the calculation
                      const activeClients = clientsWithMetrics.filter(c => c.status !== 'archived');
                      const clientsWithScores = activeClients.filter(c => c.progressScore !== undefined);
                      
                      if (clientsWithScores.length === 0) return 0;
                      
                      const totalScore = clientsWithScores.reduce((sum, c) => sum + (c.progressScore || 0), 0);
                      return Math.round(totalScore / clientsWithScores.length);
                    })()}%
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Average score</div>
                </div>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
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
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                </div>

                {/* Filter Buttons */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 font-medium">Filter:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        statusFilter === 'all'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setStatusFilter('active')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        statusFilter === 'active'
                          ? 'bg-white text-green-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => setStatusFilter('needsAttention')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        statusFilter === 'needsAttention'
                          ? 'bg-white text-red-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Needs Attention
                    </button>
                    <button
                      onClick={() => setStatusFilter('archived')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        statusFilter === 'archived'
                          ? 'bg-white text-slate-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Archived
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Inventory Table */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Client Inventory</h2>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600">
                      {filteredClients.length} {statusFilter === 'needsAttention' ? 'need attention' : statusFilter === 'archived' ? 'archived clients' : 'total clients'}
                    </span>
                    <select
                      value={`${clientTableSortBy}-${clientTableSortOrder}`}
                      onChange={(e) => {
                        const [sortBy, sortOrder] = e.target.value.split('-') as [string, 'asc' | 'desc'];
                        setClientTableSortBy(sortBy);
                        setClientTableSortOrder(sortOrder);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Weeks on Program</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Avg Score</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Completion Rate</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Check-ins</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Last Check-in</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Calculate weeks on program and sort clients
                      const clientsWithWeeks = filteredClients.map(client => {
                        let createdAt: Date;
                        try {
                          if (client.createdAt) {
                            if (typeof client.createdAt === 'string') {
                              createdAt = new Date(client.createdAt);
                            } else if (client.createdAt.seconds) {
                              createdAt = new Date(client.createdAt.seconds * 1000);
                            } else {
                              createdAt = new Date(client.createdAt);
                            }
                          } else {
                            createdAt = new Date();
                          }
                        } catch {
                          createdAt = new Date();
                        }
                        
                        const now = new Date();
                        const timeDiff = now.getTime() - createdAt.getTime();
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
                            <td colSpan={9} className="px-6 py-12 text-center">
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

                      return sortedClients.map((client) => {
                        const score = typeof client.progressScore === 'number' && !isNaN(client.progressScore) ? client.progressScore : 0;
                        const completionRate = typeof client.completionRate === 'number' && !isNaN(client.completionRate) ? client.completionRate : 0;
                        const totalCheckIns = typeof client.totalCheckIns === 'number' && !isNaN(client.totalCheckIns) ? client.totalCheckIns : 0;
                        const weeksOnProgram = typeof client.weeksOnProgram === 'number' && !isNaN(client.weeksOnProgram) ? client.weeksOnProgram : 0;
                        
                        // Get traffic light status
                        const thresholds = client.scoringThresholds || getDefaultThresholds('lifestyle');
                        const trafficLightStatus = score > 0 
                          ? getTrafficLightStatus(score, thresholds)
                          : null;
                        
                        // Determine if client needs attention
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
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm mr-3">
                                  {client.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <div className="text-sm font-medium text-gray-900">{client.displayName}</div>
                                    {needsAttention && (
                                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                        Needs Attention
                                      </span>
                                    )}
                                  </div>
                                  {client.phone && (
                                    <div className="text-xs text-gray-500">{client.phone}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{client.email || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {trafficLightStatus ? (
                                <div className="flex flex-col items-center">
                                  <div className="text-2xl mb-1">
                                    {getTrafficLightIcon(trafficLightStatus)}
                                  </div>
                                  <span className={`text-xs font-medium ${
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
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                client.status === 'active' ? 'bg-green-100 text-green-800' :
                                client.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                client.status === 'at-risk' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {client.status ? client.status.charAt(0).toUpperCase() + client.status.slice(1) : 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-sm font-medium text-gray-900">{isNaN(weeksOnProgram) ? '0' : String(weeksOnProgram)}</div>
                              <div className="text-xs text-gray-500">weeks</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className={`text-sm font-bold ${
                                score >= 80 ? 'text-green-600' :
                                score >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {score > 0 && !isNaN(score) ? `${score}%` : 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-sm font-medium text-gray-900">{isNaN(completionRate) ? '0' : String(completionRate)}%</div>
                              <div className="w-16 bg-gray-200 rounded-full h-1.5 mx-auto mt-1">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    completionRate >= 80 ? 'bg-green-500' :
                                    completionRate >= 60 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(isNaN(completionRate) ? 0 : completionRate, 100)}%` }}
                                ></div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-sm font-medium text-gray-900">{isNaN(totalCheckIns) ? '0' : String(totalCheckIns)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {client.lastCheckInDate ? (
                                <div>
                                  <div className="text-sm text-gray-900">
                                    {client.lastCheckInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </div>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-xs text-gray-500">
                                      {formatTimeAgo(client.lastCheckInDate.toISOString())}
                                    </span>
                                    {daysSinceLastCheckIn !== undefined && (
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                        daysSinceLastCheckIn > 14 ? 'bg-red-100 text-red-700' :
                                        daysSinceLastCheckIn > 7 ? 'bg-orange-100 text-orange-700' :
                                        'bg-green-100 text-green-700'
                                      }`}>
                                        {daysSinceLastCheckIn === 0 ? 'Today' :
                                         daysSinceLastCheckIn === 1 ? '1 day ago' :
                                         `${daysSinceLastCheckIn} days ago`}
                                      </span>
                                    )}
                                    {hasOverdue && (
                                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                        {client.overdueCheckIns} overdue
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span className="text-sm text-gray-400">Never</span>
                                  {hasOverdue && (
                                    <div className="mt-1">
                                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                        {client.overdueCheckIns} overdue
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <Link
                                href={`/clients/${client.id}`}
                                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                              >
                                View →
                              </Link>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
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