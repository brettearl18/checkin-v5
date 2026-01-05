'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthenticatedOnly } from '@/components/ProtectedRoute';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';
import ClientNavigation from '@/components/ClientNavigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
    status: 'red' | 'orange' | 'green' | 'grey';
    answer: any;
    type: string;
    weight?: number;
  }[];
}

interface ProgressData {
  date: string;
  score: number;
  formTitle: string;
}

export default function ClientProgressPage() {
  const { userProfile } = useAuth();
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, 90d, all
  const [questionProgress, setQuestionProgress] = useState<QuestionProgress[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<{
    question: string;
    answer: any;
    score: number;
    date: string;
    week: number;
    type: string;
  } | null>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [selectedMeasurements, setSelectedMeasurements] = useState<Set<string>>(new Set(['bodyWeight']));
  const [stats, setStats] = useState({
    totalCheckIns: 0,
    averageScore: 0,
    bestScore: 0,
    improvement: 0,
    consistency: 0,
    currentStreak: 0
  });

  useEffect(() => {
    if (userProfile) {
      fetchProgressData();
    }
  }, [userProfile, timeRange]);

  const fetchProgressData = async () => {
    try {
      setLoading(true);
      
      if (!userProfile?.uid) {
        console.log('No user profile found');
        setResponses([]);
        setStats({
          totalCheckIns: 0,
          averageScore: 0,
          bestScore: 0,
          improvement: 0,
          consistency: 0,
          currentStreak: 0
        });
        return;
      }

      // Fetch real responses using the existing API endpoint
      const response = await fetch(`/api/client-portal/history?clientId=${userProfile.uid}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch progress data');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch progress data');
      }

      let responsesData: FormResponse[] = data.history || [];
      
      // Deduplicate responses by assignmentId - keep only the most recent one for each assignment
      // This prevents showing multiple entries when user submits the same check-in multiple times
      const deduplicatedMap = new Map<string, FormResponse>();
      
      responsesData.forEach(response => {
        const assignmentId = (response as any).assignmentId;
        if (assignmentId) {
          const existing = deduplicatedMap.get(assignmentId);
          if (!existing) {
            deduplicatedMap.set(assignmentId, response);
          } else {
            // Keep the one with the most recent submittedAt
            const existingDate = new Date(existing.submittedAt);
            const currentDate = new Date(response.submittedAt);
            if (currentDate > existingDate) {
              deduplicatedMap.set(assignmentId, response);
            }
          }
        } else {
          // If no assignmentId, deduplicate by formId + date (same form submitted on same day)
          const responseDate = new Date(response.submittedAt);
          const dateKey = responseDate.toISOString().split('T')[0]; // YYYY-MM-DD
          const dedupeKey = `${response.formId || 'unknown'}-${dateKey}`;
          
          const existing = deduplicatedMap.get(dedupeKey);
          if (!existing) {
            deduplicatedMap.set(dedupeKey, response);
          } else {
            // Keep the most recent one
            const existingDate = new Date(existing.submittedAt);
            if (responseDate > existingDate) {
              deduplicatedMap.set(dedupeKey, response);
            }
          }
        }
      });
      
      responsesData = Array.from(deduplicatedMap.values());
      
      console.log('Fetched responses (after deduplication):', responsesData.length);
      console.log('Sample response structure:', responsesData[0]);
      console.log('Sample response.responses:', responsesData[0]?.responses?.[0]);
      setResponses(responsesData);

      // Process question-level progress
      processQuestionProgress(responsesData);

      // Fetch measurements (will use responsesData)
      fetchMeasurements(userProfile.uid, responsesData);

      // Calculate stats using real data only
      const totalCheckIns = responsesData.length;
      const scores = responsesData.map(r => r.score || 0).filter(score => score > 0);
      const averageScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
      const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
      
      // Calculate improvement (comparing first and last scores)
      let improvement = 0;
      if (scores.length >= 2) {
        const sortedByDate = responsesData
          .filter(r => r.score && r.score > 0)
          .sort((a, b) => {
            const dateA = new Date(a.submittedAt);
            const dateB = new Date(b.submittedAt);
            return dateA.getTime() - dateB.getTime();
          });
        
        if (sortedByDate.length >= 2) {
          const firstScore = sortedByDate[0].score || 0;
          const lastScore = sortedByDate[sortedByDate.length - 1].score || 0;
          improvement = lastScore - firstScore;
        }
      }
      
      // Calculate consistency (percentage of scores within 10 points of average)
      const consistentScores = scores.filter(score => Math.abs(score - averageScore) <= 10);
      const consistency = scores.length > 0 ? Math.round((consistentScores.length / scores.length) * 100) : 0;
      
      // Calculate current streak (consecutive days with check-ins)
      let currentStreak = 0;
      if (responsesData.length > 0) {
        const sortedByDate = responsesData
          .sort((a, b) => {
            const dateA = new Date(a.submittedAt);
            const dateB = new Date(b.submittedAt);
            return dateB.getTime() - dateA.getTime();
          });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let streak = 0;
        let currentDate = new Date(today);
        
        for (const response of sortedByDate) {
          const responseDate = new Date(response.submittedAt);
          responseDate.setHours(0, 0, 0, 0);
          
          const daysDiff = Math.floor((currentDate.getTime() - responseDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === streak) {
            streak++;
          } else if (daysDiff > streak) {
            break;
          }
        }
        
        currentStreak = streak;
      }

      setStats({
        totalCheckIns,
        averageScore,
        bestScore,
        improvement,
        consistency,
        currentStreak
      });

    } catch (error) {
      console.error('Error fetching progress data:', error);
      setResponses([]);
      setStats({
        totalCheckIns: 0,
        averageScore: 0,
        bestScore: 0,
        improvement: 0,
        consistency: 0,
        currentStreak: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const filterResponsesByTimeRange = (responses: FormResponse[]) => {
    const now = new Date();
    const daysAgo = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    return responses.filter(response => {
      const responseDate = new Date(response.submittedAt);
      return responseDate >= cutoffDate;
    });
  };

  const getProgressTrend = () => {
    const filteredResponses = filterResponsesByTimeRange(responses);
    if (filteredResponses.length < 2) return 'stable';
    
    const scores = filteredResponses.map(r => r.score || 0);
    const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
    const secondHalf = scores.slice(Math.ceil(scores.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 5) return 'improving';
    if (secondAvg < firstAvg - 5) return 'declining';
    return 'stable';
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'declining': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      default: return '➡️';
    }
  };

  const processQuestionProgress = (responses: FormResponse[]) => {
    // Group responses by week
    const sortedResponses = [...responses]
      .filter(r => r.responses && Array.isArray(r.responses) && r.responses.length > 0)
      .sort((a, b) => {
        const dateA = new Date(a.submittedAt);
        const dateB = new Date(b.submittedAt);
        return dateA.getTime() - dateB.getTime();
      });

    if (sortedResponses.length === 0) {
      setQuestionProgress([]);
      return;
    }

    // Get all unique questions - use questionText as key if questionId is missing
    const questionMap = new Map<string, { questionId: string; questionText: string; allKeys?: string[] }>();
    
    sortedResponses.forEach(response => {
      if (response.responses && Array.isArray(response.responses)) {
        response.responses.forEach((qResp: QuestionResponse) => {
          // Use questionId if available, otherwise use questionText as identifier
          const questionId = qResp.questionId || '';
          const questionText = qResp.questionText || qResp.question || '';
          const questionKey = questionId || questionText || '';
          
          if (questionKey && !questionMap.has(questionKey)) {
            // Store all possible keys for matching
            const allKeys = [questionId, questionText, qResp.question].filter(Boolean);
            questionMap.set(questionKey, {
              questionId: questionId || questionKey,
              questionText: questionText || `Question ${questionKey.slice(0, 8)}`,
              allKeys: allKeys
            });
          }
        });
      }
    });

    console.log('Question map:', Array.from(questionMap.values()));
    console.log('Sample response:', sortedResponses[0]?.responses?.[0]);
    console.log('Total responses to process:', sortedResponses.length);

    // Create progress data for each question
    // Include ALL questions (including text/textarea) - they will show grey if unscored
    const progress: QuestionProgress[] = Array.from(questionMap.values())
      .map(question => {
        const weeks = sortedResponses.map((response, index) => {
          // Find this question's response in this check-in
          // Try multiple matching strategies - match by any of the stored keys
          const qResponse = response.responses?.find(
            (r: QuestionResponse) => {
              const rQuestionId = r.questionId || '';
              const rQuestionText = r.questionText || r.question || '';
              
              // Match by questionId
              if (question.questionId && rQuestionId && rQuestionId === question.questionId) {
                return true;
              }
              
              // Match by questionText
              if (question.questionText && rQuestionText && rQuestionText === question.questionText) {
                return true;
              }
              
              // Match by any of the stored keys
              if (question.allKeys && question.allKeys.some(key => 
                (key && rQuestionId === key) || (key && rQuestionText === key)
              )) {
                return true;
              }
              
              return false;
            }
          );

          if (!qResponse) {
            return null;
          }

          const questionType = qResponse.type || 'text';
          
          // Get score (0-10 scale typically) - check multiple possible fields
          const score = qResponse.score !== undefined ? qResponse.score : 
                       (qResponse.weightedScore !== undefined ? qResponse.weightedScore / (qResponse.weight || 1) : 0);
          
          // Get weight to determine if question is scored
          const weight = qResponse.weight !== undefined ? qResponse.weight : 5; // Default weight if not set
          
          // Determine if question is unscored (should show grey)
          // Unscored if: weight === 0, or type is text/textarea
          const isUnscored = weight === 0 || questionType === 'text' || questionType === 'textarea';
          
          // Determine status based on score and whether question is scored
          let status: 'red' | 'orange' | 'green' | 'grey';
          if (isUnscored) {
            status = 'grey';
          } else if (score >= 7) {
            status = 'green';
          } else if (score >= 4) {
            status = 'orange';
          } else {
            status = 'red';
          }

          const responseDate = new Date(response.submittedAt);
          
          return {
            week: index + 1,
            date: responseDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            score: score,
            status: status,
            answer: qResponse.answer,
            type: questionType,
            weight: weight
          };
        }).filter(w => w !== null) as { week: number; date: string; score: number; status: 'red' | 'orange' | 'green' | 'grey'; answer: any; type: string; weight?: number }[];

        return {
          questionId: question.questionId,
          questionText: question.questionText,
          weeks: weeks
        };
      });

    setQuestionProgress(progress);
  };

  const getStatusColor = (status: 'red' | 'orange' | 'green' | 'grey') => {
    switch (status) {
      case 'green':
        return 'bg-green-500';
      case 'orange':
        return 'bg-orange-500';
      case 'red':
        return 'bg-red-500';
      case 'grey':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusBorder = (status: 'red' | 'orange' | 'green' | 'grey') => {
    switch (status) {
      case 'green':
        return 'border-green-600';
      case 'orange':
        return 'border-orange-600';
      case 'red':
        return 'border-red-600';
      case 'grey':
        return 'border-gray-500';
      default:
        return 'border-gray-500';
    }
  };

  const fetchMeasurements = async (clientId: string, responsesData?: FormResponse[]) => {
    try {
      let allMeasurements: any[] = [];
      
      // Fetch onboarding data (baseline measurements)
      try {
        const onboardingResponse = await fetch(`/api/client-onboarding/data?clientId=${clientId}`);
        const onboardingData = await onboardingResponse.json();
        
        if (onboardingData.success && onboardingData.data) {
          const onboarding = onboardingData.data;
          if (onboarding.bodyWeight || (onboarding.measurements && Object.keys(onboarding.measurements).length > 0)) {
            // Use completedAt date if available, otherwise use createdAt, or a date before all other measurements
            let onboardingDate = new Date();
            if (onboarding.completedAt) {
              onboardingDate = new Date(onboarding.completedAt);
            } else if (onboarding.createdAt) {
              onboardingDate = new Date(onboarding.createdAt);
            } else {
              // Set to a date that will be first chronologically
              onboardingDate = new Date('2020-01-01');
            }
            
            allMeasurements.push({
              date: onboardingDate,
              bodyWeight: onboarding.bodyWeight || null,
              measurements: onboarding.measurements || {},
              isBaseline: true // Mark as baseline measurement
            });
          }
        }
      } catch (error) {
        console.log('Error fetching onboarding data:', error);
      }

      // Fetch from client_measurements collection
      try {
        const measurementsResponse = await fetch(`/api/client-measurements?clientId=${clientId}`);
        const measurementsData = await measurementsResponse.json();
        
        if (measurementsData.success && measurementsData.data) {
          const clientMeasurements = measurementsData.data.map((m: any) => ({
            date: new Date(m.date),
            bodyWeight: m.bodyWeight,
            measurements: m.measurements || {},
            isBaseline: false
          }));
          allMeasurements = [...allMeasurements, ...clientMeasurements];
        }
      } catch (error) {
        console.log('Error fetching client measurements:', error);
      }

      // Also extract body weight from check-in responses
      const responsesToUse = responsesData || responses;
      const checkInMeasurements = responsesToUse
        .filter(r => r.responses && Array.isArray(r.responses))
        .map(r => {
          const bodyWeightResponse = r.responses?.find((resp: QuestionResponse) => 
            resp.question?.toLowerCase().includes('body weight') || 
            resp.question?.toLowerCase().includes('weight')
          );
          
          if (bodyWeightResponse && bodyWeightResponse.answer) {
            return {
              date: new Date(r.submittedAt),
              bodyWeight: parseFloat(bodyWeightResponse.answer) || null,
              measurements: {},
              isBaseline: false
            };
          }
          return null;
        })
        .filter(m => m !== null);

      // Merge and deduplicate by date (prioritize baseline measurements)
      const merged = [...allMeasurements, ...checkInMeasurements];
      const uniqueByDate = new Map<string, any>();
      
      merged.forEach(m => {
        const dateKey = m.date.toISOString().split('T')[0];
        const existing = uniqueByDate.get(dateKey);
        
        // Prioritize baseline measurements, then measurements with more data
        if (!existing) {
          uniqueByDate.set(dateKey, m);
        } else if (m.isBaseline && !existing.isBaseline) {
          uniqueByDate.set(dateKey, m);
        } else if (!existing.isBaseline && m.bodyWeight && !existing.bodyWeight) {
          uniqueByDate.set(dateKey, m);
        }
      });

      const sortedMeasurements = Array.from(uniqueByDate.values())
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      setMeasurements(sortedMeasurements);
    } catch (error) {
      console.error('Error fetching measurements:', error);
      setMeasurements([]);
    }
  };

  const getAvailableMeasurements = () => {
    const available = new Set<string>();
    
    measurements.forEach(m => {
      if (m.bodyWeight !== null && m.bodyWeight !== undefined) {
        available.add('bodyWeight');
      }
      if (m.measurements) {
        Object.keys(m.measurements).forEach(key => {
          if (m.measurements[key] !== null && m.measurements[key] !== undefined) {
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

  if (loading) {
    return (
      <AuthenticatedOnly>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
          <ClientNavigation />
          <div className="flex-1 ml-8 p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
  }

  const filteredResponses = filterResponsesByTimeRange(responses);
  const trend = getProgressTrend();

  return (
    <AuthenticatedOnly>
      <div className="min-h-screen bg-white flex">
        <ClientNavigation />
        
        <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <div className="max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Your Progress</h1>
                  <p className="text-gray-600 mt-1 text-sm">Track your health and wellness journey</p>
                </div>
                <Link
                  href="/client-portal"
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  ← Back to Dashboard
                </Link>
              </div>

              {/* Time Range Filter */}
              <div className="flex flex-wrap gap-2">
                {['7d', '30d', '90d', 'all'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      timeRange === range
                        ? 'text-white shadow-md'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                    style={timeRange === range ? { backgroundColor: '#daa450' } : {}}
                  >
                    {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-8">
              <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 p-3 md:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center" style={{ backgroundColor: '#fef9e7' }}>
                      <span className="text-base md:text-xl">📊</span>
                    </div>
                  </div>
                  <div className="ml-2 md:ml-4 flex-1 min-w-0">
                    <p className="text-[10px] md:text-xs font-medium text-gray-500 truncate">Average Score</p>
                    <p className="text-lg md:text-2xl font-bold text-gray-900 mt-0.5 md:mt-1">{stats.averageScore}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 p-3 md:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center" style={{ backgroundColor: '#fef9e7' }}>
                      <span className="text-base md:text-xl">🏆</span>
                    </div>
                  </div>
                  <div className="ml-2 md:ml-4 flex-1 min-w-0">
                    <p className="text-[10px] md:text-xs font-medium text-gray-500 truncate">Best Score</p>
                    <p className="text-lg md:text-2xl font-bold text-gray-900 mt-0.5 md:mt-1">{stats.bestScore}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 p-3 md:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center" style={{ backgroundColor: '#fef9e7' }}>
                      <span className="text-base md:text-xl">📈</span>
                    </div>
                  </div>
                  <div className="ml-2 md:ml-4 flex-1 min-w-0">
                    <p className="text-[10px] md:text-xs font-medium text-gray-500 truncate">Improvement</p>
                    <p className={`text-lg md:text-2xl font-bold mt-0.5 md:mt-1 ${stats.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.improvement >= 0 ? '+' : ''}{stats.improvement}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-100 p-3 md:p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center" style={{ backgroundColor: '#fef9e7' }}>
                      <span className="text-base md:text-xl">🔥</span>
                    </div>
                  </div>
                  <div className="ml-2 md:ml-4 flex-1 min-w-0">
                    <p className="text-[10px] md:text-xs font-medium text-gray-500 truncate">Current Streak</p>
                    <p className="text-lg md:text-2xl font-bold text-gray-900 mt-0.5 md:mt-1">{stats.currentStreak} days</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Question Progress Grid */}
              {questionProgress.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-3 md:px-6 py-3 md:py-4 border-b border-gray-100" style={{ backgroundColor: '#fef9e7' }}>
                    <h2 className="text-base md:text-lg font-bold text-gray-900">Question Progress Over Time</h2>
                    <p className="text-xs md:text-sm text-gray-600 mt-0.5 md:mt-1">Track how each question improves week by week</p>
                  </div>
                
                  {/* Legend */}
                  <div className="flex items-center gap-2 md:gap-4 px-3 md:px-6 py-2 md:py-3 bg-gray-50 border-b border-gray-100 flex-wrap">
                    <div className="flex items-center gap-1 md:gap-2">
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-500"></div>
                      <span className="text-[10px] md:text-xs text-gray-700 font-medium">Good (7-10)</span>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2">
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-orange-500"></div>
                      <span className="text-[10px] md:text-xs text-gray-700 font-medium">Moderate (4-6)</span>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2">
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500"></div>
                      <span className="text-[10px] md:text-xs text-gray-700 font-medium">Needs Attention (0-3)</span>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2">
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-gray-400 border border-gray-500"></div>
                      <span className="text-[10px] md:text-xs text-gray-700 font-medium">Not Scored</span>
                    </div>
                  </div>

                {/* Desktop: Table Layout */}
                <div className="hidden md:block overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10">
                      <tr className="bg-gray-50/30">
                        <th className="text-left py-1.5 px-3 font-semibold text-[10px] text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50/95 backdrop-blur-sm z-20 min-w-[160px] border-r border-gray-100">
                          Question
                        </th>
                        {questionProgress[0]?.weeks.map((week, index) => (
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
                          {question.weeks.map((week, wIndex) => (
                            <td
                              key={wIndex}
                              className="text-center py-1.5 px-1"
                            >
                              <div
                                className={`w-6 h-6 rounded-full ${getStatusColor(week.status)} ${getStatusBorder(week.status)} flex items-center justify-center transition-all hover:scale-125 cursor-pointer shadow-sm mx-auto`}
                                title={week.status === 'grey' 
                                  ? `Week ${week.week}: Not Scored - ${week.date}` 
                                  : `Week ${week.week}: Score ${week.score}/10 - ${week.date}`}
                                onClick={() => setSelectedResponse({
                                  question: question.questionText,
                                  answer: week.answer,
                                  score: week.score,
                                  date: week.date,
                                  week: week.week,
                                  type: week.type
                                })}
                              >
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

                {/* Mobile: Compact Card Layout */}
                <div className="block md:hidden space-y-2 px-3 py-2 max-h-[500px] overflow-y-auto">
                  {questionProgress.map((question) => (
                    <div 
                      key={question.questionId}
                      className="bg-white rounded-lg border border-gray-200 p-2.5"
                    >
                      <h4 className="text-xs font-semibold text-gray-900 mb-2 line-clamp-2 leading-tight">
                        {question.questionText}
                      </h4>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {question.weeks.map((week, wIndex) => (
                          <div 
                            key={wIndex}
                            className="flex flex-col items-center gap-0.5 flex-shrink-0"
                          >
                            <div
                              className={`w-5 h-5 rounded-full ${getStatusColor(week.status)} ${getStatusBorder(week.status)} flex items-center justify-center transition-all active:scale-110 cursor-pointer shadow-sm`}
                              title={week.status === 'grey' 
                                ? `Week ${week.week}: Not Scored - ${week.date}` 
                                : `Week ${week.week}: Score ${week.score}/10 - ${week.date}`}
                              onClick={() => setSelectedResponse({
                                question: question.questionText,
                                answer: week.answer,
                                score: week.score,
                                date: week.date,
                                week: week.week,
                                type: week.type
                              })}
                            >
                            </div>
                            <span className="text-[8px] text-gray-500 font-medium">W{week.week}</span>
                          </div>
                        ))}
                        {/* Fill empty weeks if needed */}
                        {Array.from({ length: Math.max(0, (questionProgress[0]?.weeks.length || 0) - question.weeks.length) }).map((_, emptyIndex) => (
                          <div key={`empty-${emptyIndex}`} className="flex flex-col items-center gap-0.5 flex-shrink-0">
                            <div className="w-5 h-5 rounded-full bg-gray-100 border border-gray-200"></div>
                            <span className="text-[8px] text-gray-400">-</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Question Progress</h2>
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-sm">No question-level data available yet.</p>
                    <p className="text-xs mt-1 text-gray-400">Complete more check-ins to see your progress!</p>
                  </div>
                </div>
              )}

              {/* Measurements Graph */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: '#fef9e7' }}>
                  <h2 className="text-lg font-bold text-gray-900">Measurements Over Time</h2>
                  <p className="text-sm text-gray-600 mt-1">Track your body measurements over time</p>
                </div>
                <div className="p-6">
                  {/* Measurement Toggles */}
                  {getAvailableMeasurements().length > 0 && (
                    <div className="mb-6 flex flex-wrap gap-2">
                      {getAvailableMeasurements().map((measurement, index) => (
                        <button
                          key={measurement}
                          onClick={() => toggleMeasurement(measurement)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            selectedMeasurements.has(measurement)
                              ? 'text-white shadow-sm'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                          }`}
                          style={selectedMeasurements.has(measurement) ? { backgroundColor: '#daa450' } : {}}
                        >
                          {getMeasurementLabel(measurement)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Graph */}
                  {measurements.length > 0 && selectedMeasurements.size > 0 ? (
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={measurements.map(m => {
                            const date = m.date instanceof Date ? m.date : new Date(m.date);
                            const dataPoint: any = {
                              date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
                              fullDate: date.toISOString(),
                              isBaseline: m.isBaseline
                            };
                            
                            // Add each selected measurement to the data point
                            selectedMeasurements.forEach(key => {
                              const value = key === 'bodyWeight' 
                                ? (m.bodyWeight || null)
                                : (m.measurements?.[key] || null);
                              if (value !== null && value !== undefined && value > 0) {
                                dataPoint[getMeasurementLabel(key)] = Number(value.toFixed(1));
                              }
                            });
                            
                            return dataPoint;
                          })}
                          margin={{ top: 10, right: 30, left: 0, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#6b7280"
                            fontSize={11}
                            tick={{ fill: '#6b7280' }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            label={{ 
                              value: 'Date', 
                              position: 'insideBottom', 
                              offset: -5,
                              style: { textAnchor: 'middle', fill: '#6b7280' }
                            }}
                          />
                          <YAxis 
                            stroke="#6b7280"
                            fontSize={11}
                            tick={{ fill: '#6b7280' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e5e7eb', 
                              borderRadius: '8px',
                              fontSize: '12px'
                            }}
                            formatter={(value: number, name: string) => {
                              // Extract unit from the label (e.g., "Body Weight (kg)" -> "kg")
                              const unitMatch = name.match(/\((\w+)\)/);
                              const unit = unitMatch ? unitMatch[1] : '';
                              return [`${value}${unit ? ' ' + unit : ''}`, name.replace(/\s*\([^)]*\)\s*/g, '')];
                            }}
                            labelFormatter={(label, payload) => {
                              if (payload && payload[0]?.payload?.fullDate) {
                                const date = new Date(payload[0].payload.fullDate);
                                const baseline = payload[0].payload.isBaseline ? ' (Baseline)' : '';
                                return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + baseline;
                              }
                              return label;
                            }}
                          />
                          <Legend 
                            wrapperStyle={{ paddingTop: '20px' }}
                            iconType="line"
                            formatter={(value) => value}
                          />
                          {Array.from(selectedMeasurements).map((key, keyIndex) => {
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
                            const label = getMeasurementLabel(key);
                            
                            return (
                              <Line
                                key={key}
                                type="monotone"
                                dataKey={label}
                                stroke={color}
                                strokeWidth={2}
                                dot={{ r: 4, fill: color, stroke: 'white', strokeWidth: 2 }}
                                activeDot={{ r: 6 }}
                                connectNulls={false}
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-sm">No measurement data available yet.</p>
                      <p className="text-xs mt-1 text-gray-400">Complete check-ins with measurements to see your progress!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          {/* Insights */}
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Progress Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start">
                  <span className="text-green-600 mr-3 mt-1">✅</span>
                  <div>
                    <p className="font-medium text-gray-900">Consistency</p>
                    <p className="text-sm text-gray-600">
                      You've completed {stats.totalCheckIns} check-ins with {stats.consistency}% consistency
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-blue-600 mr-3 mt-1">📈</span>
                  <div>
                    <p className="font-medium text-gray-900">Improvement</p>
                    <p className="text-sm text-gray-600">
                      {stats.improvement >= 0 ? 'You\'ve improved by' : 'You\'ve declined by'} {Math.abs(stats.improvement)}% since starting
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <span className="text-purple-600 mr-3 mt-1">🎯</span>
                  <div>
                    <p className="font-medium text-gray-900">Best Performance</p>
                    <p className="text-sm text-gray-600">
                      Your highest score was {stats.bestScore}% - great work!
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-yellow-600 mr-3 mt-1">🔥</span>
                  <div>
                    <p className="font-medium text-gray-900">Current Streak</p>
                    <p className="text-sm text-gray-600">
                      You're on a {stats.currentStreak}-day streak. Keep it up!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Answer Detail Modal */}
          {selectedResponse && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedResponse(null)}
            >
                <div 
                  className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
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
                      <p className="text-sm font-medium text-gray-500 mb-1">Your Answer</p>
                      <div className="bg-gray-50 rounded-xl p-3">
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
                          )} border-2 ${getStatusBorder(
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
                      className="px-4 py-2 rounded-xl text-white font-medium transition-all shadow-sm hover:opacity-90"
                      style={{ backgroundColor: '#daa450' }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
          )}

          {/* Recommendations */}
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6" style={{ backgroundColor: '#fef9e7' }}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">💡 Recommendations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-gray-900 mb-2">Set Daily Reminders</p>
                <p className="text-sm text-gray-600">Schedule your check-ins at the same time each day to build consistency</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-2">Track Your Goals</p>
                <p className="text-sm text-gray-600">Set specific, measurable goals and review your progress weekly</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-2">Celebrate Wins</p>
                <p className="text-sm text-gray-600">Acknowledge your achievements, no matter how small they seem</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-2">Stay Connected</p>
                <p className="text-sm text-gray-600">Your coach is here to support you - reach out when you need help</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </AuthenticatedOnly>
    );
}
