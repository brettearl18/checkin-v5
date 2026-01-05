'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import CoachNavigation from '@/components/CoachNavigation';

interface CheckIn {
  id: string;
  clientId: string;
  clientName?: string;
  formId: string;
  formTitle: string;
  responses: { [key: string]: any } | number;
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  submittedAt: any;
  mood?: number;
  energy?: number;
  status: 'pending' | 'completed';
  isAssignment?: boolean;
  responseId?: string; // ID of the formResponse document for completed check-ins
  coachResponded?: boolean;
  assignmentId?: string;
}

interface CheckInToReview {
  id: string;
  clientId: string;
  clientName: string;
  formTitle: string;
  submittedAt: string;
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  status: string;
  formId: string;
  assignmentId: string;
  coachResponded?: boolean;
}

interface Client {
  id: string;
  name: string;
  email: string;
  status: string;
}

export default function CheckInsPage() {
  const { userProfile, logout } = useAuth();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [checkInsToReview, setCheckInsToReview] = useState<CheckInToReview[]>([]);
  const [clients, setClients] = useState<{ [key: string]: Client }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState('all');
  const [selectedForm, setSelectedForm] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [activeTab, setActiveTab] = useState<'review' | 'all' | 'replied'>('review');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // 'asc' = oldest first (submitted first), 'desc' = newest first
  const [repliedTimeFilter, setRepliedTimeFilter] = useState<'week' | 'month' | 'all'>('week'); // Filter for replied tab
  const [metrics, setMetrics] = useState({
    totalCheckIns: 0,
    highPerformers: 0,
    activeClients: 0,
    avgScore: 0
  });

  useEffect(() => {
    const fetchCheckIns = async () => {
      try {
        const coachId = userProfile?.uid;
        if (!coachId) {
          console.error('No coach ID available');
          setIsLoading(false);
          return;
        }
        console.log('🔍 Fetching check-ins for coachId:', coachId);
        
        // Fetch both check-ins to review and all completed check-ins
        // Sort by submittedAt with the selected sort order (default: asc = oldest first)
        const [reviewResponse, allCheckInsResponse] = await Promise.all([
          fetch(`/api/dashboard/check-ins-to-review?coachId=${coachId}&sortBy=submittedAt&sortOrder=${sortOrder}`),
          fetch(`/api/check-ins?coachId=${coachId}`)
        ]);
        
        // Process check-ins to review
        let reviews: CheckInToReview[] = [];
        if (reviewResponse.ok) {
          const reviewData = await reviewResponse.json();
          if (reviewData.success && reviewData.data?.checkIns) {
            reviews = reviewData.data.checkIns;
            setCheckInsToReview(reviews);
          }
        }
        
        // Process all check-ins
        if (allCheckInsResponse.ok) {
          const data = await allCheckInsResponse.json();
          console.log('🔍 API Response:', data);
          if (data.success) {
            setCheckIns(data.checkIns || []);
            setMetrics(data.metrics || {
              totalCheckIns: 0,
              highPerformers: 0,
              activeClients: 0,
              avgScore: 0
            });
            
            // Build clients object from both check-ins and reviews
            const clientsData: { [key: string]: Client } = {};
            data.checkIns.forEach((checkIn: CheckIn) => {
              if (checkIn.clientId && checkIn.clientId !== 'unknown') {
                clientsData[checkIn.clientId] = {
                  id: checkIn.clientId,
                  name: checkIn.clientName || 'Unknown Client',
                  email: '', // Will be filled if needed
                  status: 'active'
                };
              }
            });
            
            // Also add clients from check-ins to review
            reviews.forEach((checkIn: CheckInToReview) => {
              if (checkIn.clientId && checkIn.clientId !== 'unknown') {
                if (!clientsData[checkIn.clientId]) {
                  clientsData[checkIn.clientId] = {
                    id: checkIn.clientId,
                    name: checkIn.clientName || 'Unknown Client',
                    email: '',
                    status: 'active'
                  };
                }
              }
            });
            
            setClients(clientsData);
          } else {
            console.error('Failed to fetch check-ins:', data.message);
            setCheckIns([]);
            setMetrics({
              totalCheckIns: 0,
              highPerformers: 0,
              activeClients: 0,
              avgScore: 0
            });
          }
        } else {
          console.error('Failed to fetch check-ins');
          setCheckIns([]);
          setMetrics({
            totalCheckIns: 0,
            highPerformers: 0,
            activeClients: 0,
            avgScore: 0
          });
        }
      } catch (error) {
        console.error('Error fetching check-ins:', error);
        setCheckIns([]);
        setCheckInsToReview([]);
        setMetrics({
          totalCheckIns: 0,
          highPerformers: 0,
          activeClients: 0,
          avgScore: 0
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (userProfile?.uid) {
    fetchCheckIns();
    }
  }, [userProfile?.uid, sortOrder]);

  const filteredCheckIns = checkIns.filter(checkIn => {
    const clientMatch = selectedClient === 'all' || checkIn.clientId === selectedClient;
    const formMatch = selectedForm === 'all' || checkIn.formId === selectedForm;
    
    let dateMatch = true;
    if (dateRange !== 'all') {
      const checkInDate = checkIn.submittedAt?.toDate ? checkIn.submittedAt.toDate() : new Date(checkIn.submittedAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dateRange === 'today' && daysDiff > 0) dateMatch = false;
      if (dateRange === 'week' && daysDiff > 7) dateMatch = false;
      if (dateRange === 'month' && daysDiff > 30) dateMatch = false;
    }
    
    return clientMatch && formMatch && dateMatch;
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#34C759] bg-[#34C759]/10 border border-[#34C759]/20';
    if (score >= 60) return 'text-orange-600 bg-orange-100 border border-orange-200';
    return 'text-[#FF3B30] bg-[#FF3B30]/10 border border-[#FF3B30]/20';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Attention';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatTimeAgo = (timestamp: string | any) => {
    if (!timestamp) return 'Unknown';
    const now = new Date();
    const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  };

  const getClientName = (clientId: string) => {
    const client = clients[clientId];
    if (client) {
      return client.name;
    }
    return 'Unknown Client';
  };

  const getUniqueForms = () => {
    const forms = new Set<string>();
    checkIns.forEach(checkIn => forms.add(checkIn.formTitle));
    return Array.from(forms);
  };

  const getUniqueClients = () => {
    return Object.values(clients);
  };

  if (isLoading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-white flex flex-col lg:flex-row">
          <div className="hidden lg:block">
            <CoachNavigation />
          </div>
          <div className="flex-1 lg:ml-4 lg:mr-8 lg:mt-6 lg:mb-6 lg:max-w-7xl lg:mx-auto p-4 lg:p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-200 rounded"></div>
                ))}
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
              <h1 className="text-xl font-bold text-gray-900">Check-ins</h1>
              {checkInsToReview.filter(ci => !ci.coachResponded).length > 0 && (
                <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                  {checkInsToReview.filter(ci => !ci.coachResponded).length}
                </div>
              )}
            </div>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block mb-6">
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b-2 rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Client Check-ins</h1>
              <p className="text-gray-600 text-sm">
                Monitor client progress and engagement through their check-in submissions
              </p>
            </div>
          </div>

          <div className="px-4 lg:px-0">

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 lg:mb-8">
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-10 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 truncate">Total</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{metrics.totalCheckIns}</div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">All submissions</div>
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
                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 truncate">High</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{metrics.highPerformers}</div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">80%+ scores</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-10 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 truncate">Active</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{metrics.activeClients}</div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Recently active</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b-2 border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-8 sm:h-10 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-700 truncate">Avg Score</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{metrics.avgScore}%</div>
                  <div className="text-[10px] sm:text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Overall average</div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden mb-6 lg:mb-8">
              <div className="px-4 py-3 sm:px-6 sm:py-4 lg:px-10 lg:py-8 border-b-2 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Filters</h2>
              </div>
              <div className="p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Client
                    </label>
                    <select
                      value={selectedClient}
                      onChange={(e) => setSelectedClient(e.target.value)}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 transition-all duration-200 text-gray-900 bg-white min-h-[44px]"
                      style={{ focusRingColor: '#daa450' }}
                    >
                      <option value="all">All Clients</option>
                      {getUniqueClients().map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Form
                    </label>
                    <select
                      value={selectedForm}
                      onChange={(e) => setSelectedForm(e.target.value)}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 transition-all duration-200 text-gray-900 bg-white min-h-[44px]"
                      style={{ focusRingColor: '#daa450' }}
                    >
                      <option value="all">All Forms</option>
                      {getUniqueForms().map((formTitle) => (
                        <option key={formTitle} value={formTitle}>
                          {formTitle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Range
                    </label>
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 transition-all duration-200 text-gray-900 bg-white min-h-[44px]"
                      style={{ focusRingColor: '#daa450' }}
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Check-ins List with Tabs */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden mb-6 lg:mb-8">
              <div className="px-4 py-3 sm:px-6 sm:py-4 lg:px-10 lg:py-8 border-b-2 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Check-ins</h2>
                  {/* Sort and Tab Navigation */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                    {/* Sort Dropdown - Only show on "To Review" tab */}
                    {activeTab === 'review' && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                          Sort:
                        </label>
                        <select
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                          className="border border-gray-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all duration-200 text-gray-900 bg-white min-h-[36px] sm:min-h-[40px]"
                          style={{ focusRingColor: '#daa450' }}
                        >
                          <option value="asc">Oldest First</option>
                          <option value="desc">Newest First</option>
                        </select>
                      </div>
                    )}
                    {/* Tab Navigation */}
                    <div className="flex bg-white rounded-2xl p-1 shadow-sm overflow-x-auto">
                    <button
                      onClick={() => setActiveTab('review')}
                      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap min-h-[44px] flex items-center justify-center ${
                        activeTab === 'review'
                          ? 'text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                      style={activeTab === 'review' ? { backgroundColor: '#daa450' } : {}}
                    >
                      To Review ({checkInsToReview.filter(ci => !ci.coachResponded).length})
                    </button>
                    <button
                      onClick={() => setActiveTab('replied')}
                      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap min-h-[44px] flex items-center justify-center ${
                        activeTab === 'replied'
                          ? 'bg-[#007AFF] text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      Replied ({checkInsToReview.filter(ci => ci.coachResponded).length})
                    </button>
                    <button
                      onClick={() => setActiveTab('all')}
                      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap min-h-[44px] flex items-center justify-center ${
                        activeTab === 'all'
                          ? 'bg-[#34C759] text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      All ({filteredCheckIns.length})
                    </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 lg:p-8">
                {/* To Review Tab */}
                {activeTab === 'review' && (
                  <>
                    {checkInsToReview.filter(ci => !ci.coachResponded).length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-700 text-lg mb-4">No check-ins to review</p>
                        <p className="text-gray-600 text-sm">Completed check-ins will appear here for your review</p>
                      </div>
                    ) : (
                      <div className="space-y-3 sm:space-y-2">
                        {checkInsToReview.filter(ci => !ci.coachResponded).map((checkIn) => {
                          const needsResponse = !checkIn.coachResponded;
                          const submittedAtDate = checkIn.submittedAt ? new Date(checkIn.submittedAt) : null;
                          const hoursSince = submittedAtDate ? Math.floor((Date.now() - submittedAtDate.getTime()) / (1000 * 60 * 60)) : 0;
                          const isOverdue = needsResponse && hoursSince >= 24;

                          return (
                            <div
                              key={checkIn.id}
                              className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 border hover:shadow-sm transition-all duration-200 cursor-pointer ${
                                needsResponse 
                                  ? 'bg-orange-50 border-orange-200 hover:border-orange-300' 
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                              onClick={() => window.location.href = `/responses/${checkIn.id}`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                      isOverdue
                                        ? 'bg-[#FF3B30]/10'
                                        : needsResponse
                                        ? 'bg-orange-100'
                                        : 'bg-[#34C759]/10'
                                    }`}
                                  >
                                    {isOverdue ? (
                                      <svg className="w-4 h-4 text-[#FF3B30]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M12 5a7 7 0 00-7 7v0a7 7 0 0014 0v0a7 7 0 00-7-7z" />
                                      </svg>
                                    ) : needsResponse ? (
                                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2 2m-2-2H9m3-7a7 7 0 00-7 7v3l-1.5 1.5M19.5 19.5L18 17" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 flex-wrap">
                                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                                        {checkIn.clientName}
                                      </h3>
                                    </div>
                                    <p className="text-gray-600 text-xs sm:text-sm mt-1 truncate">
                                      {checkIn.formTitle}
                                    </p>
                                    <p className="text-[10px] sm:text-xs text-gray-700 mt-0.5">
                                      {formatTimeAgo(checkIn.submittedAt)}
                                      {isOverdue && <span className="ml-2 text-[#FF3B30] font-semibold">(Overdue)</span>}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-2">
                                  <div className="text-left sm:text-right">
                                    <div className="text-base sm:text-lg font-bold text-gray-900">
                                      {checkIn.score}%
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-gray-700">Score</div>
                                  </div>
                                  <Link
                                    href={`/responses/${checkIn.id}`}
                                    className={`px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-2xl hover:opacity-90 transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm min-h-[44px] flex items-center justify-center ${
                                      needsResponse 
                                        ? 'text-white' 
                                        : 'bg-[#007AFF] text-white hover:bg-[#0051D5]'
                                    }`}
                                    style={needsResponse ? { backgroundColor: '#daa450' } : {}}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {needsResponse ? 'Respond' : 'View'}
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Replied Tab */}
                {activeTab === 'replied' && (
                  <>
                    {/* Time Filter for Replied Tab */}
                    <div className="mb-4 flex items-center gap-3">
                      <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                        Filter:
                      </label>
                      <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-200">
                        <button
                          onClick={() => setRepliedTimeFilter('week')}
                          className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                            repliedTimeFilter === 'week'
                              ? 'bg-[#007AFF] text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          This Week
                        </button>
                        <button
                          onClick={() => setRepliedTimeFilter('month')}
                          className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                            repliedTimeFilter === 'month'
                              ? 'bg-[#007AFF] text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          This Month
                        </button>
                        <button
                          onClick={() => setRepliedTimeFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                            repliedTimeFilter === 'all'
                              ? 'bg-[#007AFF] text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          All Time
                        </button>
                      </div>
                    </div>

                    {(() => {
                      // Filter replied check-ins by time period
                      let repliedCheckIns = checkInsToReview.filter(ci => ci.coachResponded);
                      
                      const now = new Date();
                      if (repliedTimeFilter === 'week') {
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        repliedCheckIns = repliedCheckIns.filter(ci => {
                          const submittedDate = ci.submittedAt?.toDate ? ci.submittedAt.toDate() : new Date(ci.submittedAt);
                          return submittedDate >= weekAgo;
                        });
                      } else if (repliedTimeFilter === 'month') {
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        repliedCheckIns = repliedCheckIns.filter(ci => {
                          const submittedDate = ci.submittedAt?.toDate ? ci.submittedAt.toDate() : new Date(ci.submittedAt);
                          return submittedDate >= monthAgo;
                        });
                      }
                      
                      // Sort by submitted date (newest first)
                      repliedCheckIns.sort((a, b) => {
                        const dateA = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt);
                        const dateB = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(b.submittedAt);
                        return dateB.getTime() - dateA.getTime();
                      });

                      return repliedCheckIns.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                          <p className="text-gray-700 text-lg mb-4">No replied check-ins</p>
                          <p className="text-gray-600 text-sm">
                            {repliedTimeFilter === 'week' ? 'No check-ins replied to this week' :
                             repliedTimeFilter === 'month' ? 'No check-ins replied to this month' :
                             "Check-ins you've replied to will appear here"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 sm:space-y-2">
                          {repliedCheckIns.map((checkIn) => {
                          return (
                            <div
                              key={checkIn.id}
                              className="bg-blue-50 border border-blue-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:shadow-sm transition-all duration-200 cursor-pointer hover:border-blue-300"
                              onClick={() => window.location.href = `/responses/${checkIn.id}`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 flex-wrap">
                                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                                        {checkIn.clientName}
                                      </h3>
                                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                        Replied
                                      </span>
                                    </div>
                                    <p className="text-gray-600 text-xs sm:text-sm mt-1 truncate">
                                      {checkIn.formTitle}
                                    </p>
                                    <p className="text-[10px] sm:text-xs text-gray-700 mt-0.5">
                                      {formatTimeAgo(checkIn.submittedAt)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-2">
                                  <div className="text-left sm:text-right">
                                    <div className="text-base sm:text-lg font-bold text-gray-900">
                                      {checkIn.score}%
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-gray-700">Score</div>
                                  </div>
                                  <Link
                                    href={`/responses/${checkIn.id}`}
                                    className="px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-2xl hover:opacity-90 transition-all duration-200 text-xs sm:text-sm font-medium shadow-sm bg-[#007AFF] text-white hover:bg-[#0051D5] min-h-[44px] flex items-center justify-center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View Reply
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      );
                    })()}
                  </>
                )}

                {/* All Check-ins Tab */}
                {activeTab === 'all' && (
                  <>
              {filteredCheckIns.length === 0 ? (
                      <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-lg mb-2">No check-ins found</p>
                    <p className="text-gray-400 text-sm">
                      {checkIns.length === 0 
                        ? "No check-ins have been submitted yet."
                        : "No check-ins match your current filters."
                      }
                    </p>
                </div>
              ) : (
                      <div className="space-y-3 sm:space-y-4">
                        {filteredCheckIns.map((checkIn) => (
                  <div key={checkIn.id} className={`bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 ${
                    checkIn.status === 'pending' ? 'border-orange-200 bg-orange-50' : ''
                  }`}>
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                              {getClientName(checkIn.clientId)}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              checkIn.status === 'pending' 
                                ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                                : 'bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20'
                            }`}>
                              {checkIn.status === 'pending' ? 'Pending' : 'Completed'}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-medium rounded-full border border-gray-200">
                              {clients[checkIn.clientId]?.status || 'Active'}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <p><span className="font-medium">Form:</span> {checkIn.formTitle}</p>
                            {checkIn.status === 'pending' ? (
                              <p><span className="font-medium">Assigned:</span> {formatDate(checkIn.submittedAt)}</p>
                            ) : (
                              <p><span className="font-medium">Submitted:</span> {formatDate(checkIn.submittedAt)}</p>
                            )}
                            {checkIn.status === 'completed' && (
                              <p><span className="font-medium">Questions:</span> {checkIn.answeredQuestions}/{checkIn.totalQuestions}</p>
                            )}
                          </div>
                        </div>
                        <div className="sm:ml-4 text-left sm:text-right">
                          {checkIn.status === 'completed' ? (
                            <>
                              <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${getScoreColor(checkIn.score)}`}>
                                {checkIn.score}% - {getScoreLabel(checkIn.score)}
                              </div>
                              {checkIn.mood && (
                                <div className="mt-2 text-xs text-gray-600">
                                  <span className="font-medium">Mood:</span> {checkIn.mood}/10
                                </div>
                              )}
                              {checkIn.energy && (
                                <div className="text-xs text-gray-600">
                                  <span className="font-medium">Energy:</span> {checkIn.energy}/10
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                              Pending Completion
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Response Summary - Only for completed check-ins */}
                      {checkIn.status === 'completed' && 
                       typeof checkIn.responses === 'object' && 
                       !Array.isArray(checkIn.responses) &&
                       Object.keys(checkIn.responses).length > 0 && (
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Check-in Summary:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              {Object.entries(checkIn.responses).slice(0, Math.ceil(Object.keys(checkIn.responses).length / 2)).map(([questionId, answer]) => (
                                <div key={questionId} className="text-xs">
                                  <span className="font-medium text-gray-800">Q{questionId}:</span>
                                  <span className="ml-2 text-gray-900">
                                    {typeof answer === 'boolean' ? (answer ? 'Yes' : 'No') : String(answer)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-1.5">
                              {Object.entries(checkIn.responses).slice(Math.ceil(Object.keys(checkIn.responses).length / 2)).map(([questionId, answer]) => (
                                <div key={questionId} className="text-xs">
                                  <span className="font-medium text-gray-800">Q{questionId}:</span>
                                  <span className="ml-2 text-gray-900">
                                    {typeof answer === 'boolean' ? (answer ? 'Yes' : 'No') : String(answer)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                          <Link
                            href={`/clients/${checkIn.clientId}`}
                            className="text-xs sm:text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center px-3 py-2 rounded-lg"
                            style={{ color: '#daa450' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#c89540'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#daa450'}
                          >
                            View Client Profile
                          </Link>
                          <Link
                            href={`/forms/${checkIn.formId}`}
                            className="text-xs sm:text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center px-3 py-2 rounded-lg text-[#007AFF] hover:text-[#0051D5]"
                          >
                            View Form
                          </Link>
                          {checkIn.status === 'pending' ? (
                            <button className="text-xs sm:text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center px-3 py-2 rounded-lg" style={{ color: '#daa450' }}>
                              Send Reminder
                            </button>
                          ) : (
                            <>
                              {checkIn.responseId && (
                                <Link
                                  href={`/responses/${checkIn.responseId}`}
                                  className="text-xs sm:text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center px-3 py-2 rounded-lg"
                                  style={{ color: '#daa450' }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#c89540'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = '#daa450'}
                                >
                                  View Full Response
                                </Link>
                              )}
                              <button className="text-xs sm:text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center px-3 py-2 rounded-lg text-[#007AFF] hover:text-[#0051D5]">
                                Add Coach Notes
                              </button>
                              <button className="text-xs sm:text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center px-3 py-2 rounded-lg" style={{ color: '#daa450' }}>
                                Send Follow-up
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="lg:hidden mt-4 px-4">
            <CoachNavigation />
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 
