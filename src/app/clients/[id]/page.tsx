'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import { collection, getDocs, query, orderBy, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { 
  getTrafficLightStatus, 
  getTrafficLightColor, 
  getTrafficLightIcon, 
  getTrafficLightLabel,
  getDefaultThresholds,
  convertLegacyThresholds,
  type ScoringThresholds,
  type TrafficLightStatus
} from '@/lib/scoring-utils';

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
  completedCheckIns?: number;
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

interface QuestionResponse {
  questionId: string;
  question: string;
  answer: any;
  type: string;
  weight?: number;
  score?: number;
}

interface FormResponse {
  id: string;
  formTitle: string;
  submittedAt: any;
  completedAt: any;
  score?: number;
  totalQuestions: number;
  answeredQuestions: number;
  status: string;
  responses?: QuestionResponse[];
}

interface QuestionProgress {
  questionId: string;
  questionText: string;
  weeks: {
    week: number;
    date: string;
    score: number;
    status: 'red' | 'orange' | 'green';
    answer: any;
    type: string;
  }[];
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
  const [progressImages, setProgressImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [filterOrientation, setFilterOrientation] = useState<'all' | 'front' | 'back' | 'side'>('all');
  const [filterDate, setFilterDate] = useState<'all' | string>('all');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [onboardingData, setOnboardingData] = useState<any>(null);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);
  const [measurementHistory, setMeasurementHistory] = useState<any[]>([]);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [selectedMeasurements, setSelectedMeasurements] = useState<Set<string>>(new Set(['bodyWeight']));
  const [allMeasurementsData, setAllMeasurementsData] = useState<any[]>([]);
  const [questionProgress, setQuestionProgress] = useState<any[]>([]);
  const [loadingQuestionProgress, setLoadingQuestionProgress] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<{
    question: string;
    answer: any;
    score: number;
    date: string;
    week: number;
    type: string;
  } | null>(null);
  const [allocatedCheckIns, setAllocatedCheckIns] = useState<any[]>([]);
  const [loadingCheckIns, setLoadingCheckIns] = useState(false);
  const [hasLoadedCheckIns, setHasLoadedCheckIns] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [clientSettings, setClientSettings] = useState({
    programStartDate: '',
    programDuration: 12, // weeks
    programDurationUnit: 'weeks' as 'weeks' | 'months',
    coachNotes: '',
    checkInFrequency: 'weekly' as 'daily' | 'weekly' | 'bi-weekly' | 'monthly',
    communicationPreference: 'email' as 'email' | 'sms' | 'both',
  });
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocatingCheckIn, setAllocatingCheckIn] = useState(false);
  const [selectedAllocateForm, setSelectedAllocateForm] = useState('');
  const [allocateStartDate, setAllocateStartDate] = useState('');
  const [allocateFirstCheckInDate, setAllocateFirstCheckInDate] = useState('');
  const [allocateDuration, setAllocateDuration] = useState(4);
  const [allocateFrequency, setAllocateFrequency] = useState('weekly');
  const [allocateCheckInWindow, setAllocateCheckInWindow] = useState({
    enabled: true,
    startDay: 'friday',
    startTime: '10:00',
    endDay: 'monday',
    endTime: '22:00'
  });
  const [measurementScheduleEnabled, setMeasurementScheduleEnabled] = useState(false);
  const [firstMeasurementFriday, setFirstMeasurementFriday] = useState('');
  const [showAllocationSummary, setShowAllocationSummary] = useState(false);
  const [allocationSummary, setAllocationSummary] = useState<{
    formTitle: string;
    frequency: string;
    duration: number;
    startDate: string;
    firstCheckInDate: string;
    checkInWindow?: any;
    measurementSchedule?: {
      enabled: boolean;
      firstFridayDate: string;
      frequency: string;
      nextDates: string[];
    } | null;
  } | null>(null);
  const [showCheckInManagementModal, setShowCheckInManagementModal] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<any>(null);
  const [deletingCheckIn, setDeletingCheckIn] = useState(false);
  const [updatingCheckIn, setUpdatingCheckIn] = useState(false);
  const [deletingSeries, setDeletingSeries] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [selectedSeriesForPause, setSelectedSeriesForPause] = useState<{formId: string, formTitle: string} | null>(null);
  const [pauseWeeks, setPauseWeeks] = useState(1);
  const [pauseResumeDate, setPauseResumeDate] = useState('');
  const [pauseInputMode, setPauseInputMode] = useState<'weeks' | 'date'>('weeks');
  const [pausingSeries, setPausingSeries] = useState(false);
  const [unpausingSeries, setUnpausingSeries] = useState(false);
  const [scoringThresholds, setScoringThresholds] = useState<ScoringThresholds>(getDefaultThresholds('lifestyle'));
  const [progressTrafficLight, setProgressTrafficLight] = useState<TrafficLightStatus>('orange');
  const [checkInTab, setCheckInTab] = useState<'all' | 'completed' | 'coachResponses' | 'pendingReview'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'checkins' | 'history' | 'ai-analytics'>('overview');
  const [aiAnalytics, setAiAnalytics] = useState<any>(null);
  const [loadingAiAnalytics, setLoadingAiAnalytics] = useState(false);
  const [showGenerateAnalyticsModal, setShowGenerateAnalyticsModal] = useState(false);
  const [timePeriod, setTimePeriod] = useState<'all' | 'last-checkin' | '2-weeks' | '1-month' | '6-months' | '1-year' | 'custom'>('1-month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [generatingAnalytics, setGeneratingAnalytics] = useState(false);
  const [analyticsHistory, setAnalyticsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [questionProgressExpanded, setQuestionProgressExpanded] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState<any>(null);
  const [loadingWeeklySummary, setLoadingWeeklySummary] = useState(false);
  const [swotAnalysis, setSwotAnalysis] = useState<any>(null);
  const [loadingSwot, setLoadingSwot] = useState(false);
  const [imagesExpanded, setImagesExpanded] = useState(false);
  const [measurementsExpanded, setMeasurementsExpanded] = useState(false);
  const [onboardingAiSummary, setOnboardingAiSummary] = useState<{summary: string, generatedAt: string} | null>(null);
  const [loadingOnboardingAiSummary, setLoadingOnboardingAiSummary] = useState(false);

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
        
        // Load client settings if they exist
        if (data.client) {
          setClientSettings({
            programStartDate: data.client.programStartDate || '',
            programDuration: data.client.programDuration || 12,
            programDurationUnit: data.client.programDurationUnit || 'weeks',
            coachNotes: data.client.notes || data.client.coachNotes || '',
            checkInFrequency: data.client.profile?.preferences?.checkInFrequency || 'weekly',
            communicationPreference: data.client.profile?.preferences?.communication || 'email',
          });
        }
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

  const handleSaveSettings = async () => {
    if (!clientId) return;
    
    setSavingSettings(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          programStartDate: clientSettings.programStartDate,
          programDuration: clientSettings.programDuration,
          programDurationUnit: clientSettings.programDurationUnit,
          notes: clientSettings.coachNotes,
          coachNotes: clientSettings.coachNotes,
          profile: {
            ...client?.profile,
            preferences: {
              ...client?.profile?.preferences,
              checkInFrequency: clientSettings.checkInFrequency,
              communication: clientSettings.communicationPreference,
            },
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Settings saved successfully!');
        setShowSettingsModal(false);
        fetchClient(); // Refresh client data
      } else {
        alert('Failed to save settings: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSavingSettings(false);
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
        let checkIns = data.checkIns || [];
        
        // Deduplicate check-ins by formId + normalized dueDate (keep most recent)
        // This prevents showing multiple entries for the same check-in form and date
        const deduplicatedMap = new Map<string, any>();
        checkIns.forEach((checkIn: any) => {
          // Normalize dueDate to date string for comparison (ignore time)
          let dueDateKey = '';
          if (checkIn.dueDate) {
            const dueDate = new Date(checkIn.dueDate);
            dueDateKey = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD
          }
          const key = `${checkIn.formId || 'unknown'}-${dueDateKey}`;
          
          const existing = deduplicatedMap.get(key);
          if (!existing) {
            deduplicatedMap.set(key, checkIn);
          } else {
            // Keep the one with the most recent assignedAt or completedAt
            const existingDate = new Date(existing.assignedAt || existing.completedAt || 0);
            const currentDate = new Date(checkIn.assignedAt || checkIn.completedAt || 0);
            if (currentDate > existingDate) {
              deduplicatedMap.set(key, checkIn);
            }
          }
        });
        
        checkIns = Array.from(deduplicatedMap.values());
        setAllocatedCheckIns(checkIns);
        
        // Update client metrics from the API response
        if (data.metrics && client) {
          const totalCheckIns = data.metrics.totalCheckIns || 0;
          const completedCheckIns = data.metrics.completedCheckIns || 0;
          const completionRate = totalCheckIns > 0 
            ? Math.round((completedCheckIns / totalCheckIns) * 100) 
            : 0;
          
          setClient({
            ...client,
            totalCheckIns: totalCheckIns,
            completedCheckIns: completedCheckIns,
            progressScore: data.metrics.progressScore || 0,
            completionRate: completionRate,
            lastCheckIn: data.metrics.lastActivity || null
          });
        }
        
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

  // Fetch AI Analytics history and onboarding summary when tab is opened
  useEffect(() => {
    const fetchAnalyticsHistory = async () => {
      if (activeTab === 'ai-analytics' && clientId) {
        setLoadingHistory(true);
        try {
          const response = await fetch(`/api/clients/${clientId}/ai-analytics?history=true`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.history) {
              setAnalyticsHistory(data.history);
              // If no current analytics loaded and we have history, load the most recent
              if (!aiAnalytics && data.history.length > 0 && !selectedHistoryId) {
                setAiAnalytics(data.history[0].analytics);
                setSelectedHistoryId(data.history[0].id);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching analytics history:', error);
        } finally {
          setLoadingHistory(false);
        }
      }
    };

    const fetchOnboardingAiSummary = async () => {
      if (activeTab === 'ai-analytics' && clientId && !onboardingAiSummary && !loadingOnboardingAiSummary) {
        console.log('Fetching onboarding AI summary for client:', clientId);
        setLoadingOnboardingAiSummary(true);
        try {
          const response = await fetch(`/api/client-portal/onboarding/report?clientId=${clientId}`);
          console.log('Onboarding report response status:', response.status);
          if (response.ok) {
            const data = await response.json();
            console.log('Onboarding report response data:', data);
            if (data.success && data.data?.aiSummary) {
              console.log('Found AI summary, setting state');
              setOnboardingAiSummary({
                summary: data.data.aiSummary,
                generatedAt: data.data.aiSummaryGeneratedAt || data.data.submittedAt || ''
              });
            } else {
              console.log('No AI summary found in response. Success:', data.success, 'Has data:', !!data.data, 'Has aiSummary:', !!data.data?.aiSummary);
            }
          } else {
            const errorText = await response.text();
            console.error('Onboarding report response not ok:', response.status, errorText);
          }
        } catch (error) {
          console.error('Error fetching onboarding AI summary:', error);
        } finally {
          setLoadingOnboardingAiSummary(false);
        }
      }
    };

    fetchAnalyticsHistory();
    fetchOnboardingAiSummary();
  }, [activeTab, clientId]);

  // Fetch specific history item when selected
  useEffect(() => {
    const fetchHistoryItem = async () => {
      if (selectedHistoryId && clientId && activeTab === 'ai-analytics') {
        setLoadingAiAnalytics(true);
        try {
          const response = await fetch(`/api/clients/${clientId}/ai-analytics?historyId=${selectedHistoryId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setAiAnalytics(data.data);
            }
          }
        } catch (error) {
          console.error('Error fetching history item:', error);
        } finally {
          setLoadingAiAnalytics(false);
        }
      }
    };

    if (selectedHistoryId) {
      fetchHistoryItem();
    }
  }, [selectedHistoryId, clientId, activeTab]);

  // Manual function to fetch weekly summary (only called when button is clicked)
  const handleRefreshWeeklySummary = async (forceRegenerate = false) => {
    if (!clientId) return;
    
    setLoadingWeeklySummary(true);
    try {
      const url = forceRegenerate 
        ? `/api/clients/${clientId}/weekly-summary?regenerate=true`
        : `/api/clients/${clientId}/weekly-summary`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setWeeklySummary(data.data);
        } else {
          console.error('Weekly summary fetch failed:', data.message);
        }
      } else {
        console.error('Weekly summary response not ok:', response.status);
      }
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
    } finally {
      setLoadingWeeklySummary(false);
    }
  };

  // Manual function to fetch SWOT analysis (only called when button is clicked)
  const handleRefreshSwotAnalysis = async (forceRegenerate = false) => {
    if (!clientId) return;
    
    setLoadingSwot(true);
    try {
      const url = forceRegenerate
        ? `/api/clients/${clientId}/swot-analysis?regenerate=true`
        : `/api/clients/${clientId}/swot-analysis`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSwotAnalysis(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching SWOT analysis:', error);
    } finally {
      setLoadingSwot(false);
    }
  };

  // Generate new AI analytics with time period
  const handleGenerateAnalytics = async () => {
    if (!clientId) return;

    // Calculate date range based on time period
    let startDate: Date;
    let endDate = new Date();
    
    const lastCheckIn = allocatedCheckIns
      .filter(c => c.status === 'completed')
      .sort((a, b) => {
        const dateA = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt || 0);
        const dateB = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt || 0);
        return dateB.getTime() - dateA.getTime();
      })[0];

    switch (timePeriod) {
      case 'all':
        // Use all available data - set start date to a very early date
        startDate = new Date('2020-01-01'); // Far back enough to capture all data
        break;
      case 'last-checkin':
        if (lastCheckIn) {
          const lastDate = lastCheckIn.completedAt?.toDate ? lastCheckIn.completedAt.toDate() : new Date(lastCheckIn.completedAt || 0);
          startDate = new Date(lastDate);
          startDate.setHours(0, 0, 0, 0);
        } else {
          alert('No check-ins found. Please select a different time period.');
          return;
        }
        break;
      case '2-weeks':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 14);
        break;
      case '1-month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '6-months':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1-year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) {
          alert('Please select both start and end dates for custom range.');
          return;
        }
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        break;
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
    }

    setGeneratingAnalytics(true);
    setShowGenerateAnalyticsModal(false);

    try {
      const params = new URLSearchParams({
        timePeriod,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const response = await fetch(`/api/clients/${clientId}/ai-analytics?${params.toString()}`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAiAnalytics(data.data);
        } else {
          alert('Failed to generate analytics: ' + (data.message || 'Unknown error'));
        }
      } else {
        alert('Failed to generate analytics. Please try again.');
      }
    } catch (error) {
      console.error('Error generating AI analytics:', error);
      alert('Error generating analytics. Please try again.');
    } finally {
      setGeneratingAnalytics(false);
    }
  };

  const getTimePeriodLabel = (period: string) => {
    switch (period) {
      case 'all': return 'All Available Data';
      case 'last-checkin': return 'Since Last Check-in';
      case '2-weeks': return 'Last 2 Weeks';
      case '1-month': return 'Last Month';
      case '6-months': return 'Last 6 Months';
      case '1-year': return 'Last Year';
      case 'custom': return 'Custom Range';
      default: return period;
    }
  };

  // Fetch client scoring configuration for traffic light system
  useEffect(() => {
    const fetchScoringConfig = async () => {
      if (!clientId || !db) return;
      
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

          setScoringThresholds(clientThresholds);
          
          // Update traffic light status for progress score
          if (client?.progressScore !== undefined) {
            setProgressTrafficLight(getTrafficLightStatus(client.progressScore, clientThresholds));
          }
        } else {
          // No scoring config, use default lifestyle thresholds
          const defaultThresholds = getDefaultThresholds('lifestyle');
          setScoringThresholds(defaultThresholds);
          if (client?.progressScore !== undefined) {
            setProgressTrafficLight(getTrafficLightStatus(client.progressScore, defaultThresholds));
          }
        }
      } catch (error) {
        console.error('Error fetching scoring config:', error);
        // Use default lifestyle thresholds on error
        const defaultThresholds = getDefaultThresholds('lifestyle');
        setScoringThresholds(defaultThresholds);
        if (client?.progressScore !== undefined) {
          setProgressTrafficLight(getTrafficLightStatus(client.progressScore, defaultThresholds));
        }
      }
    };

    if (clientId) {
      fetchScoringConfig();
    }
  }, [clientId, client?.progressScore]);

  // Fetch progress images
  useEffect(() => {
    const fetchProgressImages = async () => {
      const clientId = params.id as string;
      if (!clientId) return;

      setLoadingImages(true);
      try {
        const response = await fetch(`/api/progress-images?clientId=${clientId}&limit=12`);
        const data = await response.json();
        if (data.success) {
          setProgressImages(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching progress images:', error);
      } finally {
        setLoadingImages(false);
      }
    };

    fetchProgressImages();
  }, [params.id]);

  // Fetch onboarding report data
  useEffect(() => {
    const fetchOnboardingData = async () => {
      const clientId = params.id as string;
      if (!clientId) return;

      setLoadingOnboarding(true);
      try {
        const response = await fetch(`/api/client-portal/onboarding/report?clientId=${clientId}`);
        const data = await response.json();
        if (data.success) {
          setOnboardingData(data.data);
        }
      } catch (error) {
        console.error('Error fetching onboarding report:', error);
      } finally {
        setLoadingOnboarding(false);
      }
    };

    fetchOnboardingData();
  }, [params.id]);

  // Fetch measurement history
  useEffect(() => {
    const fetchMeasurementHistory = async () => {
      const clientId = params.id as string;
      if (!clientId) return;

      setLoadingMeasurements(true);
      try {
        // Fetch from client_measurements collection
        const response = await fetch(`/api/client-measurements?clientId=${clientId}`);
        const data = await response.json();
        if (data.success) {
          const measurements = data.data || [];
          setMeasurementHistory(measurements);
          
          // Also fetch onboarding data for baseline measurements
          let allMeasurements: any[] = [];
          
          try {
            const onboardingResponse = await fetch(`/api/client-portal/onboarding/report?clientId=${clientId}`);
            const onboardingData = await onboardingResponse.json();
            
            if (onboardingData.success && onboardingData.data) {
              const onboarding = onboardingData.data;
              if (onboarding.bodyWeight || (onboarding.measurements && Object.keys(onboarding.measurements).length > 0)) {
                let onboardingDate = new Date();
                if (onboarding.completedAt) {
                  onboardingDate = new Date(onboarding.completedAt);
                } else if (onboarding.createdAt) {
                  onboardingDate = new Date(onboarding.createdAt);
                } else {
                  onboardingDate = new Date('2020-01-01');
                }
                
                allMeasurements.push({
                  date: onboardingDate,
                  bodyWeight: onboarding.bodyWeight || null,
                  measurements: onboarding.measurements || {},
                  isBaseline: true
                });
              }
            }
          } catch (error) {
            console.log('Error fetching onboarding data:', error);
          }
          
          // Add regular measurements
          const clientMeasurements = measurements.map((m: any) => ({
            date: new Date(m.date),
            bodyWeight: m.bodyWeight,
            measurements: m.measurements || {},
            isBaseline: false
          }));
          allMeasurements = [...allMeasurements, ...clientMeasurements];
          
          // Sort by date
          allMeasurements.sort((a, b) => a.date.getTime() - b.date.getTime());
          setAllMeasurementsData(allMeasurements);
        }
      } catch (error) {
        console.error('Error fetching measurement history:', error);
        setMeasurementHistory([]);
        setAllMeasurementsData([]);
      } finally {
        setLoadingMeasurements(false);
      }
    };

    fetchMeasurementHistory();
  }, [params.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'at-risk': return 'bg-red-100 text-red-800';
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

  // Helper functions for measurements
  const getAvailableMeasurements = () => {
    const available = new Set<string>();
    
    allMeasurementsData.forEach(m => {
      if (m.bodyWeight !== null && m.bodyWeight !== undefined && m.bodyWeight > 0) {
        available.add('bodyWeight');
      }
      if (m.measurements) {
        Object.keys(m.measurements).forEach(key => {
          if (m.measurements[key] !== null && m.measurements[key] !== undefined && m.measurements[key] > 0) {
            available.add(key);
          }
        });
      }
    });
    
    return Array.from(available);
  };

  const toggleMeasurement = (measurement: string) => {
    const newSet = new Set(selectedMeasurements);
    if (newSet.has(measurement)) {
      newSet.delete(measurement);
    } else {
      newSet.add(measurement);
    }
    setSelectedMeasurements(newSet);
  };

  const getMeasurementColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-yellow-500'
    ];
    return colors[index % colors.length];
  };

  const getMeasurementLabel = (key: string) => {
    const labels: { [key: string]: string } = {
      bodyWeight: 'Body Weight (kg)',
      waist: 'Waist (cm)',
      chest: 'Chest (cm)',
      hips: 'Hips (cm)',
      leftThigh: 'Left Thigh (cm)',
      rightThigh: 'Right Thigh (cm)',
      leftArm: 'Left Arm (cm)',
      rightArm: 'Right Arm (cm)'
    };
    return labels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
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
    setAllocateFirstCheckInDate('');
    setAllocateDuration(4);
    setAllocateFrequency('weekly');
    // Set default dates when opening modal: today for both start and first check-in
    const today = new Date().toISOString().split('T')[0];
    setAllocateStartDate(today);
    setAllocateFirstCheckInDate(today);
    setShowAllocateModal(true);
    fetchForms(); // Fetch forms when modal opens
  };

  // Calculate the 2nd Friday after a given start date
  const calculateSecondFriday = (startDate: Date): Date | null => {
    if (!startDate) return null;
    
    const date = new Date(startDate);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 5 = Friday
    
    // Calculate days until next Friday
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0 && dayOfWeek !== 5) {
      daysUntilFriday = 7; // If today is Friday and we want next Friday, add 7 days
    }
    
    // Get first Friday
    const firstFriday = new Date(date);
    firstFriday.setDate(date.getDate() + daysUntilFriday);
    
    // Add 7 more days to get 2nd Friday
    const secondFriday = new Date(firstFriday);
    secondFriday.setDate(firstFriday.getDate() + 7);
    
    return secondFriday;
  };

  // Calculate first check-in window start date/time
  const getFirstCheckInWindowStart = (): { date: string; time: string; displayText: string } | null => {
    if (!allocateFirstCheckInDate || !allocateCheckInWindow.enabled) {
      return null;
    }

    const firstCheckInDate = new Date(allocateFirstCheckInDate);
    const dayMap: { [key: string]: number } = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    const startDayNum = dayMap[allocateCheckInWindow.startDay.toLowerCase()] ?? 5;
    const firstCheckInDay = firstCheckInDate.getDay();
    
    // Calculate days to go back to get to the start day
    // If firstCheckInDay >= startDayNum, go back (firstCheckInDay - startDayNum) days
    // If firstCheckInDay < startDayNum, go back (firstCheckInDay - startDayNum + 7) days (previous week)
    let daysToStart: number;
    if (firstCheckInDay >= startDayNum) {
      daysToStart = firstCheckInDay - startDayNum;
    } else {
      daysToStart = firstCheckInDay - startDayNum + 7;
    }
    
    const windowStartDate = new Date(firstCheckInDate);
    windowStartDate.setDate(firstCheckInDate.getDate() - daysToStart);
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[windowStartDate.getDay()];
    
    // Format time for display (convert 24h to 12h)
    const [hours, minutes] = allocateCheckInWindow.startTime.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    
    return {
      date: windowStartDate.toISOString().split('T')[0],
      time: allocateCheckInWindow.startTime,
      displayText: `${dayName}, ${windowStartDate.toLocaleDateString()} at ${displayTime}`
    };
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
          firstCheckInDate: allocateFirstCheckInDate || allocateStartDate,
          dueTime: '09:00', // Default due time, no longer user-configurable
          checkInWindow: allocateCheckInWindow.enabled ? allocateCheckInWindow : null,
          status: 'pending',
          measurementSchedule: measurementScheduleEnabled && firstMeasurementFriday ? {
            enabled: true,
            firstFridayDate: firstMeasurementFriday,
            frequency: 'fortnightly'
          } : null
        }),
      });

      if (response.ok) {
        // Calculate next measurement dates if schedule is enabled
        let nextMeasurementDates: string[] = [];
        if (measurementScheduleEnabled && firstMeasurementFriday) {
          try {
            const { calculateNextMeasurementDates } = await import('@/lib/measurement-task-utils');
            const schedule = {
              clientId: client.id,
              coachId: userProfile?.uid || '',
              firstFridayDate: firstMeasurementFriday,
              frequency: 'fortnightly' as const,
              isActive: true
            };
            nextMeasurementDates = calculateNextMeasurementDates(schedule, 6); // Show next 6 measurement dates
          } catch (error) {
            console.error('Error calculating measurement dates:', error);
          }
        }

        // Store summary data before clearing form
        const formTitle = selectedFormData?.title || 'Selected Form';
        setAllocationSummary({
          formTitle,
          frequency: allocateFrequency,
          duration: allocateDuration,
          startDate: allocateStartDate,
          firstCheckInDate: allocateFirstCheckInDate || allocateStartDate,
          checkInWindow: allocateCheckInWindow.enabled ? allocateCheckInWindow : undefined,
          measurementSchedule: measurementScheduleEnabled && firstMeasurementFriday ? {
            enabled: true,
            firstFridayDate: firstMeasurementFriday,
            frequency: 'fortnightly',
            nextDates: nextMeasurementDates
          } : null
        });

        // Clear form fields
        setSelectedAllocateForm('');
        setAllocateStartDate('');
        setAllocateFirstCheckInDate('');
        setAllocateDuration(4);
        setAllocateFrequency('weekly');
        setAllocateCheckInWindow({
          enabled: true,
          startDay: 'friday',
          startTime: '10:00',
          endDay: 'monday',
          endTime: '22:00'
        });
        setMeasurementScheduleEnabled(false);
        setFirstMeasurementFriday('');

        // Close allocation modal and show summary
        setShowAllocateModal(false);
        setShowAllocationSummary(true);
        
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
      if (!userProfile?.uid) {
        alert('You must be logged in as a coach to delete check-ins.');
        setDeletingCheckIn(false);
        return;
      }
      
      const response = await fetch(`/api/check-in-assignments/${checkInId}?coachId=${userProfile.uid}`, {
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
      if (!userProfile?.uid) {
        alert('You must be logged in as a coach to delete check-in series.');
        setDeletingSeries(false);
        return;
      }
      
      const response = await fetch('/api/check-in-assignments/series', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId,
          formId: formId,
          preserveHistory: preserveHistory,
          coachId: userProfile.uid // SECURITY: Required for authorization
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

  const openPauseModal = (formId: string, formTitle: string) => {
    setSelectedSeriesForPause({ formId, formTitle });
    setPauseWeeks(1);
    setPauseResumeDate('');
    setPauseInputMode('weeks');
    setShowPauseModal(true);
  };

  const handleUnpauseSeries = async (formId: string, formTitle: string) => {
    if (!confirm(`Are you sure you want to unpause the "${formTitle}" check-in series? All check-ins will return to their original due dates.`)) {
      return;
    }

    setUnpausingSeries(true);
    try {
      if (!userProfile?.uid) {
        alert('You must be logged in as a coach to unpause check-in series.');
        setUnpausingSeries(false);
        return;
      }
      
      const response = await fetch('/api/check-in-assignments/series/unpause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId,
          formId: formId,
          coachId: userProfile.uid
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        // Refresh check-ins
        setHasLoadedCheckIns(false);
        fetchAllocatedCheckIns();
      } else {
        const errorData = await response.json();
        alert(`Failed to unpause series: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error unpausing series:', error);
      alert('Error unpausing series. Please try again.');
    } finally {
      setUnpausingSeries(false);
    }
  };

  const handlePauseSeries = async () => {
    if (!selectedSeriesForPause || !client) {
      return;
    }

    // Calculate pauseWeeks based on input mode
    let calculatedPauseWeeks = pauseWeeks;
    if (pauseInputMode === 'date' && pauseResumeDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const resumeDate = new Date(pauseResumeDate);
      resumeDate.setHours(0, 0, 0, 0);
      
      if (resumeDate <= today) {
        alert('Resume date must be in the future.');
        return;
      }
      
      const daysDiff = Math.ceil((resumeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      calculatedPauseWeeks = Math.ceil(daysDiff / 7);
      
      if (calculatedPauseWeeks < 1) {
        calculatedPauseWeeks = 1;
      }
    }

    if (calculatedPauseWeeks < 1) {
      alert('Please enter a valid pause duration.');
      return;
    }

    setPausingSeries(true);
    try {
      if (!userProfile?.uid) {
        alert('You must be logged in as a coach to pause check-in series.');
        setPausingSeries(false);
        return;
      }
      
      const response = await fetch('/api/check-in-assignments/series/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId,
          formId: selectedSeriesForPause.formId,
          pauseWeeks: calculatedPauseWeeks,
          coachId: userProfile.uid
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        setShowPauseModal(false);
        setSelectedSeriesForPause(null);
        setPauseWeeks(1);
        setPauseResumeDate('');
        setPauseInputMode('weeks');
        // Refresh check-ins
        setHasLoadedCheckIns(false);
        fetchAllocatedCheckIns();
      } else {
        const errorData = await response.json();
        alert(`Failed to pause series: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error pausing series:', error);
      alert('Error pausing series. Please try again.');
    } finally {
      setPausingSeries(false);
    }
  };

  // Quick Send Modal Component
  const QuickSendModal = () => {
    if (!showQuickSendModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 bg-orange-50 border-b-2 border-orange-200 rounded-t-3xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                    value={isNaN(durationWeeks) || durationWeeks === 0 ? '' : durationWeeks}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setDurationWeeks(1); // Reset to default when empty
                      } else {
                        const numVal = Number(val);
                        if (!isNaN(numVal) && numVal > 0) {
                          setDurationWeeks(numVal);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                className="flex-1 px-4 py-2 border border-gray-300 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickSend}
                disabled={!selectedForm || isSending || (isRecurring && (!startDate || durationWeeks < 1))}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-2xl text-sm font-medium shadow-sm"
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
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 bg-orange-50 border-b-2 border-orange-200 rounded-t-3xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select status...</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="at-risk">At Risk</option>
                <option value="archived">Archived</option>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setShowStatusModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={!newStatus || updatingStatus}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {/* Preview */}
                {allocateStartDate && allocateDuration > 0 && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Schedule Preview:</strong><br />
                      {isRecurring ? 'Recurring check-in' : 'Single check-in'} scheduled for {new Date(allocateStartDate).toLocaleDateString()}
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
                className="flex-1 px-4 py-2 border border-gray-300 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAllocateCheckIn}
                disabled={!selectedAllocateForm || !allocateStartDate || allocatingCheckIn}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
      <RoleProtected requiredRole="coach">
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
      </RoleProtected>
    );
  }

  if (error || !client) {
    return (
      <RoleProtected requiredRole="coach">
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
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Compact Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Link
                  href="/clients"
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                  title="Back to Clients"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </Link>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-lg">
                    {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {client.firstName} {client.lastName}
                  </h1>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      client.status === 'active' ? 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20' :
                      client.status === 'inactive' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                      client.status === 'pending' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                      client.status === 'at-risk' ? 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20' : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      {client.status}
                    </span>
                    {client.email && (
                      <span className="text-xs text-gray-600">{client.email}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openStatusModal(client.status)}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-white rounded-lg border border-gray-200 transition-colors"
                  title="Update Status"
                >
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Status
                </button>
                <Link
                  href={`/clients/${clientId}/edit`}
                  className="px-4 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-medium transition-all duration-200 shadow-sm"
                >
                  Edit Profile
                </Link>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                  activeTab === 'overview'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('progress')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                  activeTab === 'progress'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Progress
              </button>
              <button
                onClick={() => setActiveTab('checkins')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                  activeTab === 'checkins'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Check-ins
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                  activeTab === 'history'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                History
              </button>
              <button
                onClick={() => setActiveTab('ai-analytics')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${
                  activeTab === 'ai-analytics'
                    ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                AI Analytics
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Compact Overview & Progress Combined */}
              <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Progress Score - Compact with Traffic Light */}
                    <div className={`rounded-2xl p-4 border ${
                      progressTrafficLight === 'red' ? 'bg-[#FF3B30]/10 border-[#FF3B30]/20' :
                      progressTrafficLight === 'orange' ? 'bg-orange-50 border-orange-200' :
                      'bg-[#34C759]/10 border-[#34C759]/20'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-medium text-gray-600">Progress Score</div>
                        <div className="text-lg">{getTrafficLightIcon(progressTrafficLight)}</div>
                      </div>
                      <div className={`text-3xl font-bold mb-2 ${
                        progressTrafficLight === 'red' ? 'text-[#FF3B30]' :
                        progressTrafficLight === 'orange' ? 'text-orange-600' : 'text-[#34C759]'
                      }`}>
                        {client.progressScore || 0}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            progressTrafficLight === 'red' ? 'bg-[#FF3B30]' :
                            progressTrafficLight === 'orange' ? 'bg-orange-500' : 'bg-[#34C759]'
                          }`}
                          style={{ width: `${Math.min(client.progressScore || 0, 100)}%` }}
                        ></div>
                      </div>
                      <div className={`text-[10px] font-medium mt-1 ${
                        progressTrafficLight === 'red' ? 'text-[#FF3B30]' :
                        progressTrafficLight === 'orange' ? 'text-orange-700' : 'text-[#34C759]'
                      }`}>
                        {getTrafficLightLabel(progressTrafficLight)}
                      </div>
                    </div>

                    {/* Total Check-ins */}
                    <div className="bg-orange-50 rounded-2xl p-4 border border-orange-200">
                      <div className="text-xs font-medium text-gray-600 mb-1">Check-ins</div>
                      <div className="text-3xl font-bold text-gray-900">{client.completedCheckIns || 0}</div>
                      <div className="text-xs text-gray-600 mt-1">Total completed</div>
                    </div>

                    {/* Completion Rate */}
                    <div className="bg-orange-50 rounded-2xl p-4 border border-orange-200">
                      <div className="text-xs font-medium text-gray-600 mb-1">Completion</div>
                      <div className="text-3xl font-bold text-gray-900">{client.completionRate || 0}%</div>
                      <div className="text-xs text-gray-600 mt-1">Rate</div>
                    </div>

                    {/* Last Activity */}
                    <div className="bg-orange-50 rounded-2xl p-4 border border-orange-200">
                      <div className="text-xs font-medium text-gray-600 mb-1">Last Activity</div>
                      <div className="text-sm font-bold text-gray-900">
                        {client.lastCheckIn ? 
                          formatDate(client.lastCheckIn) : 
                          'Never'
                        }
                      </div>
                      {client.phone && (
                        <div className="text-xs text-gray-500 mt-1">{client.phone}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly AI Summary */}
              {loadingWeeklySummary ? (
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b-2 border-purple-200">
                    <h2 className="text-xl font-bold text-gray-900">This Week's Status</h2>
                    <p className="text-sm text-gray-600 mt-1">AI-powered weekly summary</p>
                  </div>
                  <div className="p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                      <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                    </div>
                  </div>
                </div>
              ) : !weeklySummary && !loadingWeeklySummary ? (
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b-2 border-purple-200">
                    <h2 className="text-xl font-bold text-gray-900">This Week's Status</h2>
                    <p className="text-sm text-gray-600 mt-1">AI-powered weekly summary</p>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-gray-600 mb-4">Generate an AI-powered weekly summary</p>
                    <button
                      onClick={() => handleRefreshWeeklySummary(true)}
                      disabled={loadingWeeklySummary}
                      className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {loadingWeeklySummary ? 'Generating...' : 'Generate Weekly Summary'}
                    </button>
                  </div>
                </div>
              ) : weeklySummary ? (
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b-2 border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">This Week's Status</h2>
                        <p className="text-sm text-gray-600 mt-1">
                          AI-powered weekly summary • {new Date(weeklySummary.dateRange.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRefreshWeeklySummary(true)}
                        disabled={loadingWeeklySummary}
                        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {loadingWeeklySummary ? 'Generating...' : 'Refresh'}
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="prose max-w-none">
                      <p className="text-gray-800 leading-relaxed whitespace-pre-line text-sm">
                        {weeklySummary.summary}
                      </p>
                    </div>
                    {weeklySummary.checkInsCount !== undefined && (
                      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-6 text-xs text-gray-600">
                        <span>Check-ins: {weeklySummary.checkInsCount}</span>
                        {weeklySummary.averageScore !== null && (
                          <span>Avg Score: {weeklySummary.averageScore}%</span>
                        )}
                        {weeklySummary.measurementsCount > 0 && (
                          <span>Measurements: {weeklySummary.measurementsCount}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* SWOT Analysis */}
              {loadingSwot ? (
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b-2 border-indigo-200">
                    <h2 className="text-xl font-bold text-gray-900">SWOT Analysis</h2>
                    <p className="text-sm text-gray-600 mt-1">Strengths, Weaknesses, Opportunities, Threats</p>
                  </div>
                  <div className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="h-32 bg-gray-200 rounded-xl"></div>
                        <div className="h-32 bg-gray-200 rounded-xl"></div>
                        <div className="h-32 bg-gray-200 rounded-xl"></div>
                        <div className="h-32 bg-gray-200 rounded-xl"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : !swotAnalysis && !loadingSwot ? (
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b-2 border-indigo-200">
                    <h2 className="text-xl font-bold text-gray-900">SWOT Analysis</h2>
                    <p className="text-sm text-gray-600 mt-1">Comprehensive analysis of current progress</p>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-gray-600 mb-4">Generate a comprehensive SWOT analysis</p>
                    <button
                      onClick={() => handleRefreshSwotAnalysis(true)}
                      disabled={loadingSwot}
                      className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {loadingSwot ? 'Generating...' : 'Generate SWOT Analysis'}
                    </button>
                  </div>
                </div>
              ) : swotAnalysis ? (
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b-2 border-indigo-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">SWOT Analysis</h2>
                        <p className="text-sm text-gray-600 mt-1">Comprehensive analysis of current progress</p>
                      </div>
                      <button
                        onClick={() => handleRefreshSwotAnalysis(true)}
                        disabled={loadingSwot}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {loadingSwot ? 'Generating...' : 'Refresh'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* Strengths */}
                      <div className="bg-green-50 rounded-xl p-5 border-2 border-green-200">
                        <div className="flex items-center mb-3">
                          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">S</span>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Strengths</h3>
                        </div>
                        <ul className="space-y-2">
                          {swotAnalysis.strengths?.map((strength: string, idx: number) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-green-600 mr-2 mt-1">✓</span>
                              <span className="text-gray-800 text-sm">{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Weaknesses */}
                      <div className="bg-orange-50 rounded-xl p-5 border-2 border-orange-200">
                        <div className="flex items-center mb-3">
                          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">W</span>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Weaknesses</h3>
                        </div>
                        <ul className="space-y-2">
                          {swotAnalysis.weaknesses?.map((weakness: string, idx: number) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-orange-600 mr-2 mt-1">⚠</span>
                              <span className="text-gray-800 text-sm">{weakness}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Opportunities */}
                      <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
                        <div className="flex items-center mb-3">
                          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">O</span>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Opportunities</h3>
                        </div>
                        <ul className="space-y-2">
                          {swotAnalysis.opportunities?.map((opportunity: string, idx: number) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-blue-600 mr-2 mt-1">→</span>
                              <span className="text-gray-800 text-sm">{opportunity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Threats */}
                      <div className="bg-red-50 rounded-xl p-5 border-2 border-red-200">
                        <div className="flex items-center mb-3">
                          <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">T</span>
                          </div>
                          <h3 className="text-lg font-bold text-gray-900">Threats</h3>
                        </div>
                        <ul className="space-y-2">
                          {swotAnalysis.threats?.map((threat: string, idx: number) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-red-600 mr-2 mt-1">!</span>
                              <span className="text-gray-800 text-sm">{threat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Overall Assessment */}
                    {swotAnalysis.overallAssessment && (
                      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 mt-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-3">Overall Assessment</h3>
                        <p className="text-gray-800 leading-relaxed text-sm whitespace-pre-line">
                          {swotAnalysis.overallAssessment}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Quick Insights Panel */}
              <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b-2 border-blue-200">
                  <h2 className="text-xl font-bold text-gray-900">Quick Insights</h2>
                  <p className="text-sm text-gray-600 mt-1">Action items and key information at a glance</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pending Check-ins */}
                    {(() => {
                      // Only show completed check-ins that haven't been reviewed yet
                      const pendingCheckIns = allocatedCheckIns.filter(ci => 
                        ci.status === 'completed' && !ci.coachResponded
                      );
                      const overdueCheckIns = allocatedCheckIns.filter(ci => {
                        // Exclude completed check-ins
                        if (ci.status === 'completed') return false;
                        if (!ci.dueDate) return false;
                        const dueDate = ci.dueDate?.toDate ? ci.dueDate.toDate() : new Date(ci.dueDate);
                        return dueDate < new Date();
                      });
                      return (
                        <>
                          {pendingCheckIns.length > 0 && (
                            <div className="flex items-start space-x-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
                              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold text-sm">{pendingCheckIns.length}</span>
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900 text-sm">Check-ins Pending Review</p>
                                <p className="text-xs text-gray-600 mt-1">{pendingCheckIns.length} check-in{pendingCheckIns.length !== 1 ? 's' : ''} need your attention</p>
                                <button
                                  onClick={() => {
                                    setActiveTab('checkins');
                                    setCheckInTab('pendingReview');
                                  }}
                                  className="text-xs text-orange-600 hover:text-orange-700 font-medium mt-2"
                                >
                                  Review now →
                                </button>
                              </div>
                            </div>
                          )}
                          {overdueCheckIns.length > 0 && (
                            <div className="flex items-start space-x-3 p-4 bg-red-50 rounded-xl border border-red-200">
                              <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold text-sm">{overdueCheckIns.length}</span>
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900 text-sm">Overdue Check-ins</p>
                                <p className="text-xs text-gray-600 mt-1">{overdueCheckIns.length} check-in{overdueCheckIns.length !== 1 ? 's' : ''} past due date</p>
                                <button
                                  onClick={() => setActiveTab('checkins')}
                                  className="text-xs text-red-600 hover:text-red-700 font-medium mt-2"
                                >
                                  View overdue →
                                </button>
                              </div>
                            </div>
                          )}
                          {(() => {
                            // Find the next pending check-in
                            const nextCheckIn = allocatedCheckIns
                              .filter(c => c.status === 'pending' || c.status === 'active')
                              .sort((a, b) => {
                                const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                                const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                                return dateA - dateB; // Sort ascending (earliest first)
                              })[0];
                            
                            if (nextCheckIn && nextCheckIn.dueDate) {
                              const dueDate = new Date(nextCheckIn.dueDate);
                              const now = new Date();
                              const isOverdue = dueDate < now;
                              const weekInfo = nextCheckIn.isRecurring && nextCheckIn.recurringWeek
                                ? `Week ${nextCheckIn.recurringWeek}${nextCheckIn.totalWeeks ? `/${nextCheckIn.totalWeeks}` : ''}`
                                : '';
                              
                              return (
                                <div className={`flex items-start space-x-3 p-4 rounded-xl border ${
                                  isOverdue 
                                    ? 'bg-red-50 border-red-200' 
                                    : 'bg-blue-50 border-blue-200'
                                }`}>
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    isOverdue ? 'bg-red-500' : 'bg-blue-500'
                                  }`}>
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-900 text-sm">Next Check-in</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {weekInfo && (
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                          isOverdue 
                                            ? 'bg-red-100 text-red-800' 
                                            : 'bg-blue-100 text-blue-800'
                                        }`}>
                                          {weekInfo}
                                        </span>
                                      )}
                                      <p className={`text-xs font-medium ${
                                        isOverdue ? 'text-red-700' : 'text-blue-700'
                                      }`}>
                                        Due: {formatDate(dueDate)}
                                      </p>
                                    </div>
                                    {!isOverdue && (
                                      <button
                                        onClick={() => setActiveTab('checkins')}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2"
                                      >
                                        View check-ins →
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </>
                      );
                    })()}

                    {/* Onboarding Status */}
                    {onboardingData && (
                      <div className={`flex items-start space-x-3 p-4 rounded-xl border ${
                        onboardingData.status === 'submitted' 
                          ? 'bg-green-50 border-green-200' 
                          : onboardingData.status === 'completed'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          onboardingData.status === 'submitted' 
                            ? 'bg-green-500' 
                            : onboardingData.status === 'completed'
                            ? 'bg-blue-500'
                            : 'bg-yellow-500'
                        }`}>
                          <span className="text-white text-lg">
                            {onboardingData.status === 'submitted' ? '✓' : onboardingData.status === 'completed' ? '✓' : '⏳'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">Onboarding</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {onboardingData.status === 'submitted' 
                              ? 'Submitted - Review responses' 
                              : onboardingData.status === 'completed'
                              ? 'Completed'
                              : `${onboardingData.progress?.completionPercentage || 0}% complete`}
                          </p>
                          {onboardingData.status === 'submitted' && (
                            <Link
                              href={`/clients/${clientId}/onboarding-report`}
                              target="_blank"
                              className="text-xs text-green-600 hover:text-green-700 font-medium mt-2 inline-block"
                            >
                              View report →
                            </Link>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Activity Alert */}
                    {(() => {
                      const daysSinceLastCheckIn = client.lastCheckIn 
                        ? Math.floor((new Date().getTime() - new Date(client.lastCheckIn).getTime()) / (1000 * 60 * 60 * 24))
                        : null;
                      const needsAttention = daysSinceLastCheckIn !== null && daysSinceLastCheckIn > 7;
                      return needsAttention ? (
                        <div className="flex items-start space-x-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                          <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-lg">⚠️</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 text-sm">Low Activity</p>
                            <p className="text-xs text-gray-600 mt-1">No check-in in {daysSinceLastCheckIn} days</p>
                            <button
                              onClick={openQuickSendModal}
                              className="text-xs text-amber-600 hover:text-amber-700 font-medium mt-2"
                            >
                              Send check-in →
                            </button>
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Progress Trend */}
                    {client.progressScore !== undefined && (
                      <div className="flex items-start space-x-3 p-4 bg-purple-50 rounded-xl border border-purple-200">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          progressTrafficLight === 'red' 
                            ? 'bg-red-500' 
                            : progressTrafficLight === 'orange'
                            ? 'bg-orange-500'
                            : 'bg-green-500'
                        }`}>
                          <span className="text-white text-lg">{getTrafficLightIcon(progressTrafficLight)}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">Progress Status</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {getTrafficLightLabel(progressTrafficLight)} - {client.progressScore}%
                          </p>
                          <Link
                            href={`/clients/${clientId}/progress`}
                            className="text-xs text-purple-600 hover:text-purple-700 font-medium mt-2 inline-block"
                          >
                            View details →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Onboarding Summary - Compact */}
              {onboardingData && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-green-50 px-6 py-4 border-b-2 border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">Onboarding Questionnaire</h2>
                        <p className="text-xs text-gray-600 mt-1">
                          {onboardingData.submittedAt 
                            ? `Submitted ${new Date(onboardingData.submittedAt).toLocaleDateString()}`
                            : 'In progress'}
                        </p>
                      </div>
                      {onboardingData.status === 'submitted' && (
                        <span className="px-2 py-1 bg-green-600 text-white rounded-full text-xs font-medium">
                          Submitted
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-6">
                    {onboardingData.sections && onboardingData.sections.length > 0 ? (
                      <div className="space-y-3">
                        {onboardingData.sections.slice(0, 3).map((section: any) => (
                          <div key={section.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <span className="text-xl">{section.icon}</span>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  Section {section.id}: {section.name}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {section.questions.filter((q: any) => q.answered).length} / {section.questions.length} answered
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {onboardingData.sections.length > 3 && (
                          <p className="text-xs text-gray-500 text-center pt-2">
                            + {onboardingData.sections.length - 3} more sections
                          </p>
                        )}
                        <Link
                          href={`/clients/${clientId}/onboarding-report`}
                          target="_blank"
                          className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium text-center transition-all duration-200 shadow-sm block"
                        >
                          View Full Report →
                        </Link>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">No onboarding data available yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
                </div>
              )}

              {/* PROGRESS TAB */}
              {activeTab === 'progress' && (
                <div className="space-y-6">
              {/* Question Progress Grid */}
              {questionProgress.length > 0 && (
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                  <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Question Progress Over Time</h2>
                        <p className="text-sm text-gray-600 mt-1">Track how each question improves week by week</p>
                      </div>
                      <button
                        onClick={() => setQuestionProgressExpanded(!questionProgressExpanded)}
                        className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition-all border border-gray-200"
                      >
                        {questionProgressExpanded ? 'Collapse' : 'Expand'}
                      </button>
                    </div>
                  </div>
                  
                  {questionProgressExpanded && (
                    <>
                      {/* Legend */}
                      <div className="flex items-center gap-3 px-6 py-3 bg-gray-50/50 border-b border-gray-100">
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                      <span className="text-[10px] text-gray-600 font-medium">Good (7-10)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                      <span className="text-[10px] text-gray-600 font-medium">Moderate (4-6)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      <span className="text-[10px] text-gray-600 font-medium">Needs Attention (0-3)</span>
                    </div>
                  </div>

                  {/* Progress Grid */}
                  {loadingQuestionProgress ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                      <p className="text-gray-500 text-sm">Loading question progress...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10">
                          <tr className="bg-gray-50/30">
                            <th className="text-left py-1.5 px-3 font-semibold text-[10px] text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50/95 backdrop-blur-sm z-20 min-w-[160px] border-r border-gray-100">
                              Question
                            </th>
                            {questionProgress[0]?.weeks.map((week: any, index: number) => (
                              <th
                                key={index}
                                className="text-center py-1.5 px-1 font-semibold text-[10px] text-gray-600 uppercase tracking-wider min-w-[60px]"
                              >
                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] text-gray-500 font-medium">W{week.week}</span>
                                  <span className="text-[9px] text-gray-400">{week.date}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {questionProgress.map((question, qIndex) => (
                            <tr 
                              key={question.questionId} 
                              className={`transition-colors hover:bg-gray-50/50 ${
                                qIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                              }`}
                            >
                              <td className="py-1.5 px-3 text-xs font-medium text-gray-900 sticky left-0 bg-inherit z-10 border-r border-gray-100">
                                <div className="max-w-[160px] line-clamp-2 leading-tight">
                                  {question.questionText}
                                </div>
                              </td>
                              {question.weeks.map((week: any, wIndex: number) => (
                                <td
                                  key={wIndex}
                                  className="text-center py-1.5 px-1"
                                >
                                  <div
                                    className={`w-6 h-6 rounded-full ${getStatusColor(week.status)} ${getStatusBorder(week.status)} flex items-center justify-center transition-all hover:scale-125 cursor-pointer shadow-sm mx-auto`}
                                    title={`Week ${week.week}: Score ${week.score}/10 - ${week.date}`}
                                    onClick={() => setSelectedResponse({
                                      question: question.questionText,
                                      answer: week.answer,
                                      score: week.score,
                                      date: week.date,
                                      week: week.week,
                                      type: week.type
                                    })}
                                  >
                                    <span className="text-white text-[9px] font-bold">{week.score}</span>
                                  </div>
                                </td>
                              ))}
                              {/* Fill empty weeks if needed */}
                              {Array.from({ length: Math.max(0, (questionProgress[0]?.weeks.length || 0) - question.weeks.length) }).map((_, emptyIndex) => (
                                <td key={`empty-${emptyIndex}`} className="text-center py-1.5 px-1">
                                  <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 mx-auto"></div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}

              {/* Progress Images */}
              {activeTab === 'progress' && (
                <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Progress Images</h2>
                    {progressImages.length > 0 && (
                      <button
                        onClick={() => {
                          setComparisonMode(!comparisonMode);
                          if (comparisonMode) {
                            setSelectedForComparison([]);
                          }
                        }}
                        className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 ${
                          comparisonMode
                            ? 'bg-[#34C759] text-white shadow-sm'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                        }`}
                      >
                        {comparisonMode ? 'Exit Compare' : 'Select to Compare'}
                      </button>
                    )}
                  </div>
                  
                  {/* Filters and Comparison Controls */}
                  {progressImages.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="text-xs font-medium text-gray-900">Filter by view:</span>
                          <button
                            onClick={() => setFilterOrientation('all')}
                            className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all ${
                              filterOrientation === 'all'
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                            }`}
                          >
                            All
                          </button>
                          <button
                            onClick={() => setFilterOrientation('front')}
                            className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all ${
                              filterOrientation === 'front'
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                            }`}
                          >
                            Front
                          </button>
                          <button
                            onClick={() => setFilterOrientation('back')}
                            className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all ${
                              filterOrientation === 'back'
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                            }`}
                          >
                            Back
                          </button>
                          <button
                            onClick={() => setFilterOrientation('side')}
                            className={`px-3 py-1.5 rounded-2xl text-xs font-medium transition-all ${
                              filterOrientation === 'side'
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                            }`}
                          >
                            Side
                          </button>
                        </div>
                        
                        {selectedForComparison.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-900 font-medium">
                              {selectedForComparison.length} selected
                            </span>
                            <button
                              onClick={() => {
                                setSelectedForComparison([]);
                                setComparisonMode(false);
                              }}
                              className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium border border-gray-300"
                            >
                              Clear
                            </button>
                            <button
                              onClick={() => setComparisonMode(true)}
                              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-xs font-medium shadow-sm"
                            >
                              Compare ({selectedForComparison.length})
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Date Filter */}
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-gray-900">Filter by date:</span>
                        <select
                          value={filterDate}
                          onChange={(e) => setFilterDate(e.target.value)}
                          className="px-3 py-1.5 rounded-2xl text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="all">All Dates</option>
                          {(() => {
                            const dates = progressImages.map(img => {
                              const date = new Date(img.uploadedAt);
                              return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                            });
                            return Array.from(new Set(dates)).sort((a, b) => {
                              return new Date(b).getTime() - new Date(a).getTime();
                            }).map(date => (
                              <option key={date} value={date}>{date}</option>
                            ));
                          })()}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  {loadingImages ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-3"></div>
                      <p className="text-gray-500 text-sm">Loading images...</p>
                    </div>
                  ) : progressImages.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm mb-1">No progress images yet</p>
                      <p className="text-gray-400 text-xs">Client photos will appear here as they're uploaded</p>
                    </div>
                  ) : (
                    <>
                      {/* Comparison View */}
                      {comparisonMode && selectedForComparison.length > 0 && (
                        <div className="mb-6 bg-gray-50 rounded-xl border-2 border-blue-200 p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Side-by-Side Comparison</h3>
                            <button
                              onClick={() => {
                                setSelectedForComparison([]);
                                setComparisonMode(false);
                              }}
                              className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium border border-gray-300"
                            >
                              Close Comparison
                            </button>
                          </div>
                          <div className={`grid gap-4 ${
                            selectedForComparison.length === 1 ? 'grid-cols-1' :
                            selectedForComparison.length === 2 ? 'grid-cols-2' :
                            selectedForComparison.length === 3 ? 'grid-cols-3' :
                            'grid-cols-2 md:grid-cols-4'
                          }`}>
                            {progressImages.filter(img => selectedForComparison.includes(img.id)).map((image) => (
                              <div key={image.id} className="bg-white rounded-xl border-2 border-blue-400 shadow-lg overflow-hidden">
                                <div className="aspect-square relative">
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
                                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
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
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        image.orientation === 'front' ? 'bg-pink-100 text-pink-800' :
                                        image.orientation === 'back' ? 'bg-indigo-100 text-indigo-800' :
                                        'bg-teal-100 text-teal-800'
                                      }`}>
                                        {image.orientation.charAt(0).toUpperCase() + image.orientation.slice(1)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Filtered Images Grid */}
                      {(() => {
                        const filteredImages = progressImages.filter(img => {
                          const orientationMatch = filterOrientation === 'all' || img.orientation === filterOrientation;
                          if (filterDate === 'all') return orientationMatch;
                          
                          const imgDate = new Date(img.uploadedAt);
                          const imgDateKey = imgDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                          return orientationMatch && imgDateKey === filterDate;
                        });

                        if (filteredImages.length === 0) {
                          return (
                            <div className="text-center py-12">
                              <p className="text-gray-500 text-sm">No {filterOrientation !== 'all' ? filterOrientation : ''} images found for the selected date</p>
                            </div>
                          );
                        }

                        // Group by date
                        const groupedImages: { [key: string]: any[] } = {};
                        filteredImages.forEach(img => {
                          const date = new Date(img.uploadedAt);
                          const dateKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                          if (!groupedImages[dateKey]) {
                            groupedImages[dateKey] = [];
                          }
                          groupedImages[dateKey].push(img);
                        });
                        const sortedDateKeys = Object.keys(groupedImages).sort((a, b) => {
                          return new Date(b).getTime() - new Date(a).getTime();
                        });

                        return (
                          <>
                            {sortedDateKeys.map((dateKey) => (
                              <div key={dateKey} className="mb-6">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-base font-bold text-gray-900 flex items-center">
                                    <svg className="w-4 h-4 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {dateKey}
                                    <span className="ml-2 text-xs font-normal text-gray-700">
                                      ({groupedImages[dateKey].length} {groupedImages[dateKey].length === 1 ? 'image' : 'images'})
                                    </span>
                                  </h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {groupedImages[dateKey].map((image) => {
                                    const isSelected = selectedForComparison.includes(image.id);
                                    return (
                                      <div 
                                        key={image.id} 
                                        className={`group relative aspect-square rounded-xl overflow-hidden border transition-all duration-300 hover:shadow-lg bg-white cursor-pointer ${
                                          comparisonMode 
                                            ? isSelected 
                                              ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
                                              : 'border-gray-200 hover:border-blue-300'
                                            : 'border-gray-200 hover:border-pink-300'
                                        }`}
                                        onClick={() => {
                                          if (comparisonMode) {
                                            if (isSelected) {
                                              setSelectedForComparison(selectedForComparison.filter(id => id !== image.id));
                                            } else {
                                              if (selectedForComparison.length < 4) {
                                                setSelectedForComparison([...selectedForComparison, image.id]);
                                              }
                                            }
                                          }
                                        }}
                                      >
                                        {comparisonMode && (
                                          <div className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                            isSelected 
                                              ? 'bg-blue-600 text-white shadow-lg' 
                                              : 'bg-white/80 backdrop-blur-sm border-2 border-gray-300'
                                          }`}>
                                            {isSelected && (
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </div>
                                        )}
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
                                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                              image.orientation === 'front' ? 'bg-pink-100 text-pink-800' :
                                              image.orientation === 'back' ? 'bg-indigo-100 text-indigo-800' :
                                              'bg-teal-100 text-teal-800'
                                            }`}>
                                              {image.orientation.charAt(0).toUpperCase() + image.orientation.slice(1)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="absolute bottom-2 right-2">
                                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-black bg-opacity-50 text-white">
                                            {new Date(image.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
              )}

              {/* Measurement History */}
              {activeTab === 'progress' && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                    <h2 className="text-2xl font-bold text-gray-900">Measurement History</h2>
                    <p className="text-sm text-gray-600 mt-1">Track weight and body measurements over time</p>
                  </div>
                  
                  {/* Measurements Graph */}
                  {allMeasurementsData.length > 0 && (
                    <div className="p-6 border-b border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Measurements Over Time</h3>
                      
                      {/* Measurement Toggles */}
                      {getAvailableMeasurements().length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {getAvailableMeasurements().map((measurement, index) => (
                            <button
                              key={measurement}
                              onClick={() => toggleMeasurement(measurement)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                selectedMeasurements.has(measurement)
                                  ? `${getMeasurementColor(index)} text-white`
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {getMeasurementLabel(measurement)}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Graph */}
                      {selectedMeasurements.size > 0 ? (
                        <div className="relative">
                          <svg className="w-full h-64" viewBox="0 0 800 256" preserveAspectRatio="none">
                            {/* Y-axis grid lines */}
                            {[0, 1, 2, 3, 4].map((i) => {
                              const y = (i * 64);
                              return (
                                <line
                                  key={i}
                                  x1="40"
                                  y1={y}
                                  x2="800"
                                  y2={y}
                                  stroke="#e5e7eb"
                                  strokeWidth="1"
                                />
                              );
                            })}
                            
                            {/* Calculate max value for scaling */}
                            {(() => {
                              const maxValue = Math.max(
                                ...allMeasurementsData.map(m => {
                                  let max = 0;
                                  selectedMeasurements.forEach(key => {
                                    const value = key === 'bodyWeight' 
                                      ? (m.bodyWeight || 0)
                                      : (m.measurements?.[key] || 0);
                                    max = Math.max(max, value);
                                  });
                                  return max;
                                })
                              );
                              
                              const minValue = Math.min(
                                ...allMeasurementsData.map(m => {
                                  let min = Infinity;
                                  selectedMeasurements.forEach(key => {
                                    const value = key === 'bodyWeight' 
                                      ? (m.bodyWeight || 0)
                                      : (m.measurements?.[key] || 0);
                                    if (value > 0) min = Math.min(min, value);
                                  });
                                  return min === Infinity ? 0 : min;
                                })
                              );
                              
                              const range = maxValue - minValue || 1;
                              const padding = range * 0.1; // 10% padding
                              const scaleMin = Math.max(0, minValue - padding);
                              const scaleMax = maxValue + padding;
                              const scaleRange = scaleMax - scaleMin;
                              
                              // Draw lines for each selected measurement
                              return Array.from(selectedMeasurements).map((key, keyIndex) => {
                                const colorMap = [
                                  '#3b82f6', // blue
                                  '#10b981', // green
                                  '#8b5cf6', // purple
                                  '#f97316', // orange
                                  '#ec4899', // pink
                                  '#6366f1', // indigo
                                  '#ef4444', // red
                                  '#eab308'  // yellow
                                ];
                                const color = colorMap[keyIndex % colorMap.length];
                                
                                const points = allMeasurementsData
                                  .map((m, index) => {
                                    const value = key === 'bodyWeight' 
                                      ? (m.bodyWeight || 0)
                                      : (m.measurements?.[key] || 0);
                                    
                                    if (value === 0 || value === null || value === undefined) return null;
                                    
                                    const x = 40 + (index / (allMeasurementsData.length - 1 || 1)) * 760;
                                    const y = 240 - ((value - scaleMin) / scaleRange) * 200;
                                    
                                    return { x, y, value, date: m.date, isBaseline: m.isBaseline };
                                  })
                                  .filter(p => p !== null) as { x: number; y: number; value: number; date: Date; isBaseline: boolean }[];
                                
                                if (points.length === 0) return null;
                                
                                // Draw line
                                const pathData = points.map((p, i) => 
                                  `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                                ).join(' ');
                                
                                return (
                                  <g key={key}>
                                    {/* Line */}
                                    <path
                                      d={pathData}
                                      fill="none"
                                      stroke={color}
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    {/* Points */}
                                    {points.map((p, i) => (
                                      <circle
                                        key={i}
                                        cx={p.x}
                                        cy={p.y}
                                        r="4"
                                        fill={color}
                                        stroke="white"
                                        strokeWidth="2"
                                        className="cursor-pointer hover:r-6 transition-all"
                                      />
                                    ))}
                                  </g>
                                );
                              });
                            })()}
                          </svg>
                          
                          {/* X-axis date labels */}
                          <div className="flex justify-between mt-2 px-10">
                            {allMeasurementsData.map((measurement, index) => {
                              const date = measurement.date instanceof Date ? measurement.date : new Date(measurement.date);
                              return (
                                <div key={index} className="flex flex-col items-center text-[9px] text-gray-500">
                                  <span>{date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</span>
                                  {measurement.isBaseline && (
                                    <span className="text-[8px] text-blue-600 font-semibold mt-0.5">Baseline</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Y-axis labels */}
                          <div className="absolute left-0 top-0 h-64 flex flex-col justify-between text-[10px] text-gray-500 pr-2">
                            {(() => {
                              const maxValue = Math.max(
                                ...allMeasurementsData.map(m => {
                                  let max = 0;
                                  selectedMeasurements.forEach(key => {
                                    const value = key === 'bodyWeight' 
                                      ? (m.bodyWeight || 0)
                                      : (m.measurements?.[key] || 0);
                                    max = Math.max(max, value);
                                  });
                                  return max;
                                })
                              );
                              
                              const minValue = Math.min(
                                ...allMeasurementsData.map(m => {
                                  let min = Infinity;
                                  selectedMeasurements.forEach(key => {
                                    const value = key === 'bodyWeight' 
                                      ? (m.bodyWeight || 0)
                                      : (m.measurements?.[key] || 0);
                                    if (value > 0) min = Math.min(min, value);
                                  });
                                  return min === Infinity ? 0 : min;
                                })
                              );
                              
                              const range = maxValue - minValue || 1;
                              const padding = range * 0.1;
                              const scaleMin = Math.max(0, minValue - padding);
                              const scaleMax = maxValue + padding;
                              
                              return [scaleMax, scaleMax * 0.75, scaleMax * 0.5, scaleMax * 0.25, scaleMin].map((val, i) => (
                                <span key={i}>{Math.round(val)}</span>
                              ));
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p className="text-sm">Select measurements to view on the graph</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Measurement Table */}
                  <div className="p-8">
                    {loadingMeasurements ? (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                        <p className="text-gray-500 text-lg">Loading measurements...</p>
                      </div>
                    ) : measurementHistory.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Weight (kg)</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Waist (cm)</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Hips (cm)</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Chest (cm)</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Left Thigh (cm)</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Right Thigh (cm)</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Left Arm (cm)</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Right Arm (cm)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {measurementHistory.map((entry) => (
                              <tr key={entry.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {new Date(entry.date).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {entry.bodyWeight ? `${entry.bodyWeight}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {entry.measurements?.waist ? `${entry.measurements.waist}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {entry.measurements?.hips ? `${entry.measurements.hips}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {entry.measurements?.chest ? `${entry.measurements.chest}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {entry.measurements?.leftThigh ? `${entry.measurements.leftThigh}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {entry.measurements?.rightThigh ? `${entry.measurements.rightThigh}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {entry.measurements?.leftArm ? `${entry.measurements.leftArm}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {entry.measurements?.rightArm ? `${entry.measurements.rightArm}` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">No measurements recorded yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Answer Detail Modal */}
              {selectedResponse && (
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                  onClick={() => setSelectedResponse(null)}
                >
                  <div 
                    className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900">Question Response</h3>
                      <button
                        onClick={() => setSelectedResponse(null)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Question</p>
                        <p className="text-gray-900">{selectedResponse.question}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Client's Answer</p>
                        <div className="bg-gray-50 rounded-lg p-3">
                          {selectedResponse.type === 'boolean' ? (
                            <p className="text-gray-900 font-medium">
                              {selectedResponse.answer === true || selectedResponse.answer === 'true' ? 'Yes' : 'No'}
                            </p>
                          ) : selectedResponse.type === 'scale' || selectedResponse.type === 'rating' ? (
                            <p className="text-gray-900 font-medium">
                              {selectedResponse.answer} / 10
                            </p>
                          ) : selectedResponse.type === 'number' ? (
                            <p className="text-gray-900 font-medium">
                              {selectedResponse.answer}
                            </p>
                          ) : Array.isArray(selectedResponse.answer) ? (
                            <p className="text-gray-900 font-medium">
                              {selectedResponse.answer.join(', ')}
                            </p>
                          ) : (
                            <p className="text-gray-900 font-medium">
                              {String(selectedResponse.answer)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Score</p>
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full ${getStatusColor(
                              selectedResponse.score >= 7 ? 'green' : selectedResponse.score >= 4 ? 'orange' : 'red'
                            )} ${getStatusBorder(
                              selectedResponse.score >= 7 ? 'green' : selectedResponse.score >= 4 ? 'orange' : 'red'
                            )} flex items-center justify-center`}>
                              <span className="text-white text-xs font-bold">{selectedResponse.score}</span>
                            </div>
                            <span className="text-gray-900 font-medium">{selectedResponse.score}/10</span>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Date</p>
                          <p className="text-gray-900 font-medium">Week {selectedResponse.week}</p>
                          <p className="text-sm text-gray-600">{selectedResponse.date}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => setSelectedResponse(null)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
              {activeTab === 'progress' && client.notes && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 px-8 py-6 border-b border-gray-100">
                    <h2 className="text-2xl font-bold text-gray-900">Notes</h2>
                  </div>
                  <div className="p-8">
                    <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
                  </div>
                </div>
              )}
                </div>
              )}

              {/* CHECK-INS TAB */}
              {activeTab === 'checkins' && (
                <div className="space-y-6">
              {/* Modern Check-ins Overview */}
              <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Check-ins Overview</h2>
                    <div className="flex items-center space-x-4">
                      {(() => {
                        // Find the next pending check-in
                        const nextCheckIn = allocatedCheckIns
                          .filter(c => c.status === 'pending' || c.status === 'active')
                          .sort((a, b) => {
                            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                            return dateA - dateB; // Sort ascending (earliest first)
                          })[0];
                        
                        if (nextCheckIn && nextCheckIn.dueDate) {
                          const dueDate = new Date(nextCheckIn.dueDate);
                          const now = new Date();
                          const isOverdue = dueDate < now;
                          const weekInfo = nextCheckIn.isRecurring && nextCheckIn.recurringWeek
                            ? `Week ${nextCheckIn.recurringWeek}${nextCheckIn.totalWeeks ? `/${nextCheckIn.totalWeeks}` : ''}`
                            : '';
                          
                          return (
                            <div className={`px-4 py-2 rounded-full shadow-sm border ${
                              isOverdue 
                                ? 'bg-red-50 border-red-200' 
                                : 'bg-blue-50 border-blue-200'
                            }`}>
                              <div className="flex items-center space-x-2">
                                <span className={`text-xs font-semibold ${
                                  isOverdue ? 'text-red-700' : 'text-blue-700'
                                }`}>
                                  Next Check-in:
                                </span>
                                {weekInfo && (
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    isOverdue 
                                      ? 'bg-red-100 text-red-800' 
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {weekInfo}
                                  </span>
                                )}
                                <span className={`text-xs font-medium ${
                                  isOverdue ? 'text-red-700' : 'text-blue-700'
                                }`}>
                                  {formatDate(dueDate)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <span className="text-sm text-gray-600 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
                        {allocatedCheckIns.length} total allocated
                      </span>
                      <span className="text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full shadow-sm border border-green-200">
                        {allocatedCheckIns.filter(c => c.status === 'completed').length} completed
                      </span>
                      <span className="text-sm text-yellow-600 bg-yellow-50 px-4 py-2 rounded-full shadow-sm border border-yellow-200">
                        {allocatedCheckIns.filter(c => c.status === 'pending').length} pending
                      </span>
                      {allocatedCheckIns.filter(c => c.status === 'overdue').length > 0 && (
                        <span className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-full shadow-sm border border-red-200">
                          {allocatedCheckIns.filter(c => c.status === 'overdue').length} overdue
                        </span>
                      )}
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
                        className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-medium transition-all duration-200 shadow-sm"
                      >
                        Send first check-in
                      </button>
                    </div>
                  ) : (
                    <div id="check-ins-section" className="space-y-8">
                      {/* Tab Navigation */}
                      <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                        <div className="bg-orange-50 px-6 py-4 border-b-2 border-orange-200">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                              <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                              Check-ins Management
                            </h3>
                            <div className="flex bg-white rounded-2xl p-1 shadow-sm text-xs md:text-sm">
                              <button
                                onClick={() => setCheckInTab('all')}
                                className={`px-4 py-2 rounded-2xl text-sm font-medium transition-colors ${
                                  checkInTab === 'all'
                                    ? 'bg-orange-500 text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                All Check-ins ({allocatedCheckIns.length})
                              </button>
                              <button
                                onClick={() => setCheckInTab('completed')}
                                className={`px-4 py-2 rounded-2xl text-sm font-medium transition-colors ${
                                  checkInTab === 'completed'
                                    ? 'bg-[#34C759] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                Completed ({allocatedCheckIns.filter(c => c.status === 'completed').length})
                              </button>
                              <button
                                onClick={() => setCheckInTab('coachResponses')}
                                className={`px-4 py-2 rounded-2xl text-sm font-medium transition-colors ${
                                  checkInTab === 'coachResponses'
                                    ? 'bg-[#007AFF] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                Coach Responses ({allocatedCheckIns.filter(c => c.status === 'completed' && c.coachResponded).length})
                              </button>
                              <button
                                onClick={() => setCheckInTab('pendingReview')}
                                className={`px-4 py-2 rounded-2xl text-sm font-medium transition-colors ${
                                  checkInTab === 'pendingReview'
                                    ? 'bg-orange-500 text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                Pending Review ({allocatedCheckIns.filter(c => c.status === 'completed' && !c.coachResponded).length})
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* All Check-ins Tab */}
                        {checkInTab === 'all' && (
                          <div className="p-6 space-y-6">
                            {/* All Allocated Check-ins Table */}
                            <div className="bg-orange-50 rounded-2xl p-6 border border-orange-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                                All Allocated Check-ins ({allocatedCheckIns.length})
                              </h3>
                        <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Form Title</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Assigned</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Due Date</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Score</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Week</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {[...allocatedCheckIns].sort((a, b) => {
                                  // Sort by recurring week number (1-20)
                                  const weekA = a.recurringWeek || 0;
                                  const weekB = b.recurringWeek || 0;
                                  return weekA - weekB;
                                }).map((checkIn, index) => (
                                  <tr key={checkIn.id || `checkin-${index}`} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">{checkIn.formTitle || 'Unknown Form'}</div>
                                      {checkIn.category && (
                                        <div className="text-xs text-gray-500">{checkIn.category}</div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                                        checkIn.status === 'completed' ? 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20' :
                                        checkIn.status === 'pending' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                        checkIn.status === 'overdue' ? 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20' :
                                        'bg-gray-100 text-gray-700 border-gray-200'
                                      }`}>
                                        {checkIn.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                      {formatDate(checkIn.assignedAt)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                      {checkIn.dueDate ? formatDate(checkIn.dueDate) : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {checkIn.status === 'completed' && checkIn.score !== undefined ? (
                                        <span className="text-sm font-medium text-gray-900">{checkIn.score}%</span>
                                      ) : (
                                        <span className="text-sm text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      {checkIn.isRecurring ? (
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                          Week {checkIn.recurringWeek || 1}/{checkIn.totalWeeks || 1}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-400">Single</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                      <div className="flex space-x-2">
                                        {checkIn.status === 'pending' && (
                                          <button
                                            onClick={() => openCheckInManagementModal(checkIn)}
                                            className="text-blue-600 hover:text-blue-800 font-medium"
                                          >
                                            Edit
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDeleteCheckIn(checkIn.id)}
                                          disabled={deletingCheckIn}
                                          className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

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
                              totalWeeks: checkIn.totalWeeks,
                              isPaused: false,
                              pausedUntil: null
                            });
                          }
                          const series = seriesMap.get(checkIn.formId);
                          series.totalCheckIns++;
                          if (checkIn.status === 'completed') {
                            series.completedCheckIns++;
                          } else if (checkIn.status === 'pending') {
                            series.pendingCheckIns++;
                          }
                          // Check if series is paused (has pausedUntil date in future)
                          if (checkIn.pausedUntil) {
                            const pausedUntilDate = new Date(checkIn.pausedUntil);
                            const now = new Date();
                            if (pausedUntilDate > now) {
                              series.isPaused = true;
                              if (!series.pausedUntil || pausedUntilDate > new Date(series.pausedUntil)) {
                                series.pausedUntil = checkIn.pausedUntil;
                              }
                            }
                          }
                        });

                        const series = Array.from(seriesMap.values());
                        
                        if (series.length === 0) return null;

                        return (
                          <div className="bg-orange-50 rounded-2xl p-6 border border-orange-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                              <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                              Check-in Series Management
                            </h3>
                            <div className="space-y-3">
                              {series.map((s, index) => (
                                <div key={s.formId || `series-${index}`} className="flex items-center justify-between p-4 bg-white rounded-lg border border-blue-100">
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
                                      {s.isPaused && s.pausedUntil && (
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800" title={`Paused until ${new Date(s.pausedUntil).toLocaleDateString()}`}>
                                          ⏸️ Paused until {new Date(s.pausedUntil).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    {s.isPaused ? (
                                      <button
                                        onClick={() => handleUnpauseSeries(s.formId, s.formTitle)}
                                        disabled={unpausingSeries || pausingSeries || deletingSeries}
                                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Resume the series early - restore original due dates"
                                      >
                                        {unpausingSeries ? 'Unpausing...' : 'Unpause Series'}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => openPauseModal(s.formId, s.formTitle)}
                                        disabled={pausingSeries || deletingSeries}
                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Pause the series for X weeks (e.g., for holidays or injury)"
                                      >
                                        {pausingSeries ? 'Pausing...' : 'Pause Series'}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteSeries(s.formId, s.formTitle, true)}
                                      disabled={deletingSeries || pausingSeries}
                                      className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Delete only pending check-ins, preserve completed history"
                                    >
                                      {deletingSeries ? 'Deleting...' : 'Delete Pending'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSeries(s.formId, s.formTitle, false)}
                                      disabled={deletingSeries || pausingSeries}
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

                      {/* Pending Check-ins Section */}
                      {allocatedCheckIns.filter(c => c.status === 'pending').length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></span>
                            Pending Check-ins ({allocatedCheckIns.filter(c => c.status === 'pending').length})
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allocatedCheckIns.filter(c => c.status === 'pending').sort((a, b) => {
                              const weekA = a.recurringWeek || 0;
                              const weekB = b.recurringWeek || 0;
                              return weekA - weekB;
                            }).slice(0, 6).map((checkIn, index) => (
                              <div key={checkIn.id || `pending-${index}`} className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200 hover:shadow-lg transition-all duration-200">
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

                        {/* Completed Check-ins Tab */}
                        {checkInTab === 'completed' && (
                          <div className="p-6 space-y-6">
                            {allocatedCheckIns.filter(c => c.status === 'completed').length > 0 ? (
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                                  Completed Check-ins ({allocatedCheckIns.filter(c => c.status === 'completed').length})
                                </h3>
                                <div className="space-y-4">
                                  {allocatedCheckIns.filter(c => c.status === 'completed').sort((a, b) => {
                                    const weekA = a.recurringWeek || 0;
                                    const weekB = b.recurringWeek || 0;
                                    return weekA - weekB;
                                  }).map((checkIn, index) => (
                                    <div key={checkIn.id || `completed-${index}`} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 hover:shadow-lg transition-all duration-200">
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-4">
                                          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                          </div>
                                          <div>
                                            <h4 className="text-lg font-bold text-gray-900">{checkIn.formTitle}</h4>
                                            <p className="text-gray-600">{checkIn.responseCount || 0} questions</p>
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
                                          <Link
                                            href={`/responses/${checkIn.responseId || checkIn.id}`}
                                            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                                          >
                                            View
                                          </Link>
                                          <Link
                                            href={`/clients/${clientId}/progress`}
                                            className="text-gray-600 hover:text-gray-800 font-medium text-sm transition-colors"
                                          >
                                            Progress
                                          </Link>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <p className="text-gray-500 text-lg mb-2">No completed check-ins</p>
                                <p className="text-gray-400 text-sm">Completed check-ins will appear here</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Coach Responses Tab */}
                        {checkInTab === 'coachResponses' && (
                          <div className="p-6 space-y-6">
                            {allocatedCheckIns.filter(c => c.status === 'completed' && c.coachResponded).length > 0 ? (
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                                  Coach Responses ({allocatedCheckIns.filter(c => c.status === 'completed' && c.coachResponded).length})
                                </h3>
                                <p className="text-sm text-gray-600 mb-6">Check-ins where you've provided feedback to the client</p>
                                <div className="space-y-4">
                                  {allocatedCheckIns.filter(c => c.status === 'completed' && c.coachResponded).sort((a, b) => {
                                    const dateA = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt);
                                    const dateB = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt);
                                    return dateB.getTime() - dateA.getTime(); // Newest first
                                  }).map((checkIn, index) => (
                                    <div key={checkIn.id || `coach-response-${index}`} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 hover:shadow-lg transition-all duration-200">
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-4">
                                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                            </svg>
                                          </div>
                                          <div>
                                            <h4 className="text-lg font-bold text-gray-900">{checkIn.formTitle}</h4>
                                            <p className="text-gray-600">{checkIn.responseCount || 0} questions</p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="px-4 py-2 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                                            {checkIn.score}%
                                          </div>
                                          <div className="mt-2">
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 border border-green-200">
                                              ✓ Responded
                                            </span>
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
                                          <span className="font-medium">Completed:</span> {formatDate(checkIn.completedAt)}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          <span className="font-medium">Response ID:</span> {checkIn.responseId ? checkIn.responseId.substring(0, 8) + '...' : 'N/A'}
                                        </div>
                                        <div className="flex space-x-2">
                                          <Link
                                            href={`/responses/${checkIn.responseId || checkIn.id}`}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
                                          >
                                            View Response
                                          </Link>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                  </svg>
                                </div>
                                <p className="text-gray-500 text-lg mb-2">No coach responses yet</p>
                                <p className="text-gray-400 text-sm">Check-ins where you've provided feedback will appear here</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Pending Review Tab */}
                        {checkInTab === 'pendingReview' && (
                          <div className="p-6 space-y-6">
                            {allocatedCheckIns.filter(c => c.status === 'completed' && !c.coachResponded).length > 0 ? (
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
                                  Pending Review ({allocatedCheckIns.filter(c => c.status === 'completed' && !c.coachResponded).length})
                                </h3>
                                <p className="text-sm text-gray-600 mb-6">Completed check-ins that need your review and feedback</p>
                                <div className="space-y-4">
                                  {allocatedCheckIns.filter(c => c.status === 'completed' && !c.coachResponded).sort((a, b) => {
                                    const dateA = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt);
                                    const dateB = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt);
                                    return dateB.getTime() - dateA.getTime(); // Newest first
                                  }).map((checkIn, index) => (
                                    <div key={checkIn.id || `pending-review-${index}`} className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-6 border border-orange-200 hover:shadow-lg transition-all duration-200">
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-4">
                                          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                          </div>
                                          <div>
                                            <h4 className="text-lg font-bold text-gray-900">{checkIn.formTitle}</h4>
                                            <p className="text-gray-600">{checkIn.responseCount || 0} questions</p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="px-4 py-2 text-sm font-medium rounded-full bg-orange-100 text-orange-800">
                                            {checkIn.score}%
                                          </div>
                                          <div className="mt-2">
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                                              ⏳ Needs Review
                                            </span>
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
                                          <span className="font-medium">Completed:</span> {formatDate(checkIn.completedAt)}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                          <span className="font-medium">Response ID:</span> {checkIn.responseId ? checkIn.responseId.substring(0, 8) + '...' : 'N/A'}
                                        </div>
                                        <div className="flex space-x-2">
                                          <Link
                                            href={`/responses/${checkIn.responseId || checkIn.id}`}
                                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm transition-colors"
                                          >
                                            Review Now
                                          </Link>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <p className="text-gray-500 text-lg mb-2">No check-ins pending review</p>
                                <p className="text-gray-400 text-sm">All completed check-ins have been reviewed</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
              )}

              {/* HISTORY TAB */}
              {activeTab === 'history' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                    <div className="bg-orange-50 px-8 py-6 border-b-2 border-orange-200">
                      <h2 className="text-2xl font-bold text-gray-900">Activity Timeline</h2>
                      <p className="text-sm text-gray-600 mt-1">Complete history of client interactions and progress</p>
                    </div>
                    <div className="p-8">
                      <div className="space-y-6">
                        {/* Completed Check-ins Timeline */}
                        {allocatedCheckIns.filter(c => c.status === 'completed').length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Completed Check-ins</h3>
                            <div className="space-y-3">
                              {allocatedCheckIns
                                .filter(c => c.status === 'completed')
                                .sort((a, b) => {
                                  const dateA = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt);
                                  const dateB = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt);
                                  return dateB.getTime() - dateA.getTime();
                                })
                                .slice(0, 10)
                                .map((checkIn) => (
                                  <div key={checkIn.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-900">{checkIn.formTitle || 'Check-in'}</p>
                                      <p className="text-sm text-gray-600">
                                        Completed {checkIn.completedAt?.toDate ? formatDate(checkIn.completedAt.toDate()) : formatDate(checkIn.completedAt)}
                                      </p>
                                      {checkIn.score !== undefined && (
                                        <p className="text-xs text-gray-500 mt-1">Score: {checkIn.score}%</p>
                                      )}
                                    </div>
                                    {checkIn.responseId && (
                                      <Link
                                        href={`/responses/${checkIn.responseId}`}
                                        className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                                      >
                                        View →
                                      </Link>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Measurement History Timeline */}
                        {measurementHistory.length > 0 && (
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Measurement Entries</h3>
                            <div className="space-y-3">
                              {measurementHistory.slice(0, 10).map((entry) => (
                                <div key={entry.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                                  <div className="flex-1">
                                    <p className="font-semibold text-gray-900">Measurement Recorded</p>
                                    <p className="text-sm text-gray-600">
                                      {formatDate(entry.date)}
                                    </p>
                                    {entry.bodyWeight && (
                                      <p className="text-xs text-gray-500 mt-1">Weight: {entry.bodyWeight} kg</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {allocatedCheckIns.filter(c => c.status === 'completed').length === 0 && measurementHistory.length === 0 && (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-gray-500 text-lg mb-2">No activity history yet</p>
                            <p className="text-gray-400 text-sm">Client activity will appear here</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI ANALYTICS TAB */}
              {activeTab === 'ai-analytics' && (
                <div className="space-y-6">
                  {/* Onboarding AI Summary Section */}
                  {loadingOnboardingAiSummary ? (
                    <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-6">
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                        <p className="text-gray-600 text-sm">Loading onboarding summary...</p>
                      </div>
                    </div>
                  ) : onboardingAiSummary && onboardingAiSummary.summary ? (
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-2 border-purple-200 overflow-hidden">
                      <div className="px-8 py-6 border-b-2 border-purple-200 bg-white/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <h2 className="text-2xl font-bold text-gray-900">Onboarding AI Analysis</h2>
                              <p className="text-sm text-gray-600 mt-1">
                                Initial client assessment from sign-up
                                {onboardingAiSummary.generatedAt && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    • Generated {new Date(onboardingAiSummary.generatedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-8">
                        <div className="prose max-w-none">
                          <div className="text-gray-700 whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: (onboardingAiSummary.summary || '').replace(/\n/g, '<br />') }} />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {loadingAiAnalytics ? (
                    <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading AI Analytics...</p>
                      </div>
                    </div>
                  ) : generatingAnalytics ? (
                    <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                        <p className="text-gray-600 font-medium">Generating AI Analytics...</p>
                        <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                      </div>
                    </div>
                  ) : aiAnalytics ? (
                    <>
                      {/* Risk Status Card */}
                      <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                        <div className={`px-8 py-6 border-b-2 ${
                          aiAnalytics.riskLevel === 'critical' ? 'bg-red-50 border-red-200' :
                          aiAnalytics.riskLevel === 'high' ? 'bg-orange-50 border-orange-200' :
                          aiAnalytics.riskLevel === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                          'bg-green-50 border-green-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <h2 className="text-2xl font-bold text-gray-900">AI Analytics Dashboard</h2>
                              <p className="text-sm text-gray-600 mt-1">
                                Intelligent insights and predictions based on client patterns
                                {aiAnalytics.timePeriod && (
                                  <span className="ml-2 px-2 py-0.5 bg-white/50 rounded text-xs font-medium">
                                    {aiAnalytics.timePeriod}
                                  </span>
                                )}
                                {aiAnalytics.generatedAt && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    Generated {new Date(aiAnalytics.generatedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              {analyticsHistory.length > 0 && (
                                <select
                                  value={selectedHistoryId || ''}
                                  onChange={(e) => {
                                    if (e.target.value === 'new') {
                                      setShowGenerateAnalyticsModal(true);
                                    } else {
                                      setSelectedHistoryId(e.target.value);
                                    }
                                  }}
                                  className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium bg-white hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                >
                                  <option value="">Select Past Report...</option>
                                  {analyticsHistory.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.timePeriod} - {new Date(item.createdAt).toLocaleDateString()}
                                    </option>
                                  ))}
                                  <option value="new">+ Generate New Analytics</option>
                                </select>
                              )}
                              <button
                                onClick={() => setShowGenerateAnalyticsModal(true)}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-sm flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Generate New Analytics
                              </button>
                              <div className="text-right">
                                <div className={`px-4 py-2 rounded-xl font-semibold text-sm ${
                                  aiAnalytics.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                                  aiAnalytics.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                                  aiAnalytics.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  Risk Level: {aiAnalytics.riskLevel.toUpperCase()}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Risk Score: {aiAnalytics.riskScore}/100</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-8">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-700">Trend</span>
                                <span className={`text-2xl ${
                                  aiAnalytics.trend === 'improving' ? 'text-green-600' :
                                  aiAnalytics.trend === 'declining' ? 'text-red-600' :
                                  'text-gray-600'
                                }`}>
                                  {aiAnalytics.trend === 'improving' ? '📈' : aiAnalytics.trend === 'declining' ? '📉' : '➡️'}
                                </span>
                              </div>
                              <p className="text-2xl font-bold text-gray-900 capitalize">{aiAnalytics.trend}</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200">
                              <div className="text-sm font-medium text-purple-700 mb-2">Baseline Score</div>
                              <p className="text-2xl font-bold text-gray-900">{aiAnalytics.baselineMetrics.averageScore}%</p>
                              <p className="text-xs text-purple-600 mt-1">Est. {new Date(aiAnalytics.baselineMetrics.establishedAt).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl p-6 border border-teal-200">
                              <div className="text-sm font-medium text-teal-700 mb-2">Current Average</div>
                              <p className="text-2xl font-bold text-gray-900">
                                {aiAnalytics.currentMetrics.recentScores.length > 0 
                                  ? Math.round(aiAnalytics.currentMetrics.recentScores.reduce((a: number, b: number) => a + b, 0) / aiAnalytics.currentMetrics.recentScores.length)
                                  : 0}%
                              </p>
                              <p className="text-xs text-teal-600 mt-1">Last {aiAnalytics.currentMetrics.recentScores.length} weeks</p>
                            </div>
                          </div>

                          {/* Alerts */}
                          {aiAnalytics.alerts && aiAnalytics.alerts.length > 0 && (
                            <div className="mb-8">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h3>
                              <div className="space-y-3">
                                {aiAnalytics.alerts.map((alert: any, index: number) => (
                                  <div key={index} className={`p-4 rounded-xl border-2 ${
                                    alert.type === 'urgent' ? 'bg-red-50 border-red-200' :
                                    alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                                    alert.type === 'success' ? 'bg-green-50 border-green-200' :
                                    'bg-blue-50 border-blue-200'
                                  }`}>
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className={`font-semibold ${
                                            alert.type === 'urgent' ? 'text-red-800' :
                                            alert.type === 'warning' ? 'text-yellow-800' :
                                            alert.type === 'success' ? 'text-green-800' :
                                            'text-blue-800'
                                          }`}>
                                            {alert.title}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {new Date(alert.timestamp).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                                        {alert.recommendedAction && (
                                          <p className="text-xs font-medium text-gray-600">
                                            💡 Recommended: {alert.recommendedAction}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Score History Chart */}
                          {aiAnalytics.scoreHistory && aiAnalytics.scoreHistory.length > 0 && (
                            <div className="mb-8">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">Score History Trend</h3>
                              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                <div className="flex items-end justify-between h-48 gap-2">
                                  {aiAnalytics.scoreHistory.map((entry: any, index: number) => {
                                    const height = (entry.score / 100) * 100;
                                    return (
                                      <div key={index} className="flex-1 flex flex-col items-center">
                                        <div className="w-full flex flex-col items-center justify-end h-40 mb-2">
                                          <div
                                            className={`w-full rounded-t-lg ${
                                              entry.status === 'green' ? 'bg-green-500' :
                                              entry.status === 'orange' ? 'bg-orange-500' :
                                              'bg-red-500'
                                            }`}
                                            style={{ height: `${height}%`, minHeight: '4px' }}
                                          ></div>
                                        </div>
                                        <div className="text-xs font-medium text-gray-700 text-center">
                                          {entry.score}%
                                        </div>
                                        <div className="text-xs text-gray-500 text-center mt-1">
                                          W{entry.week}
                                        </div>
                                        <div className="text-[10px] text-gray-400 text-center">
                                          {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* AI Insights */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl p-6 border border-indigo-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Score Trend Analysis</h3>
                              <p className="text-sm text-gray-700 leading-relaxed">{aiAnalytics.insights.scoreTrend}</p>
                            </div>
                            <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl p-6 border border-pink-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-3">🧠 Behavioral Patterns</h3>
                              <p className="text-sm text-gray-700 leading-relaxed">{aiAnalytics.insights.behavioralPatterns}</p>
                            </div>
                            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-2xl p-6 border border-cyan-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-3">💬 Sentiment Analysis</h3>
                              <p className="text-sm text-gray-700 leading-relaxed">{aiAnalytics.insights.sentimentAnalysis}</p>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-6 border border-amber-200">
                              <h3 className="text-lg font-semibold text-gray-900 mb-3">🔮 Predictive Insights</h3>
                              <p className="text-sm text-gray-700 leading-relaxed">{aiAnalytics.insights.predictiveInsights}</p>
                            </div>
                          </div>

                          {/* Risk Factors & Success Factors */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {aiAnalytics.riskFactors.reasons.length > 0 && (
                              <div className="bg-red-50 rounded-2xl p-6 border-2 border-red-200">
                                <h3 className="text-lg font-semibold text-red-900 mb-3">⚠️ Risk Factors</h3>
                                <ul className="space-y-2">
                                  {aiAnalytics.riskFactors.reasons.map((reason: string, index: number) => (
                                    <li key={index} className="flex items-start gap-2 text-sm text-red-800">
                                      <span className="text-red-500 mt-1">•</span>
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {aiAnalytics.successFactors.whatWorks.length > 0 && (
                              <div className="bg-green-50 rounded-2xl p-6 border-2 border-green-200">
                                <h3 className="text-lg font-semibold text-green-900 mb-3">✅ Success Factors</h3>
                                <div className="mb-4">
                                  <p className="text-sm font-medium text-green-800 mb-2">What's Working:</p>
                                  <ul className="space-y-2">
                                    {aiAnalytics.successFactors.whatWorks.map((item: string, index: number) => (
                                      <li key={index} className="flex items-start gap-2 text-sm text-green-800">
                                        <span className="text-green-500 mt-1">✓</span>
                                        <span>{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                {aiAnalytics.successFactors.strengths.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium text-green-800 mb-2">Client Strengths:</p>
                                    <ul className="space-y-2">
                                      {aiAnalytics.successFactors.strengths.map((strength: string, index: number) => (
                                        <li key={index} className="flex items-start gap-2 text-sm text-green-800">
                                          <span className="text-green-500 mt-1">💪</span>
                                          <span>{strength}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Recommended Actions */}
                          {aiAnalytics.recommendedActions && aiAnalytics.recommendedActions.length > 0 && (
                            <div className="bg-orange-50 rounded-2xl p-6 border-2 border-orange-200">
                              <h3 className="text-lg font-semibold text-orange-900 mb-4">🎯 Recommended Actions</h3>
                              <ol className="space-y-3">
                                {aiAnalytics.recommendedActions.map((action: string, index: number) => (
                                  <li key={index} className="flex items-start gap-3 text-sm text-orange-900">
                                    <span className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                                      {index + 1}
                                    </span>
                                    <span className="pt-0.5">{action}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-8">
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 text-lg mb-2">No AI Analytics Available</p>
                        <p className="text-gray-400 text-sm mb-6">Generate AI analytics based on selected time period</p>
                        <button
                          onClick={() => setShowGenerateAnalyticsModal(true)}
                          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200 shadow-sm flex items-center gap-2 mx-auto"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Generate New Analytics
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Compact Sidebar */}
            <div className="space-y-4">
              {/* Quick Actions - Compact */}
              <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-orange-50 border-b-2 border-orange-200">
                  <h3 className="text-sm font-bold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-4 space-y-2">
                  <button
                    onClick={openQuickSendModal}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-2xl text-sm font-medium transition-all duration-200 shadow-sm"
                  >
                    Send Check-in
                  </button>
                  <button
                    onClick={openAllocateModal}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-2xl text-sm font-medium transition-all duration-200 shadow-sm"
                  >
                    Allocate Check-in
                  </button>
                  <Link
                    href={`/clients/${clientId}/progress`}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm block"
                  >
                    View Progress
                  </Link>
                  <Link
                    href={`/clients/${clientId}/forms`}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm block"
                  >
                    Form Responses
                  </Link>
                  {onboardingData && (
                    <Link
                      href={`/clients/${clientId}/onboarding-report`}
                      target="_blank"
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-2xl text-sm font-medium text-center transition-all duration-200 shadow-sm block"
                    >
                      View Onboarding
                    </Link>
                  )}
                  <button
                    onClick={() => setActiveTab('checkins')}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-2xl text-sm font-medium transition-all duration-200 shadow-sm"
                  >
                    Manage Check-ins
                  </button>
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-2xl text-sm font-medium transition-all duration-200 shadow-sm"
                  >
                    ⚙️ Settings
                  </button>
                </div>
              </div>

              {/* Recent Activity - Compact */}
              <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 bg-orange-50 border-b-2 border-orange-200">
                  <h3 className="text-sm font-bold text-gray-900">Recent Activity</h3>
                </div>
                <div className="p-4">
                  {client.lastCheckIn ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#34C759] rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Last check-in</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(client.lastCheckIn)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">No check-ins yet</p>
                        <p className="text-xs text-gray-500">Send first check-in</p>
                      </div>
                    </div>
                  )}
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-orange-50 px-6 py-4 border-b-2 border-orange-200 rounded-t-3xl">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                  Program Start Date *
                </label>
                <input
                  type="date"
                  value={allocateStartDate}
                  onChange={(e) => {
                    setAllocateStartDate(e.target.value);
                    // If first check-in date is not set or is earlier than new start date, suggest start date
                    if (e.target.value) {
                      if (!allocateFirstCheckInDate || (allocateFirstCheckInDate < e.target.value)) {
                        setAllocateFirstCheckInDate(e.target.value);
                      }
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">The week the program begins</p>
              </div>

              {/* First Check-in Date */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  First Check-in Date *
                </label>
                <input
                  type="date"
                  value={allocateFirstCheckInDate}
                  onChange={(e) => setAllocateFirstCheckInDate(e.target.value)}
                  min={allocateStartDate || new Date().toISOString().split('T')[0]}
                  max={(() => {
                    const maxDate = new Date();
                    maxDate.setFullYear(maxDate.getFullYear() + 2); // Allow up to 2 years in the future
                    return maxDate.toISOString().split('T')[0];
                  })()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">When is their first check-in? Can be the same day as program start or anytime after.</p>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Frequency
                </label>
                <select
                  value={allocateFrequency}
                  onChange={(e) => setAllocateFrequency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                  value={isNaN(allocateDuration) || allocateDuration === 0 ? '' : allocateDuration}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setAllocateDuration(4); // Reset to default when empty
                    } else {
                      const numVal = parseInt(val, 10);
                      if (!isNaN(numVal) && numVal > 0) {
                        setAllocateDuration(numVal);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {/* First Check-in Window Indicator */}
              {allocateFirstCheckInDate && allocateCheckInWindow.enabled && (() => {
                const windowInfo = getFirstCheckInWindowStart();
                if (!windowInfo) return null;
                return (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-orange-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <h4 className="text-sm font-semibold text-orange-900 mb-1">First Check-in Window</h4>
                        <p className="text-sm text-orange-700">
                          Opens on <span className="font-medium">{windowInfo.displayText}</span>
                        </p>
                        {allocateCheckInWindow.endDay && allocateCheckInWindow.endTime && (
                          <p className="text-xs text-orange-600 mt-1">
                            Window closes {allocateCheckInWindow.endDay.charAt(0).toUpperCase() + allocateCheckInWindow.endDay.slice(1)} at {
                              (() => {
                                const [hours, minutes] = allocateCheckInWindow.endTime.split(':').map(Number);
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                const displayHours = hours % 12 || 12;
                                return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                              })()
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Check-in Window */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Check-in Window
                </label>
                
                <div className="mb-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={allocateCheckInWindow.enabled}
                      onChange={(e) => setAllocateCheckInWindow({
                        ...allocateCheckInWindow,
                        enabled: e.target.checked
                      })}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Enable check-in window</span>
                  </label>
                </div>

                {allocateCheckInWindow.enabled && (
                  <div className="space-y-3 pl-6 border-l-2 border-gray-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Start Day</label>
                        <select
                          value={allocateCheckInWindow.startDay}
                          onChange={(e) => setAllocateCheckInWindow({
                            ...allocateCheckInWindow,
                            startDay: e.target.value
                          })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="monday">Monday</option>
                          <option value="tuesday">Tuesday</option>
                          <option value="wednesday">Wednesday</option>
                          <option value="thursday">Thursday</option>
                          <option value="friday">Friday</option>
                          <option value="saturday">Saturday</option>
                          <option value="sunday">Sunday</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={allocateCheckInWindow.startTime}
                          onChange={(e) => setAllocateCheckInWindow({
                            ...allocateCheckInWindow,
                            startTime: e.target.value
                          })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">End Day</label>
                        <select
                          value={allocateCheckInWindow.endDay}
                          onChange={(e) => setAllocateCheckInWindow({
                            ...allocateCheckInWindow,
                            endDay: e.target.value
                          })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="monday">Monday</option>
                          <option value="tuesday">Tuesday</option>
                          <option value="wednesday">Wednesday</option>
                          <option value="thursday">Thursday</option>
                          <option value="friday">Friday</option>
                          <option value="saturday">Saturday</option>
                          <option value="sunday">Sunday</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">End Time</label>
                        <input
                          type="time"
                          value={allocateCheckInWindow.endTime}
                          onChange={(e) => setAllocateCheckInWindow({
                            ...allocateCheckInWindow,
                            endTime: e.target.value
                          })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Measurement Schedule */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Measurement Reminders
                </label>
                
                <div className="mb-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={measurementScheduleEnabled}
                      onChange={(e) => {
                        setMeasurementScheduleEnabled(e.target.checked);
                        // Auto-calculate first measurement Friday when enabled
                        if (e.target.checked && allocateStartDate) {
                          const startDate = new Date(allocateStartDate);
                          const secondFriday = calculateSecondFriday(startDate);
                          if (secondFriday) {
                            setFirstMeasurementFriday(secondFriday.toISOString().split('T')[0]);
                          }
                        } else if (!e.target.checked) {
                          setFirstMeasurementFriday('');
                        }
                      }}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Enable fortnightly measurement reminders</span>
                  </label>
                  <p className="mt-1 ml-6 text-xs text-gray-500">Client will be reminded to update measurements and progress photos every 2 weeks on Fridays</p>
                </div>

                {measurementScheduleEnabled && (
                  <div className="space-y-3 pl-6 border-l-2 border-gray-200">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">First Measurement Friday *</label>
                      <input
                        type="date"
                        value={firstMeasurementFriday}
                        onChange={(e) => setFirstMeasurementFriday(e.target.value)}
                        min={allocateStartDate ? (() => {
                          const startDate = new Date(allocateStartDate);
                          const secondFriday = calculateSecondFriday(startDate);
                          return secondFriday ? secondFriday.toISOString().split('T')[0] : undefined;
                        })() : undefined}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-xs text-gray-500">Select the first Friday for measurements. Typically the 2nd Friday after program start.</p>
                      {firstMeasurementFriday && (
                        <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                          <p className="text-xs text-blue-800">
                            <strong>Next measurements due:</strong> {new Date(firstMeasurementFriday).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                          <p className="text-xs text-blue-700 mt-1">Subsequent reminders every 2 weeks</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowAllocateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAllocateCheckIn}
                  disabled={!selectedAllocateForm || !allocateStartDate || !allocateFirstCheckInDate || allocatingCheckIn}
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {allocatingCheckIn ? 'Allocating...' : 'Allocate Check-in'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Allocation Summary Modal */}
      {showAllocationSummary && allocationSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-orange-50 px-6 py-5 border-b-2 border-orange-200 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">✓ Check-in Allocated Successfully</h3>
                  <p className="text-gray-600 mt-1">Summary of what has been applied to {client?.firstName}</p>
                </div>
                <button
                  onClick={() => {
                    setShowAllocationSummary(false);
                    setAllocationSummary(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Check-in Details */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Check-in Details
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-600">Form:</span>
                    <span className="text-sm font-semibold text-gray-900 text-right">{allocationSummary.formTitle}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-600">Frequency:</span>
                    <span className="text-sm font-semibold text-gray-900 capitalize">{allocationSummary.frequency.replace('-', '-')}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-600">Duration:</span>
                    <span className="text-sm font-semibold text-gray-900">{allocationSummary.duration} {allocationSummary.duration === 1 ? 'week' : 'weeks'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-600">Program Start:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Date(allocationSummary.startDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-600">First Check-in:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Date(allocationSummary.firstCheckInDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                  {allocationSummary.checkInWindow && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-600">Check-in Window:</span>
                        <span className="text-sm font-semibold text-gray-900 text-right">
                          {allocationSummary.checkInWindow.startDay.charAt(0).toUpperCase() + allocationSummary.checkInWindow.startDay.slice(1)} {(() => {
                            const [hours, minutes] = allocationSummary.checkInWindow.startTime.split(':').map(Number);
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            const displayHours = hours % 12 || 12;
                            return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                          })()} - {allocationSummary.checkInWindow.endDay.charAt(0).toUpperCase() + allocationSummary.checkInWindow.endDay.slice(1)} {(() => {
                            const [hours, minutes] = allocationSummary.checkInWindow.endTime.split(':').map(Number);
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            const displayHours = hours % 12 || 12;
                            return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Measurement Schedule Details */}
              {allocationSummary.measurementSchedule && allocationSummary.measurementSchedule.enabled && (
                <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Measurement Schedule
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-600">Frequency:</span>
                      <span className="text-sm font-semibold text-gray-900 capitalize">Every 2 weeks (Fortnightly)</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-600">First Measurement Date:</span>
                      <span className="text-sm font-semibold text-gray-900 text-right">
                        {new Date(allocationSummary.measurementSchedule.firstFridayDate).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                    </div>
                    {allocationSummary.measurementSchedule.nextDates && allocationSummary.measurementSchedule.nextDates.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <span className="text-sm font-medium text-gray-600 block mb-2">Upcoming Measurement Dates:</span>
                        <ul className="space-y-1">
                          {allocationSummary.measurementSchedule.nextDates.slice(0, 6).map((date, idx) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {new Date(date).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                month: 'long', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowAllocationSummary(false);
                    setAllocationSummary(null);
                  }}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pause Series Modal */}
      {showPauseModal && selectedSeriesForPause && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Pause Check-in Series
                  </h3>
                  {client && (
                    <p className="text-sm text-gray-600 mt-1">
                      For: <span className="font-medium text-gray-900">{client.firstName} {client.lastName}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowPauseModal(false);
                    setSelectedSeriesForPause(null);
                    setPauseWeeks(1);
                    setPauseResumeDate('');
                    setPauseInputMode('weeks');
                  }}
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
                  Series
                </label>
                <p className="text-gray-700 font-medium">{selectedSeriesForPause.formTitle}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Pause Duration
                </label>
                
                {/* Input Mode Toggle */}
                <div className="flex space-x-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setPauseInputMode('weeks')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pauseInputMode === 'weeks'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    By Weeks
                  </button>
                  <button
                    type="button"
                    onClick={() => setPauseInputMode('date')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pauseInputMode === 'date'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    By Date
                  </button>
                </div>

                {/* Weeks Input */}
                {pauseInputMode === 'weeks' && (
                  <>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={pauseWeeks}
                      onChange={(e) => setPauseWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Enter number of weeks"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      All future check-in due dates will be extended by this many weeks.
                    </p>
                  </>
                )}

                {/* Date Input (Calendar) */}
                {pauseInputMode === 'date' && (
                  <>
                    <input
                      type="date"
                      value={pauseResumeDate}
                      onChange={(e) => setPauseResumeDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    {pauseResumeDate && (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const resumeDate = new Date(pauseResumeDate);
                      resumeDate.setHours(0, 0, 0, 0);
                      const daysDiff = Math.ceil((resumeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const weeksCalc = Math.ceil(daysDiff / 7);
                      return (
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                          Series will resume on {resumeDate.toLocaleDateString()} ({weeksCalc} week{weeksCalc !== 1 ? 's' : ''})
                        </p>
                      );
                    })()}
                    <p className="text-xs text-gray-500 mt-1">
                      Select the date when check-ins should resume. All future check-in due dates will be extended until this date.
                    </p>
                  </>
                )}
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-orange-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-orange-800">
                    <p className="font-medium mb-1">What happens when you pause:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>All pending/future check-ins will have their due dates extended</li>
                      <li>Completed check-ins will remain unchanged</li>
                      <li>The pause duration will be tracked for reference</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowPauseModal(false);
                    setSelectedSeriesForPause(null);
                    setPauseWeeks(1);
                    setPauseResumeDate('');
                    setPauseInputMode('weeks');
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePauseSeries}
                  disabled={pausingSeries || (pauseInputMode === 'weeks' && pauseWeeks < 1) || (pauseInputMode === 'date' && !pauseResumeDate)}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {pausingSeries ? 'Pausing...' : (() => {
                    if (pauseInputMode === 'date' && pauseResumeDate) {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const resumeDate = new Date(pauseResumeDate);
                      resumeDate.setHours(0, 0, 0, 0);
                      const daysDiff = Math.ceil((resumeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const weeksCalc = Math.ceil(daysDiff / 7);
                      return `Pause until ${resumeDate.toLocaleDateString()} (${weeksCalc} week${weeksCalc !== 1 ? 's' : ''})`;
                    }
                    return `Pause for ${pauseWeeks} week${pauseWeeks !== 1 ? 's' : ''}`;
                  })()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Management Modal */}
      {/* Note: Editing here only affects this specific client's assignment.
          The master form template (default frequency, window, etc.) remains unchanged.
          This allows flexibility to customize check-ins per client. */}
      {showCheckInManagementModal && selectedCheckIn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Manage Check-in
                  </h3>
                  {client && (
                    <p className="text-sm text-gray-600 mt-1">
                      For: <span className="font-medium text-gray-900">{client.firstName} {client.lastName}</span>
                    </p>
                  )}
                </div>
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
                  value={selectedCheckIn.status === 'active' || selectedCheckIn.status === 'inactive' ? selectedCheckIn.status : (selectedCheckIn.status === 'completed' ? 'completed' : 'active')}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setSelectedCheckIn({
                      ...selectedCheckIn, 
                      status: newStatus,
                      // Clear pausedUntil if switching to active
                      pausedUntil: newStatus === 'active' ? undefined : selectedCheckIn.pausedUntil
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (Paused)</option>
                  <option value="completed">Completed</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Set to "Inactive" to pause notifications when client is on holiday
                </p>
              </div>

              {/* Paused Until - Only show when status is inactive */}
              {selectedCheckIn.status === 'inactive' && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Paused Until
                  </label>
                  <input
                    type="date"
                    value={selectedCheckIn.pausedUntil ? (typeof selectedCheckIn.pausedUntil === 'string' ? selectedCheckIn.pausedUntil.split('T')[0] : new Date(selectedCheckIn.pausedUntil).toISOString().split('T')[0]) : ''}
                    onChange={(e) => setSelectedCheckIn({...selectedCheckIn, pausedUntil: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Check-in will automatically resume on this date
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Frequency
                </label>
                <select
                  value={selectedCheckIn.frequency || 'weekly'}
                  onChange={(e) => setSelectedCheckIn({...selectedCheckIn, frequency: e.target.value, isRecurring: e.target.value !== 'once'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="once">Once</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={selectedCheckIn.startDate ? (typeof selectedCheckIn.startDate === 'string' ? selectedCheckIn.startDate.split('T')[0] : new Date(selectedCheckIn.startDate).toISOString().split('T')[0]) : ''}
                  onChange={(e) => setSelectedCheckIn({...selectedCheckIn, startDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Duration (Weeks)
                </label>
                <input
                  type="number"
                  min="1"
                  value={selectedCheckIn.totalWeeks || selectedCheckIn.duration || 1}
                  onChange={(e) => setSelectedCheckIn({...selectedCheckIn, totalWeeks: parseInt(e.target.value) || 1, duration: parseInt(e.target.value) || 1})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Check-in Window Section */}
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Check-in Window
                </label>
                
                <div className="mb-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedCheckIn.checkInWindow?.enabled !== false}
                      onChange={(e) => setSelectedCheckIn({
                        ...selectedCheckIn,
                        checkInWindow: {
                          ...(selectedCheckIn.checkInWindow || { startDay: 'friday', startTime: '10:00', endDay: 'monday', endTime: '22:00' }),
                          enabled: e.target.checked
                        }
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Enable check-in window</span>
                  </label>
                </div>

                {selectedCheckIn.checkInWindow?.enabled !== false && (
                  <div className="space-y-3 pl-6 border-l-2 border-gray-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Start Day</label>
                        <select
                          value={selectedCheckIn.checkInWindow?.startDay || 'friday'}
                          onChange={(e) => setSelectedCheckIn({
                            ...selectedCheckIn,
                            checkInWindow: {
                              ...(selectedCheckIn.checkInWindow || { enabled: true, startTime: '10:00', endDay: 'monday', endTime: '22:00' }),
                              startDay: e.target.value
                            }
                          })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="monday">Monday</option>
                          <option value="tuesday">Tuesday</option>
                          <option value="wednesday">Wednesday</option>
                          <option value="thursday">Thursday</option>
                          <option value="friday">Friday</option>
                          <option value="saturday">Saturday</option>
                          <option value="sunday">Sunday</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={selectedCheckIn.checkInWindow?.startTime || '10:00'}
                          onChange={(e) => setSelectedCheckIn({
                            ...selectedCheckIn,
                            checkInWindow: {
                              ...(selectedCheckIn.checkInWindow || { enabled: true, startDay: 'friday', endDay: 'monday', endTime: '22:00' }),
                              startTime: e.target.value
                            }
                          })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">End Day</label>
                        <select
                          value={selectedCheckIn.checkInWindow?.endDay || 'monday'}
                          onChange={(e) => setSelectedCheckIn({
                            ...selectedCheckIn,
                            checkInWindow: {
                              ...(selectedCheckIn.checkInWindow || { enabled: true, startDay: 'friday', startTime: '10:00', endTime: '22:00' }),
                              endDay: e.target.value
                            }
                          })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="monday">Monday</option>
                          <option value="tuesday">Tuesday</option>
                          <option value="wednesday">Wednesday</option>
                          <option value="thursday">Thursday</option>
                          <option value="friday">Friday</option>
                          <option value="saturday">Saturday</option>
                          <option value="sunday">Sunday</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">End Time</label>
                        <input
                          type="time"
                          value={selectedCheckIn.checkInWindow?.endTime || '22:00'}
                          onChange={(e) => setSelectedCheckIn({
                            ...selectedCheckIn,
                            checkInWindow: {
                              ...(selectedCheckIn.checkInWindow || { enabled: true, startDay: 'friday', startTime: '10:00', endDay: 'monday' }),
                              endTime: e.target.value
                            }
                          })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
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
                    startDate: selectedCheckIn.startDate,
                    frequency: selectedCheckIn.frequency,
                    duration: selectedCheckIn.totalWeeks || selectedCheckIn.duration,
                    totalWeeks: selectedCheckIn.totalWeeks || selectedCheckIn.duration,
                    checkInWindow: selectedCheckIn.checkInWindow,
                    isRecurring: selectedCheckIn.frequency !== 'once',
                    pausedUntil: selectedCheckIn.pausedUntil,
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

      {/* Client Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-6 py-4 border-b border-gray-100 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Client Settings</h3>
                  <p className="text-gray-600 mt-1">Configure program settings for {client?.firstName} {client?.lastName}</p>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Traffic Light Thresholds */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Traffic Light Thresholds</h4>
                    <p className="text-sm text-gray-600">Set red/orange/green percentage splits for scoring</p>
                  </div>
                  <Link
                    href={`/clients/${clientId}/scoring`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Configure →
                  </Link>
                </div>
                {scoringThresholds && (
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-xs font-medium text-red-700 mb-1">🔴 Red Zone</div>
                      <div className="text-lg font-bold text-red-600">0-{scoringThresholds.redMax}%</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="text-xs font-medium text-orange-700 mb-1">🟠 Orange Zone</div>
                      <div className="text-lg font-bold text-orange-600">{scoringThresholds.redMax + 1}-{scoringThresholds.orangeMax}%</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-xs font-medium text-green-700 mb-1">🟢 Green Zone</div>
                      <div className="text-lg font-bold text-green-600">{scoringThresholds.orangeMax + 1}-100%</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Program Duration & Start Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Program Start Date
                  </label>
                  <input
                    type="date"
                    value={clientSettings.programStartDate}
                    onChange={(e) => setClientSettings({...clientSettings, programStartDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Program Duration
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={clientSettings.programDuration}
                      onChange={(e) => setClientSettings({...clientSettings, programDuration: parseInt(e.target.value) || 1})}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={clientSettings.programDurationUnit}
                      onChange={(e) => setClientSettings({...clientSettings, programDurationUnit: e.target.value as 'weeks' | 'months'})}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                  {clientSettings.programStartDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Program ends: {(() => {
                        const start = new Date(clientSettings.programStartDate);
                        const duration = clientSettings.programDurationUnit === 'weeks' 
                          ? clientSettings.programDuration * 7 
                          : clientSettings.programDuration * 30;
                        const end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
                        return end.toLocaleDateString();
                      })()}
                    </p>
                  )}
                </div>
              </div>

              {/* Check-in Frequency & Communication */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Check-in Frequency
                  </label>
                  <select
                    value={clientSettings.checkInFrequency}
                    onChange={(e) => setClientSettings({...clientSettings, checkInFrequency: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Communication Preference
                  </label>
                  <select
                    value={clientSettings.communicationPreference}
                    onChange={(e) => setClientSettings({...clientSettings, communicationPreference: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>

              {/* Coach Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Coach Notes
                </label>
                <textarea
                  value={clientSettings.coachNotes}
                  onChange={(e) => setClientSettings({...clientSettings, coachNotes: e.target.value})}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add notes about this client, their goals, preferences, or any important information..."
                />
                <p className="text-xs text-gray-500 mt-1">These notes are only visible to coaches</p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Analytics Modal */}
      {showGenerateAnalyticsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 px-6 py-4 border-b border-gray-100 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Generate AI Analytics</h3>
                  <p className="text-gray-600 mt-1 text-sm">Select a time period to analyze client data</p>
                </div>
                <button
                  onClick={() => setShowGenerateAnalyticsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Time Period</label>
                <div className="space-y-2">
                  {['all', 'last-checkin', '2-weeks', '1-month', '6-months', '1-year', 'custom'].map((period) => (
                    <label
                      key={period}
                      className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        timePeriod === period
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="timePeriod"
                        value={period}
                        checked={timePeriod === period}
                        onChange={(e) => setTimePeriod(e.target.value as any)}
                        className="mr-3 text-orange-500"
                      />
                      <span className="text-sm font-medium text-gray-900">{getTimePeriodLabel(period)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {timePeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  <strong>What will be analyzed:</strong> All check-ins, measurements, and messages within the selected time period will be used to generate insights.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowGenerateAnalyticsModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateAnalytics}
                  disabled={generatingAnalytics || (timePeriod === 'custom' && (!customStartDate || !customEndDate))}
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {generatingAnalytics ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate Analytics
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </RoleProtected>
  );
} 