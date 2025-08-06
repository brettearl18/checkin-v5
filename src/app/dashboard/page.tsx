'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  email: string;
  status: string;
  lastCheckIn?: string;
  riskScore?: number;
}

interface CoachStats {
  totalClients: number;
  activeClients: number;
  totalForms: number;
  totalResponses: number;
  averageClientScore: number;
  recentCheckIns: number;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<CoachStats>({
    totalClients: 0,
    activeClients: 0,
    totalForms: 0,
    totalResponses: 0,
    averageClientScore: 0,
    recentCheckIns: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoachData = async () => {
      if (!user) return;

      try {
        // Fetch clients assigned to this coach
        const clientsQuery = query(
          collection(db, 'clients'),
          where('coachId', '==', user.uid)
        );
        
        const clientsSnapshot = await getDocs(clientsQuery);
        const clientsData: Client[] = [];
        
        clientsSnapshot.forEach((doc) => {
          const data = doc.data();
          clientsData.push({
            id: doc.id,
            name: data.name || 'Unknown Client',
            email: data.email || '',
            status: data.status || 'active',
            lastCheckIn: data.lastCheckIn,
            riskScore: data.riskScore || 0
          });
        });
        
        setClients(clientsData);

        // Fetch forms created by this coach
        const formsQuery = query(
          collection(db, 'forms'),
          where('createdBy', '==', user.uid)
        );
        const formsSnapshot = await getDocs(formsQuery);

        // Fetch responses for this coach's clients
        const clientIds = clientsData.map(c => c.id);
        let totalResponses = 0;
        let totalScore = 0;
        let recentCheckIns = 0;

        if (clientIds.length > 0) {
          const responsesQuery = query(
            collection(db, 'form_responses'),
            where('clientId', 'in', clientIds)
          );
          const responsesSnapshot = await getDocs(responsesQuery);
          
          responsesSnapshot.forEach((doc) => {
            const data = doc.data();
            totalResponses++;
            totalScore += data.score || 0;
            
            // Count recent check-ins (last 7 days)
            const checkInDate = data.submittedAt?.toDate?.() || new Date();
            const daysDiff = (Date.now() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 7) {
              recentCheckIns++;
            }
          });
        }

        const statsData: CoachStats = {
          totalClients: clientsData.length,
          activeClients: clientsData.filter(c => c.status === 'active').length,
          totalForms: formsSnapshot.size,
          totalResponses,
          averageClientScore: totalResponses > 0 ? Math.round(totalScore / totalResponses) : 0,
          recentCheckIns
        };
        
        setStats(statsData);
      } catch (error) {
        console.error('Error fetching coach data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCoachData();
  }, [user]);

  if (loading) {
    return (
      <ProtectedRoute requiredRole="coach">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="coach">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="px-4 py-6 sm:px-0">
            <h1 className="text-3xl font-bold text-gray-900">Coach Dashboard</h1>
            <p className="mt-2 text-gray-600">Welcome back, {user?.name}! Here's your coaching overview.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4 sm:px-0 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Clients</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.totalClients}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Clients</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.activeClients}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Avg Client Score</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.averageClientScore}%</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Recent Check-ins</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.recentCheckIns}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Client List */}
          <div className="bg-white shadow rounded-lg px-4 sm:px-0 mb-8">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Your Clients</h3>
                <Link
                  href="/clients/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Add New Client
                </Link>
              </div>
              
              {clients.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No clients yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by adding your first client.</p>
                  <div className="mt-6">
                    <Link
                      href="/clients/new"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Add Your First Client
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {clients.slice(0, 5).map((client) => (
                    <div key={client.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {client.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <h4 className="text-sm font-medium text-gray-900">{client.name}</h4>
                            <p className="text-sm text-gray-500">{client.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            client.status === 'active' ? 'bg-green-100 text-green-800' :
                            client.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {client.status}
                          </span>
                          {client.riskScore && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              client.riskScore > 70 ? 'bg-red-100 text-red-800' :
                              client.riskScore > 30 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              Risk: {client.riskScore}
                            </span>
                          )}
                          <Link
                            href={`/client/${client.id}`}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            View Profile
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                  {clients.length > 5 && (
                    <div className="text-center pt-4">
                      <Link
                        href="/clients"
                        className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                      >
                        View all {clients.length} clients →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-6 px-4 sm:px-0">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Link
                href="/clients"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Manage Clients
              </Link>
              <Link
                href="/questions/create"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                Create Question
              </Link>
              <Link
                href="/forms/create"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
              >
                Create Form
              </Link>
              <Link
                href="/check-ins"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
              >
                View Check-ins
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 