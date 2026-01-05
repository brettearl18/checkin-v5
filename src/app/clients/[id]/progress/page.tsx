'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import CoachNavigation from '@/components/CoachNavigation';

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
  // Lifecycle tracking
  firstSeenWeek: number;
  lastSeenWeek: number;
  isActive: boolean;
  textChanges: string[]; // Track if question text changed across weeks
}

export default function ClientProgressPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const [client, setClient] = useState<any>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionProgress, setQuestionProgress] = useState<QuestionProgress[]>([]);
  const [showAllQuestions, setShowAllQuestions] = useState(false); // Default: show active questions only
  const [selectedResponse, setSelectedResponse] = useState<{
    question: string;
    answer: any;
    score: number;
    date: string;
    week: number;
    type: string;
  } | null>(null);
  const [measurementHistory, setMeasurementHistory] = useState<any[]>([]);
  const [allMeasurementsData, setAllMeasurementsData] = useState<any[]>([]);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);

  useEffect(() => {
    if (clientId) {
      fetchClientData();
      fetchQuestionProgress();
      fetchMeasurementHistory();
    }
  }, [clientId]);

  const fetchClientData = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setClient(data.client);
        }
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    }
  };

  const fetchMeasurementHistory = async () => {
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

  const fetchQuestionProgress = async () => {
    if (!clientId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/client-portal/history?clientId=${clientId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch question progress data');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch question progress data');
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
      
      setResponses(responsesData);
      processQuestionProgress(responsesData);
    } catch (error) {
      console.error('Error fetching question progress:', error);
      setQuestionProgress([]);
    } finally {
      setLoading(false);
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

    const totalWeeks = sortedResponses.length;
    const lastWeekIndex = totalWeeks - 1;

    // Helper function to check if text change is significant (not just minor wording adjustment)
    const isSignificantTextChange = (text1: string, text2: string): boolean => {
      const normalize = (text: string) => text.toLowerCase().trim().replace(/\s+/g, ' ');
      const norm1 = normalize(text1);
      const norm2 = normalize(text2);
      
      // If texts are identical after normalization, it's not a change
      if (norm1 === norm2) return false;
      
      // Calculate similarity (simple Levenshtein-like approach)
      // If more than 30% of characters differ, consider it significant
      const maxLen = Math.max(norm1.length, norm2.length);
      if (maxLen === 0) return false;
      
      // Count differences (simple approach)
      let differences = 0;
      const minLen = Math.min(norm1.length, norm2.length);
      for (let i = 0; i < minLen; i++) {
        if (norm1[i] !== norm2[i]) differences++;
      }
      differences += Math.abs(norm1.length - norm2.length);
      
      const changePercentage = differences / maxLen;
      
      // Only flag if change is > 20% (significant change)
      // This allows minor wording tweaks, punctuation, capitalization changes
      return changePercentage > 0.2;
    };

    // Track question lifecycle metadata
    const questionMetadata = new Map<string, {
      firstSeenWeek: number;
      lastSeenWeek: number;
      isActive: boolean;
      significantTextChanges: Set<string>; // Track only significant text changes
      allTexts: string[]; // Store all texts in order
    }>();

    // First pass: collect all unique questions and track their lifecycle
    const questionMap = new Map<string, { questionId: string; questionText: string }>();
    
    sortedResponses.forEach((response, weekIndex) => {
      if (response.responses && Array.isArray(response.responses)) {
        response.responses.forEach((qResp: QuestionResponse) => {
          if (qResp.questionId) {
            const questionText = qResp.question || `Question ${qResp.questionId.slice(0, 8)}`;
            
            // Track metadata
            if (!questionMetadata.has(qResp.questionId)) {
              questionMetadata.set(qResp.questionId, {
                firstSeenWeek: weekIndex + 1,
                lastSeenWeek: weekIndex + 1,
                isActive: weekIndex === lastWeekIndex,
                significantTextChanges: new Set([questionText]),
                allTexts: [questionText]
              });
              questionMap.set(qResp.questionId, {
                questionId: qResp.questionId,
                questionText: questionText
              });
            } else {
              const metadata = questionMetadata.get(qResp.questionId)!;
              metadata.firstSeenWeek = Math.min(metadata.firstSeenWeek, weekIndex + 1);
              metadata.lastSeenWeek = Math.max(metadata.lastSeenWeek, weekIndex + 1);
              metadata.isActive = weekIndex === lastWeekIndex;
              
              // Track only significant text changes (ignore minor wording adjustments)
              const lastText = metadata.allTexts[metadata.allTexts.length - 1];
              if (questionText !== lastText && isSignificantTextChange(lastText, questionText)) {
                metadata.significantTextChanges.add(questionText);
              }
              
              // Always store the text (even if not significant change)
              metadata.allTexts.push(questionText);
              
              // Update question text to latest version
              questionMap.set(qResp.questionId, {
                questionId: qResp.questionId,
                questionText: questionText
              });
            }
          }
        });
      }
    });

    // Create progress data for each question
    // Include ALL questions (including text/textarea) - they will show grey if unscored
    const progress: QuestionProgress[] = Array.from(questionMap.values())
      .map(question => {
        const metadata = questionMetadata.get(question.questionId)!;
        const weeks = sortedResponses.map((response, index) => {
        // Find this question's response in this check-in
        const qResponse = response.responses?.find(
          (r: QuestionResponse) => r.questionId === question.questionId
        );

        if (!qResponse) {
          return null;
        }

        // Get score (0-10 scale typically) and weight
        const score = qResponse.score || 0;
        const weight = qResponse.weight !== undefined ? qResponse.weight : 5; // Default weight if not set
        const questionType = qResponse.type || 'text';
        
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
        weeks: weeks,
        firstSeenWeek: metadata.firstSeenWeek,
        lastSeenWeek: metadata.lastSeenWeek,
        isActive: metadata.isActive,
        textChanges: Array.from(metadata.significantTextChanges) // Only significant changes
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

  if (loading && !questionProgress.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <CoachNavigation />
        <div className="flex-1 ml-8 p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
      <CoachNavigation />
      
      <div className="flex-1 ml-8 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Progress: {client?.firstName} {client?.lastName}
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Question-level progress over time</p>
            </div>
            <Link
              href={`/clients/${clientId}`}
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              ← Back to Client Profile
            </Link>
          </div>
        </div>

        {/* Weight, Measurements, and Goals Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Weight Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-orange-50 px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Weight</h2>
            </div>
            <div className="p-6">
              {loadingMeasurements ? (
                <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
              ) : allMeasurementsData.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    const latest = allMeasurementsData[allMeasurementsData.length - 1];
                    const baseline = allMeasurementsData.find(m => m.isBaseline) || allMeasurementsData[0];
                    const currentWeight = latest?.bodyWeight;
                    const baselineWeight = baseline?.bodyWeight;
                    const change = baselineWeight && currentWeight ? baselineWeight - currentWeight : null;
                    
                    return (
                      <>
                        <div>
                          <p className="text-sm text-gray-600">Current Weight</p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">
                            {currentWeight ? `${currentWeight} kg` : 'Not recorded'}
                          </p>
                        </div>
                        {baselineWeight && change !== null && (
                          <div className="pt-3 border-t border-gray-100">
                            <p className="text-sm text-gray-600">Change from Baseline</p>
                            <p className={`text-xl font-bold mt-1 ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                              {change > 0 ? '+' : ''}{change.toFixed(1)} kg
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Baseline: {baselineWeight} kg</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">No weight data available</div>
              )}
            </div>
          </div>

          {/* Measurements Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-purple-50 px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Body Measurements</h2>
            </div>
            <div className="p-6">
              {loadingMeasurements ? (
                <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
              ) : allMeasurementsData.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const latest = allMeasurementsData[allMeasurementsData.length - 1];
                    const measurements = latest?.measurements || {};
                    const measurementKeys = ['waist', 'hips', 'chest', 'leftThigh', 'rightThigh', 'leftArm', 'rightArm'];
                    const measurementLabels: { [key: string]: string } = {
                      waist: 'Waist',
                      hips: 'Hips',
                      chest: 'Chest',
                      leftThigh: 'Left Thigh',
                      rightThigh: 'Right Thigh',
                      leftArm: 'Left Arm',
                      rightArm: 'Right Arm'
                    };
                    const availableMeasurements = measurementKeys.filter(key => measurements[key]);
                    
                    if (availableMeasurements.length === 0) {
                      return <div className="text-center py-4 text-gray-500 text-sm">No measurements recorded</div>;
                    }
                    
                    return (
                      <div className="space-y-2">
                        {availableMeasurements.slice(0, 4).map((key) => (
                          <div key={key} className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{measurementLabels[key]}</span>
                            <span className="text-sm font-semibold text-gray-900">{measurements[key]} cm</span>
                          </div>
                        ))}
                        {availableMeasurements.length > 4 && (
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            +{availableMeasurements.length - 4} more
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">No measurements available</div>
              )}
            </div>
          </div>

          {/* Goals Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-green-50 px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Goals</h2>
            </div>
            <div className="p-6">
              {client?.goals && client.goals.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {client.goals.slice(0, 4).map((goal: string, index: number) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-green-100 text-green-800 text-xs font-medium rounded-full border border-green-200"
                    >
                      {goal}
                    </span>
                  ))}
                  {client.goals.length > 4 && (
                    <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                      +{client.goals.length - 4} more
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">No goals set</div>
              )}
            </div>
          </div>
        </div>

        {/* Question Progress Grid */}
        {questionProgress.length > 0 ? (() => {
          // Filter questions based on showAllQuestions preference
          const filteredQuestions = showAllQuestions 
            ? questionProgress 
            : questionProgress.filter(q => q.isActive);

          // Get all weeks for consistent column rendering (use first question's weeks if available)
          const allWeeks = questionProgress[0]?.weeks || [];

          return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Question Progress Over Time</h2>
                  <p className="text-[10px] text-gray-500 mt-0.5">Track how each question improves week by week</p>
                </div>
                <button
                  onClick={() => setShowAllQuestions(!showAllQuestions)}
                  className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 transition-colors shadow-sm"
                >
                  {showAllQuestions ? 'Show Active Only' : 'Show All Questions'}
                </button>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-1 px-4 py-2 bg-gray-50/50 border-b border-gray-100">
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
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10">
                  <tr className="bg-gray-50/30">
                    <th className="text-left py-1.5 px-3 font-semibold text-[10px] text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50/95 backdrop-blur-sm z-20 min-w-[200px] border-r border-gray-100">
                      Question
                    </th>
                    {allWeeks.map((week, index) => (
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
                  {filteredQuestions.map((question, qIndex) => {
                    const isDeprecated = !question.isActive;
                    const isNew = question.firstSeenWeek > 1;
                    const hasTextChanges = question.textChanges.length > 1;
                    const isActiveInWeek = (weekNum: number) => {
                      return weekNum >= question.firstSeenWeek && 
                             (!question.lastSeenWeek || weekNum <= question.lastSeenWeek);
                    };

                    return (
                    <tr 
                      key={question.questionId} 
                      className={`transition-colors hover:bg-gray-50/50 ${
                        qIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      } ${isDeprecated ? 'opacity-60' : ''}`}
                    >
                      <td className="py-1.5 px-3 text-xs font-medium sticky left-0 bg-inherit z-10 border-r border-gray-100">
                        <div className="max-w-[200px]">
                          <div className={`flex items-start gap-1.5 leading-tight ${isDeprecated ? 'text-gray-500 italic' : 'text-gray-900'}`}>
                            <div className="flex-1 min-w-0">
                              <div className="line-clamp-2">
                                {question.questionText}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {isNew && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                    NEW
                                  </span>
                                )}
                                {isDeprecated && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-200 text-gray-600 border border-gray-300">
                                    Removed W{question.lastSeenWeek}
                                  </span>
                                )}
                                {hasTextChanges && (
                                  <span 
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-yellow-100 text-yellow-700 border border-yellow-200 cursor-help"
                                    title="Question wording changed during program"
                                  >
                                    ⚠ Changed
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      {allWeeks.map((week, wIndex) => {
                        const questionWeek = question.weeks.find(w => w.week === week.week);
                        
                        if (questionWeek) {
                          return (
                            <td
                              key={wIndex}
                              className="text-center py-1.5 px-1"
                            >
                              <div
                                className={`w-6 h-6 rounded-full ${getStatusColor(questionWeek.status)} ${getStatusBorder(questionWeek.status)} flex items-center justify-center transition-all hover:scale-125 cursor-pointer shadow-sm mx-auto`}
                                title={questionWeek.status === 'grey' 
                                  ? `Week ${questionWeek.week}: Not Scored - ${questionWeek.date}` 
                                  : `Week ${questionWeek.week}: Score ${questionWeek.score}/10 - ${questionWeek.date}`}
                                onClick={() => setSelectedResponse({
                                  question: question.questionText,
                                  answer: questionWeek.answer,
                                  score: questionWeek.score,
                                  date: questionWeek.date,
                                  week: questionWeek.week,
                                  type: questionWeek.type
                                })}
                              >
                                {questionWeek.status !== 'grey' && (
                                  <span className="text-white text-[9px] font-bold">{questionWeek.score}</span>
                                )}
                              </div>
                            </td>
                          );
                        } else {
                          // Question not present in this week
                          const wasActive = isActiveInWeek(week.week);
                          return (
                            <td key={wIndex} className="text-center py-1.5 px-1">
                              <div 
                                className="w-6 h-6 rounded-full bg-gray-50 border border-gray-200 mx-auto flex items-center justify-center"
                                title={wasActive ? "Question not in this check-in" : "Question not yet added or already removed"}
                              >
                                <span className="text-gray-300 text-xs">—</span>
                              </div>
                            </td>
                          );
                        }
                      })}
                    </tr>
                  )})}
                  {filteredQuestions.length === 0 && (
                    <tr>
                      <td colSpan={allWeeks.length + 1} className="py-8 text-center text-gray-500 text-sm">
                        {showAllQuestions ? 'No questions found' : 'No active questions. Enable "Show All Questions" to see historical questions.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          );
        })() : (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No question progress data available yet.
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
      </div>
    </div>
  );
}











