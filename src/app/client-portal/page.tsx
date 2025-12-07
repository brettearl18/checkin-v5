'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import {
  getTrafficLightStatus,
  getTrafficLightIcon,
  getTrafficLightLabel,
  getTrafficLightColor,
  getDefaultThresholds,
  convertLegacyThresholds,
  type ScoringThresholds,
  type TrafficLightStatus
} from '@/lib/scoring-utils';

interface ClientStats {
  overallProgress: number;
  completedCheckins: number;
  totalCheckins: number;
  averageScore: number;
}

interface CheckIn {
  id: string;
  title: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  formId: string;
}

interface RecentResponse {
  id: string;
  checkInTitle: string;
  submittedAt: string;
  score: number;
  status: 'completed' | 'pending';
}

interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialization?: string;
}

interface ProgressImage {
  id: string;
  clientId: string;
  clientName: string;
  imageUrl: string;
  imageType: 'profile' | 'before' | 'after' | 'progress';
  orientation?: 'front' | 'back' | 'side';
  caption?: string;
  uploadedAt: string;
}

// Progress Images Preview Component
function ProgressImagesPreview({ clientEmail }: { clientEmail: string }) {
  const [images, setImages] = useState<ProgressImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (clientEmail) {
      // First fetch client ID
      fetch(`/api/client-portal?clientEmail=${encodeURIComponent(clientEmail)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data.client) {
            setClientId(data.data.client.id);
          } else {
            setLoading(false);
          }
        })
        .catch(err => {
          console.error('Error fetching client ID:', err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [clientEmail]);

  useEffect(() => {
    if (clientId) {
      fetch(`/api/progress-images?clientId=${clientId}&limit=4`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setImages(data.data || []);
          }
        })
        .catch(err => console.error('Error fetching progress images:', err))
        .finally(() => setLoading(false));
    }
  }, [clientId]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-2">
          <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-700 text-sm mb-1">No progress images yet</p>
        <p className="text-gray-600 text-xs">Upload photos to track your journey</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {images.map((image) => (
          <div key={image.id} className="group relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200/60 hover:border-pink-400/80 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-white/50 backdrop-blur-sm">
            <img
              src={image.imageUrl}
              alt={image.caption || image.imageType}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(`
                  <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                    <rect width="200" height="200" fill="#f3f4f6"/>
                    <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#9ca3af" text-anchor="middle" dy=".3em">Image</text>
                  </svg>
                `)}`;
              }}
            />
            <div className="absolute top-1 left-1 flex flex-col gap-0.5">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                image.imageType === 'profile' ? 'bg-blue-100 text-blue-800' :
                image.imageType === 'before' ? 'bg-orange-100 text-orange-800' :
                image.imageType === 'after' ? 'bg-green-100 text-green-800' :
                'bg-purple-100 text-purple-800'
              }`}>
                {image.imageType === 'profile' ? 'Profile' :
                 image.imageType === 'before' ? 'Before' :
                 image.imageType === 'after' ? 'After' :
                 'Progress'}
              </span>
              {image.orientation && (
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  image.orientation === 'front' ? 'bg-pink-100 text-pink-800' :
                  image.orientation === 'back' ? 'bg-indigo-100 text-indigo-800' :
                  'bg-teal-100 text-teal-800'
                }`}>
                  {image.orientation.charAt(0).toUpperCase() + image.orientation.slice(1)}
                </span>
              )}
            </div>
            <div className="absolute bottom-1 right-1">
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-black/60 text-white">
                {new Date(image.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClientPortalPage() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<ClientStats>({
    overallProgress: 0,
    completedCheckins: 0,
    totalCheckins: 0,
    averageScore: 0
  });
  const [assignedCheckins, setAssignedCheckins] = useState<CheckIn[]>([]);
  const [recentResponses, setRecentResponses] = useState<RecentResponse[]>([]);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<ScoringThresholds>(getDefaultThresholds('lifestyle'));
  const [averageTrafficLight, setAverageTrafficLight] = useState<TrafficLightStatus>('orange');
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.email) {
      fetchClientData();
    } else if (userProfile === null) {
      // User profile is loaded but no email - this is an error state
      setLoading(false);
    }
    // If userProfile is undefined, it's still loading, so we wait
  }, [userProfile?.email]);

  // Fetch scoring configuration when clientId is available
  useEffect(() => {
    const fetchScoringConfig = async () => {
      if (!clientId) return;
      
      try {
        const scoringDoc = await getDoc(doc(db, 'clientScoring', clientId));
        if (scoringDoc.exists()) {
          const scoringData = scoringDoc.data();
          let clientThresholds: ScoringThresholds;

          // Check if new format (redMax/orangeMax) exists
          if (scoringData.thresholds?.redMax !== undefined && scoringData.thresholds?.orangeMax !== undefined) {
            clientThresholds = {
              redMax: scoringData.thresholds.redMax,
              orangeMax: scoringData.thresholds.orangeMax
            };
          } else if (scoringData.thresholds?.red !== undefined && scoringData.thresholds?.yellow !== undefined) {
            // Convert legacy format
            clientThresholds = convertLegacyThresholds(scoringData.thresholds);
          } else if (scoringData.scoringProfile) {
            // Use profile defaults
            clientThresholds = getDefaultThresholds(scoringData.scoringProfile as any);
          } else {
            // Default to lifestyle
            clientThresholds = getDefaultThresholds('lifestyle');
          }

          setThresholds(clientThresholds);
          
          // Update average traffic light status
          if (stats.averageScore > 0) {
            setAverageTrafficLight(getTrafficLightStatus(stats.averageScore, clientThresholds));
          }
        } else {
          // No scoring config, use default lifestyle thresholds
          const defaultThresholds = getDefaultThresholds('lifestyle');
          setThresholds(defaultThresholds);
          if (stats.averageScore > 0) {
            setAverageTrafficLight(getTrafficLightStatus(stats.averageScore, defaultThresholds));
          }
        }
      } catch (error) {
        console.error('Error fetching scoring config:', error);
        // Use default lifestyle thresholds on error
        const defaultThresholds = getDefaultThresholds('lifestyle');
        setThresholds(defaultThresholds);
        if (stats.averageScore > 0) {
          setAverageTrafficLight(getTrafficLightStatus(stats.averageScore, defaultThresholds));
        }
      }
    };

    fetchScoringConfig();
  }, [clientId, stats.averageScore]);

  const fetchClientData = async () => {
    try {
      // Fetch client-specific data using email (more reliable than UID)
      const clientEmail = userProfile?.email;
      
      if (!clientEmail) {
        console.warn('No client email available - user profile may still be loading');
        setLoading(false);
        return;
      }
      
      // Fetch real data from API using email
      const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(clientEmail)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          const { client, coach, checkInAssignments, summary } = data.data;
          
          // Store client ID for fetching scoring config
          if (client?.id) {
            setClientId(client.id);
          }
          
          // Calculate average score from recent responses if available
          let averageScore = 0;
          if (summary.recentResponses && summary.recentResponses.length > 0) {
            const scores = summary.recentResponses.map((r: any) => r.score || 0).filter((s: number) => s > 0);
            if (scores.length > 0) {
              averageScore = Math.round(scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length);
            }
          }
          
          // Calculate stats from the summary data
          const calculatedStats = {
            overallProgress: summary.completedAssignments > 0 ? Math.round((summary.completedAssignments / summary.totalAssignments) * 100) : 0,
            completedCheckins: summary.completedAssignments || 0,
            totalCheckins: summary.totalAssignments || 0,
            averageScore: averageScore
          };
          
          // Set recent responses if available
          if (summary.recentResponses) {
            setRecentResponses(summary.recentResponses.map((r: any) => ({
              id: r.id || '',
              checkInTitle: r.formTitle || 'Check-in',
              submittedAt: r.submittedAt || new Date().toISOString(),
              score: r.score || 0,
              status: 'completed' as const,
              formTitle: r.formTitle || 'Check-in'
            })));
          }
          
          // Transform check-in assignments to match expected structure
          const transformedCheckins: CheckIn[] = (checkInAssignments || []).map((assignment: any) => {
            // Helper function to convert date fields
            const convertDate = (dateField: any): string => {
              if (!dateField) return new Date().toISOString();
              
              // Handle Firestore Timestamp
              if (dateField.toDate && typeof dateField.toDate === 'function') {
                return dateField.toDate().toISOString();
              }
              
              // Handle Firebase Timestamp object with _seconds
              if (dateField._seconds) {
                return new Date(dateField._seconds * 1000).toISOString();
              }
              
              // Handle Date object
              if (dateField instanceof Date) {
                return dateField.toISOString();
              }
              
              // Handle ISO string
              if (typeof dateField === 'string') {
                return new Date(dateField).toISOString();
              }
              
              // Fallback
              return new Date().toISOString();
            };

            return {
              id: assignment.id || '',
              title: assignment.formTitle || assignment.title || 'Check-in Assignment',
              dueDate: convertDate(assignment.dueDate),
              status: assignment.status || 'pending',
              formId: assignment.formId || ''
            };
          });
          
          setStats(calculatedStats);
          setAssignedCheckins(transformedCheckins);
          setRecentResponses([]); // API doesn't provide this yet
          setCoach(coach);
        } else {
          console.error('API returned error:', data.message);
          // Fallback to empty data
          setStats({
            overallProgress: 0,
            completedCheckins: 0,
            totalCheckins: 0,
            averageScore: 0
          });
          setAssignedCheckins([]);
          setRecentResponses([]);
          setCoach(null);
        }
      } else {
        console.error('Failed to fetch client data:', response.status);
        // Fallback to empty data
        setStats({
          overallProgress: 0,
          completedCheckins: 0,
          totalCheckins: 0,
          averageScore: 0
        });
        setAssignedCheckins([]);
        setRecentResponses([]);
        setCoach(null);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
      // Fallback to empty data
      setStats({
        overallProgress: 0,
        completedCheckins: 0,
        totalCheckins: 0,
        averageScore: 0
      });
      setAssignedCheckins([]);
      setRecentResponses([]);
      setCoach(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'overdue':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gray-50 flex">
          <ClientNavigation />
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow p-6">
                      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-1/3"></div>
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

  // Note: For dashboard, we'll use a simplified version since we don't have client-specific thresholds loaded
  // In a full implementation, we'd fetch thresholds for each response
  const getScoreColor = (score: number) => {
    // Default to lifestyle thresholds for dashboard display
    // Red: 0-33, Orange: 34-80, Green: 81-100
    if (score <= 33) return 'bg-red-200 text-red-800';
    if (score <= 80) return 'bg-orange-200 text-orange-800';
    return 'bg-green-200 text-green-800';
  };

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-4 p-5">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Welcome Back!</h1>
                <p className="text-gray-900 text-sm mt-1 font-medium">Track your progress and stay connected</p>
              </div>
              <div className="flex items-center space-x-4">
                <NotificationBell />
                {coach && (
                  <div className="text-right bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-200/50 shadow-sm">
                    <p className="text-xs text-gray-700 font-medium">Your Coach</p>
                    <p className="text-sm font-semibold text-gray-900">{coach.firstName} {coach.lastName}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-lg hover:border-blue-300/50 transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{stats?.totalCheckins || 0}</div>
                <div className="text-xs text-gray-900 mt-1 font-medium">Total Check-ins</div>
              </div>
            </div>

            <div className="group relative bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-lg hover:border-emerald-300/50 transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{stats?.completedCheckins || 0}</div>
                <div className="text-xs text-gray-900 mt-1 font-medium">Completed</div>
              </div>
            </div>

            <div className="group relative bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-lg hover:border-purple-300/50 transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-sm">
                    <span className="text-xl">{getTrafficLightIcon(averageTrafficLight)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">{stats?.averageScore || 0}%</div>
                  {stats?.averageScore > 0 && (
                    <span className="text-xs font-semibold text-gray-900">
                      {getTrafficLightLabel(averageTrafficLight)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-900 mt-1 font-medium">Average Score</div>
                {stats?.averageScore > 0 && recentResponses.length > 0 && (
                  <div className="text-xs text-gray-900 mt-0.5">Based on {recentResponses.length} check-in{recentResponses.length !== 1 ? 's' : ''}</div>
                )}
              </div>
            </div>

            <div className="group relative bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-lg hover:border-amber-300/50 transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  {stats?.lastActivity ? new Date(stats.lastActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                </div>
                <div className="text-xs text-gray-900 mt-1 font-medium">Last Activity</div>
              </div>
            </div>
          </div>

          {/* Upcoming Check-ins Section - Front and Centre */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 rounded-2xl shadow-xl border border-orange-200 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-6 border-b border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">This Week's Check-ins</h2>
                      <p className="text-orange-100 text-sm">Complete these to stay on track with your wellness journey</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white text-sm font-medium">Due This Week</div>
                    <div className="text-2xl font-bold text-white">
                      {assignedCheckins.filter(checkIn => {
                        const dueDate = new Date(checkIn.dueDate);
                        const now = new Date();
                        const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        return daysDiff >= 0 && daysDiff <= 7 && checkIn.status === 'pending';
                      }).length}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-8">
                {(() => {
                  const upcomingCheckins = assignedCheckins.filter(checkIn => {
                    const dueDate = new Date(checkIn.dueDate);
                    const now = new Date();
                    const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return daysDiff >= 0 && daysDiff <= 7 && checkIn.status === 'pending';
                  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                  if (upcomingCheckins.length === 0) {
                    return (
                      <div className="text-center py-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-800 text-base font-bold mb-1">All caught up!</p>
                        <p className="text-gray-900 text-sm">No check-ins due this week. Great job!</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {upcomingCheckins.map((checkIn) => {
                        const dueDate = new Date(checkIn.dueDate);
                        const now = new Date();
                        const daysDiff = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        const isToday = daysDiff === 0;
                        const isTomorrow = daysDiff === 1;
                        const isUrgent = daysDiff <= 2;

                        return (
                          <div 
                            key={checkIn.id} 
                            className={`bg-white rounded-xl p-6 border-2 transition-all duration-200 hover:shadow-lg ${
                              isUrgent ? 'border-red-300 bg-red-50' : 'border-orange-200 hover:border-orange-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    isUrgent ? 'bg-red-100' : 'bg-orange-100'
                                  }`}>
                                    <svg className={`w-4 h-4 ${isUrgent ? 'text-red-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <h3 className="text-lg font-semibold text-gray-900">{checkIn.title}</h3>
                                </div>
                                <div className="flex items-center space-x-4 text-sm">
                                  <div className={`flex items-center space-x-1 ${
                                    isUrgent ? 'text-red-600' : 'text-orange-600'
                                  }`}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-medium">
                                      {isToday ? 'Due Today!' : 
                                       isTomorrow ? 'Due Tomorrow' : 
                                       `Due in ${daysDiff} days`}
                                    </span>
                                  </div>
                                  <span className="text-gray-700">
                                    {dueDate.toLocaleDateString('en-US', { 
                                      weekday: 'long', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  isUrgent ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {isUrgent ? 'Urgent' : 'Upcoming'}
                                </div>
                                <Link
                                  href={`/client-portal/check-in/${checkIn.id}`}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    isUrgent 
                                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl' 
                                      : 'bg-orange-600 hover:bg-orange-700 text-white shadow-md hover:shadow-lg'
                                  }`}
                                >
                                  {isUrgent ? 'Complete Now' : 'Start Check-in'}
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Main Content and Sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Progress Images */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden mb-6">
                <div className="px-5 py-4 bg-gradient-to-r from-pink-50/80 to-rose-50/80 border-b border-gray-200/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Progress Images</h2>
                      <p className="text-gray-900 text-xs mt-1 font-medium">Track your transformation</p>
                    </div>
                    <Link
                      href="/client-portal/progress-images"
                      className="px-4 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl hover:from-pink-700 hover:to-rose-700 transition-all duration-300 text-xs font-bold shadow-md hover:shadow-lg"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
                <ProgressImagesPreview clientEmail={userProfile?.email || ''} />
              </div>

              {/* Recent Responses */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-8 py-6 border-b border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-900">Recent Responses</h2>
                  <p className="text-gray-900 mt-1">Your latest check-in responses and feedback</p>
                </div>
                <div className="p-8">
                  {recentResponses.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-700 text-lg mb-4">No recent responses</p>
                      <p className="text-gray-900 text-sm">Your responses will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentResponses.map((response) => (
                        <div key={response.id} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all duration-200 hover:border-gray-300">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-gray-900">{response.formTitle}</h3>
                                <p className="text-gray-900 text-sm">Submitted {new Date(response.submittedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex flex-col items-end gap-1">
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${(() => {
                                  const status = getTrafficLightStatus(response.score, thresholds);
                                  return getTrafficLightColor(status);
                                })()}`}>
                                  <span>{getTrafficLightIcon(getTrafficLightStatus(response.score, thresholds))}</span>
                                  <span>{response.score}%</span>
                                </div>
                                <div className="text-xs text-gray-900 font-medium">
                                  {getTrafficLightLabel(getTrafficLightStatus(response.score, thresholds))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Coach Information */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Your Coach</h3>
                </div>
                <div className="p-6">
                  {coach ? (
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <span className="text-white font-bold text-xl">
                          {coach.firstName?.charAt(0) || 'C'}
                        </span>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">
                        {coach.firstName} {coach.lastName}
                      </h4>
                      <p className="text-gray-900 text-sm mb-3">{coach.email}</p>
                      {coach.specialization && (
                        <p className="text-gray-900 text-xs mb-4">{coach.specialization}</p>
                      )}
                      <Link
                        href="/client-portal/messages"
                        className="inline-flex items-center justify-center w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Message Coach
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <p className="text-gray-900 text-sm mb-3">No coach assigned</p>
                      <p className="text-gray-900 text-xs">Contact support to get assigned to a coach</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-6 space-y-3">
                  <Link
                    href="/client-portal/check-ins"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                  >
                    View Check-ins
                  </Link>
                  <Link
                    href="/client-portal/progress"
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                  >
                    View Progress
                  </Link>
                  <Link
                    href="/client-portal/profile"
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 block"
                  >
                    Update Profile
                  </Link>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Progress Summary</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900">Completion Rate</span>
                    <span className="font-bold text-gray-900">
                      {stats.totalCheckins > 0 ? Math.round((stats.completedCheckins / stats.totalCheckins) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900">Performance</span>
                    <span className="font-bold text-gray-900">
                      {stats.averageScore >= 80 ? 'Excellent' : 
                       stats.averageScore >= 60 ? 'Good' : 'Needs Improvement'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900">Active Streak</span>
                    <span className="font-bold text-gray-900">
                      {stats.lastActivity ? 'Current' : 'None'}
                    </span>
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