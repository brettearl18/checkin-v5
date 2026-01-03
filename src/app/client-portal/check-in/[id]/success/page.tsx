'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import {
  getTrafficLightStatus,
  getTrafficLightColor,
  getTrafficLightGradient,
  getTrafficLightIcon,
  getTrafficLightLabel,
  getTrafficLightMessage,
  getScoreRangeDescription,
  getDefaultThresholds,
  convertLegacyThresholds,
  type ScoringThresholds,
  type TrafficLightStatus
} from '@/lib/scoring-utils';

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
  isRecurring?: boolean;
  recurringWeek?: number;
  totalWeeks?: number;
}

interface FormResponse {
  id: string;
  formId: string;
  formTitle: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  submittedAt: any;
  completedAt: any;
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  responses: Array<{
    questionId: string;
    question: string;
    answer: string | number | boolean;
    type: string;
    comment?: string;
  }>;
  status: string;
}

export default function CheckInSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [assignment, setAssignment] = useState<CheckInAssignment | null>(null);
  const [formResponse, setFormResponse] = useState<FormResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [thresholds, setThresholds] = useState<ScoringThresholds>(getDefaultThresholds('moderate'));
  const [trafficLightStatus, setTrafficLightStatus] = useState<TrafficLightStatus>('orange');
  const [showScoringInfo, setShowScoringInfo] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionScores, setQuestionScores] = useState<Array<{
    questionId: string;
    question: string;
    answer: any;
    questionScore: number;
    questionWeight: number;
    weightedScore: number;
    type: string;
  }>>([]);

  const id = params.id as string; // Can be either assignmentId or responseId
  const scoreParam = searchParams.get('score');

  useEffect(() => {
    if (scoreParam) {
      setScore(parseInt(scoreParam));
    }
    fetchData();
  }, [id, scoreParam]);

  const fetchData = async () => {
    try {
      if (!userProfile?.uid) {
        console.error('User not authenticated');
        setLoading(false);
        return;
      }

      // Fetch data via API route (uses admin SDK, bypasses permissions)
      const response = await fetch(`/api/client-portal/check-in/${id}/success?clientId=${userProfile.uid}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching check-in data:', errorData.message);
        setLoading(false);
        return;
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        console.error('Failed to fetch check-in data:', result.message);
        setLoading(false);
        return;
      }

      const { assignment, response: responseData, form, questions: questionsData, scoringConfig, formThresholds } = result.data;

      // Set assignment if available
      if (assignment) {
        setAssignment(assignment as CheckInAssignment);
      }

      // Set form response
      if (responseData) {
        setFormResponse(responseData as FormResponse);
        const responseScore = responseData.score || 0;
        setScore(responseScore);

        // Set questions
        if (questionsData && questionsData.length > 0) {
          setQuestions(questionsData);
          
          // Calculate scores for each question
          const calculatedScores = calculateQuestionScores(questionsData, responseData.responses);
          setQuestionScores(calculatedScores);
        }

        // Set scoring configuration - Priority: Form thresholds > Client thresholds > Defaults
        let finalThresholds: ScoringThresholds;
        
        // Priority 1: Use form thresholds if available (takes precedence)
        if (formThresholds?.redMax !== undefined && formThresholds?.orangeMax !== undefined) {
          finalThresholds = {
            redMax: formThresholds.redMax,
            orangeMax: formThresholds.orangeMax
          };
        } else if (scoringConfig) {
          // Priority 2: Use client scoring config
          if (scoringConfig.thresholds?.redMax !== undefined && scoringConfig.thresholds?.orangeMax !== undefined) {
            finalThresholds = {
              redMax: scoringConfig.thresholds.redMax,
              orangeMax: scoringConfig.thresholds.orangeMax
            };
          } else if (scoringConfig.thresholds?.red !== undefined && scoringConfig.thresholds?.yellow !== undefined) {
            // Convert legacy format
            finalThresholds = convertLegacyThresholds(scoringConfig.thresholds);
          } else if (scoringConfig.scoringProfile) {
            // Use profile defaults
            finalThresholds = getDefaultThresholds(scoringConfig.scoringProfile as any);
          } else {
            // Default to moderate
            finalThresholds = getDefaultThresholds('moderate');
          }
        } else {
          // Priority 3: No scoring config, use default moderate thresholds
          finalThresholds = getDefaultThresholds('moderate');
        }

        setThresholds(finalThresholds);
        setTrafficLightStatus(getTrafficLightStatus(responseScore, finalThresholds));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate individual question scores
  const calculateQuestionScores = (questionsData: any[], responses: FormResponse['responses']) => {
    const scores: Array<{
      questionId: string;
      question: string;
      answer: any;
      questionScore: number;
      questionWeight: number;
      weightedScore: number;
      type: string;
    }> = [];
    
    responses.forEach((response) => {
      const question = questionsData.find(q => q.id === response.questionId);
      if (!question) return;
      
      // Get question weight (default to 5 if not set)
      const questionWeight = question.questionWeight || question.weight || 5;
      
      let questionScore = 0; // Score out of 10
      
      switch (question.type) {
        case 'scale':
        case 'rating':
          const scaleValue = Number(response.answer);
          if (!isNaN(scaleValue) && scaleValue >= 1 && scaleValue <= 10) {
            questionScore = scaleValue;
          }
          break;
          
        case 'number':
          const numValue = Number(response.answer);
          if (!isNaN(numValue)) {
            if (numValue >= 0 && numValue <= 100) {
              questionScore = 1 + (numValue / 100) * 9;
            } else {
              questionScore = Math.min(10, Math.max(1, numValue / 10));
            }
          }
          break;
          
        case 'multiple_choice':
        case 'select':
          if (question.options && Array.isArray(question.options)) {
            const getOptionMatchValue = (opt: any) => {
              if (typeof opt === 'string') return opt;
              if (typeof opt === 'object' && opt.value) return opt.value;
              if (typeof opt === 'object' && opt.text) return opt.text;
              return String(opt);
            };
            
            const optionWithWeight = question.options.find((opt: any) => {
              const optValue = getOptionMatchValue(opt);
              const optText = typeof opt === 'object' && opt.text ? opt.text : optValue;
              return optValue === String(response.answer) || optText === String(response.answer);
            });
            
            if (optionWithWeight && typeof optionWithWeight === 'object' && optionWithWeight.weight) {
              questionScore = optionWithWeight.weight;
            } else {
              const selectedIndex = question.options.findIndex((opt: any) => {
                const optValue = getOptionMatchValue(opt);
                const optText = typeof opt === 'object' && opt.text ? opt.text : optValue;
                return optValue === String(response.answer) || optText === String(response.answer);
              });
              if (selectedIndex >= 0) {
                const numOptions = question.options.length;
                questionScore = numOptions === 1 ? 5 : 1 + (selectedIndex / (numOptions - 1)) * 9;
              }
            }
          }
          break;
          
        case 'boolean':
          const yesIsPositive = question.yesIsPositive !== undefined ? question.yesIsPositive : true;
          const isYes = response.answer === true || response.answer === 'yes' || response.answer === 'Yes';
          questionScore = yesIsPositive ? (isYes ? 8 : 3) : (isYes ? 3 : 8);
          break;
          
        case 'text':
          // Text questions are NOT scored - skip them entirely
          // They are not measurable and should not appear in score breakdown
          return; // Skip this question - don't add to scores array
          
        case 'textarea':
          // Textarea questions are not scored - skip them entirely
          // They are for free-form text responses only
          return; // Skip this question - don't add to scores array
          
        default:
          questionScore = 5;
          break;
      }
      
      const weightedScore = questionScore * questionWeight;
      
      // Only add scorable questions to the scores array
      scores.push({
        questionId: question.id,
        question: response.question,
        answer: response.answer,
        questionScore,
        questionWeight,
        weightedScore,
        type: question.type
      });
    });
    
    return scores;
  };

  // Use traffic light system instead of hardcoded thresholds
  const getScoreColor = () => getTrafficLightGradient(trafficLightStatus);
  const getScoreBgColor = () => {
    switch (trafficLightStatus) {
      case 'red': return 'bg-red-50 border-red-200';
      case 'orange': return 'bg-orange-50 border-orange-200';
      case 'green': return 'bg-green-50 border-green-200';
    }
  };
  const getScoreMessage = () => getTrafficLightMessage(trafficLightStatus, score);
  const getScoreEmoji = () => {
    switch (trafficLightStatus) {
      case 'red': return '💪';
      case 'orange': return '😊';
      case 'green': return '🎉';
    }
  };

  const formatDate = (dateField: any) => {
    if (!dateField) return 'N/A';
    
    // Handle Firestore Timestamp
    if (dateField.toDate && typeof dateField.toDate === 'function') {
      return dateField.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Handle Firebase Timestamp object with _seconds
    if (dateField._seconds) {
      return new Date(dateField._seconds * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Handle Date object
    if (dateField instanceof Date) {
      return dateField.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Handle ISO string
    if (typeof dateField === 'string') {
      return new Date(dateField).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return 'N/A';
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex">
          <ClientNavigation />
          <div className="flex-1 ml-4 p-5">
            <div className="max-w-4xl">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="h-64 bg-gray-200 rounded mb-6"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-4 p-4 sm:p-5 lg:p-6">
          <div className="max-w-4xl">
            {/* Success Header */}
            <div className="text-center mb-6 lg:mb-8">
              <div className="mx-auto w-20 h-20 lg:w-24 lg:h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-4 lg:mb-6 shadow-lg">
                <svg className="w-10 h-10 lg:w-12 lg:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 lg:mb-3">
                Check-in Completed!
              </h1>
              <p className="text-gray-900 text-sm lg:text-base font-medium">
                Thank you for completing your check-in
              </p>
            </div>

            {/* Score Card */}
            <div className={`bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8 ${getScoreBgColor()}`}>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-4 lg:mb-5">
                  <span className="text-4xl lg:text-5xl">{getTrafficLightIcon(trafficLightStatus)}</span>
                  <span className="text-3xl lg:text-4xl">{getScoreEmoji()}</span>
                </div>
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-3 lg:mb-4">
                  Your Score
                </h2>
                <div className={`text-6xl lg:text-7xl font-bold mb-3 lg:mb-4 bg-gradient-to-r ${getScoreColor()} bg-clip-text text-transparent`}>
                  {score}%
                </div>
                <div className={`inline-flex items-center gap-1.5 px-4 py-1.5 lg:px-5 lg:py-2 rounded-full text-sm lg:text-base font-semibold mb-4 lg:mb-5 ${getTrafficLightColor(trafficLightStatus)}`}>
                  <span>{getTrafficLightIcon(trafficLightStatus)}</span>
                  <span>{getTrafficLightLabel(trafficLightStatus)}</span>
                </div>
                <p className="text-base lg:text-lg text-gray-900 mb-6 lg:mb-8 font-medium">
                  {getScoreMessage()}
                </p>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 lg:h-3.5 mb-6 lg:mb-8">
                  <div 
                    className={`h-3 lg:h-3.5 rounded-full transition-all duration-1000 bg-gradient-to-r ${getScoreColor()}`}
                    style={{ width: `${score}%` }}
                  ></div>
                </div>
                
                {/* Score Range Description */}
                <div className="text-sm lg:text-base text-gray-900 space-y-2">
                  <div className="font-bold mb-3 lg:mb-4">Your Score Ranges:</div>
                  <div className="grid grid-cols-3 gap-3 lg:gap-4">
                    <div className="bg-gray-50 rounded-xl lg:rounded-2xl p-3 lg:p-4 border border-gray-200">
                      <div className="font-semibold lg:font-bold flex items-center justify-center gap-1.5 mb-1.5 lg:mb-2">
                        <span className="text-lg lg:text-xl">🔴</span> <span className="text-sm lg:text-base">Red</span>
                      </div>
                      <div className="text-xs lg:text-sm font-medium">0-{thresholds.redMax}%</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl lg:rounded-2xl p-3 lg:p-4 border border-gray-200">
                      <div className="font-semibold lg:font-bold flex items-center justify-center gap-1.5 mb-1.5 lg:mb-2">
                        <span className="text-lg lg:text-xl">🟠</span> <span className="text-sm lg:text-base">Orange</span>
                      </div>
                      <div className="text-xs lg:text-sm font-medium">{thresholds.redMax + 1}-{thresholds.orangeMax}%</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl lg:rounded-2xl p-3 lg:p-4 border border-gray-200">
                      <div className="font-semibold lg:font-bold flex items-center justify-center gap-1.5 mb-1.5 lg:mb-2">
                        <span className="text-lg lg:text-xl">🟢</span> <span className="text-sm lg:text-base">Green</span>
                      </div>
                      <div className="text-xs lg:text-sm font-medium">{thresholds.orangeMax + 1}-100%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scoring Formula & Traffic Light Info */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8">
              <button
                onClick={() => setShowScoringInfo(!showScoringInfo)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg lg:text-xl font-bold text-gray-900">How Your Score is Calculated</h3>
                    <p className="text-sm lg:text-base text-gray-600 mt-1">Learn about the scoring formula and traffic light system</p>
                  </div>
                </div>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform ${showScoringInfo ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showScoringInfo && (
                <div className="mt-6 pt-6 border-t border-gray-200 space-y-6">
                  {/* Scoring Formula */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-blue-600">📊</span>
                      Scoring Formula
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="text-sm text-gray-700">
                        <p className="font-semibold mb-2">Each question contributes to your score:</p>
                        <div className="bg-white rounded p-3 font-mono text-xs border border-gray-200">
                          <div className="mb-2">weightedScore = questionScore × questionWeight</div>
                          <div className="mb-2">totalScore = (Σ weightedScores / (Σ weights × 10)) × 100</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>• <strong>Question Weight (1-10):</strong> How important the question is</p>
                        <p>• <strong>Question Score (1-10):</strong> Your answer converted to a score</p>
                        <p>• <strong>Final Score (0-100%):</strong> Weighted average of all questions</p>
                      </div>
                    </div>
                  </div>

                  {/* Answer Scoring */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-green-600">✅</span>
                      How Answers Are Scored
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="font-semibold mb-1">Scale (1-10):</p>
                        <p>Direct value (e.g., 7 = 7/10)</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="font-semibold mb-1">Yes/No:</p>
                        <p>Yes = 8/10, No = 3/10</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="font-semibold mb-1">Single/Multiple Choice:</p>
                        <p>Uses option weights if set</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="font-semibold mb-1">Text Questions:</p>
                        <p>Neutral score of 5/10</p>
                      </div>
                    </div>
                  </div>

                  {/* Traffic Light Thresholds */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-yellow-600">🚦</span>
                      Your Traffic Light Thresholds
                    </h4>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4">
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="bg-white rounded-lg p-3 border-2 border-red-200">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-lg">🔴</span>
                            <span className="font-bold text-red-700 text-xs">Red Zone</span>
                          </div>
                          <p className="text-xs font-semibold text-gray-900">0 - {thresholds.redMax}%</p>
                          <p className="text-xs text-gray-600 mt-1">Needs Attention</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border-2 border-orange-200">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-lg">🟠</span>
                            <span className="font-bold text-orange-700 text-xs">Orange Zone</span>
                          </div>
                          <p className="text-xs font-semibold text-gray-900">{thresholds.redMax + 1} - {thresholds.orangeMax}%</p>
                          <p className="text-xs text-gray-600 mt-1">On Track</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border-2 border-green-200">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-lg">🟢</span>
                            <span className="font-bold text-green-700 text-xs">Green Zone</span>
                          </div>
                          <p className="text-xs font-semibold text-gray-900">{thresholds.orangeMax + 1} - 100%</p>
                          <p className="text-xs text-gray-600 mt-1">Excellent</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 italic">
                        These thresholds are personalized based on your client profile and goals.
                      </p>
                    </div>
                  </div>

                  {/* Example Calculation */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-purple-600">💡</span>
                      Example Calculation
                    </h4>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-xs text-gray-700 space-y-2">
                        <p><strong>3 Questions:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Q1: Sleep (Weight 8) → Answer: 7 → Score: 7 × 8 = 56</li>
                          <li>Q2: Exercise (Weight 5) → Answer: Yes → Score: 8 × 5 = 40</li>
                          <li>Q3: Notes (Weight 2) → Answer: Text → Score: 5 × 2 = 10</li>
                        </ul>
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <p><strong>Total:</strong> (56 + 40 + 10) / (15 × 10) × 100 = <strong>71%</strong></p>
                          <p className="mt-1 text-orange-700 font-semibold">→ 🟠 Orange Zone (On Track)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Assignment Details */}
            {assignment && (
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8">
                <h3 className="text-lg lg:text-xl font-bold text-gray-900 mb-4 lg:mb-6">Check-in Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-900 mb-1 font-medium">Form Title</p>
                    <p className="text-sm font-semibold text-gray-900">{assignment.formTitle || 'Check-in Form'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-900 mb-1 font-medium">Status</p>
                    <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Completed
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-900 mb-1 font-medium">Completed On</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formResponse?.submittedAt ? formatDate(formResponse.submittedAt) : formatDate(new Date())}
                    </p>
                  </div>
                  {assignment.isRecurring && assignment.recurringWeek && assignment.totalWeeks && (
                    <div>
                      <p className="text-xs text-gray-900 mb-1 font-medium">Progress</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          Week {assignment.recurringWeek} of {assignment.totalWeeks}
                        </p>
                        <div className="flex-1 max-w-24 bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full"
                            style={{ width: `${(assignment.recurringWeek / assignment.totalWeeks) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-blue-200 p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8">
              <h3 className="text-lg lg:text-xl font-bold text-gray-900 mb-4 lg:mb-6">What's Next?</h3>
              <div className="space-y-4 lg:space-y-5">
                <div className="flex items-start gap-3 lg:gap-4">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-100 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-bold text-base lg:text-lg mb-1.5 lg:mb-2">Your coach will review your responses</p>
                    <p className="text-gray-900 text-sm lg:text-base">They'll analyze your answers and provide personalized feedback</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 lg:gap-4">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 bg-indigo-100 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 lg:w-6 lg:h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-bold text-base lg:text-lg mb-1.5 lg:mb-2">Track your progress over time</p>
                    <p className="text-gray-900 text-sm lg:text-base">Monitor your improvements and trends in your wellness journey</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 lg:gap-4">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-100 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-bold text-base lg:text-lg mb-1.5 lg:mb-2">Look out for your next check-in</p>
                    <p className="text-gray-900 text-sm lg:text-base">Complete regular check-ins to maintain momentum</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Question Score Breakdown */}
            {questionScores.length > 0 && (
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8">
                <h3 className="text-lg lg:text-xl font-bold text-gray-900 mb-4 lg:mb-6">Question Score Breakdown</h3>
                <div className="space-y-3">
                  {questionScores.map((item, index) => {
                    const percentage = item.questionWeight > 0 
                      ? Math.round((item.weightedScore / (item.questionWeight * 10)) * 100)
                      : 0;
                    
                    return (
                      <div key={item.questionId} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-700">Q{index + 1}:</span>
                              <span className="text-sm font-medium text-gray-900">{item.question}</span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-semibold">Answer:</span> {
                                typeof item.answer === 'boolean' 
                                  ? (item.answer ? 'Yes' : 'No')
                                  : String(item.answer)
                              }
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-lg font-bold text-gray-900">{item.questionScore}/10</div>
                            <div className="text-xs text-gray-600">Score</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200">
                          <div className="text-center">
                            <div className="text-xs text-gray-600 mb-1">Weight</div>
                            <div className="text-sm font-bold text-gray-900">{item.questionWeight}/10</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-600 mb-1">Weighted</div>
                            <div className="text-sm font-bold text-gray-900">{item.weightedScore}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-600 mb-1">Contribution</div>
                            <div className="text-sm font-bold text-gray-900">{percentage}%</div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full transition-all ${
                                item.questionScore >= 8 ? 'bg-green-500' :
                                item.questionScore >= 5 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${(item.questionScore / 10) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-900">Total Weighted Score:</span>
                    <span className="font-bold text-gray-900">
                      {questionScores.reduce((sum, item) => sum + item.weightedScore, 0)} / {questionScores.reduce((sum, item) => sum + item.questionWeight * 10, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="font-semibold text-gray-900">Final Score:</span>
                    <span className="font-bold text-gray-900">{score}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Your Responses */}
            {formResponse && formResponse.responses && formResponse.responses.length > 0 && (
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8">
                <div className="flex items-center justify-between mb-4 lg:mb-6">
                  <h3 className="text-lg lg:text-xl font-bold text-gray-900">Your Responses</h3>
                  {formResponse && assignment && (
                    <Link
                      href={`/client-portal/check-in/${assignment.id || id}/edit`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit Responses
                    </Link>
                  )}
                </div>
                <div className="space-y-4">
                  {formResponse.responses.map((response, index) => (
                    <div key={response.questionId} className="border-b border-gray-200/60 pb-4 last:border-b-0 last:pb-0">
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                            Q{index + 1}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {response.type}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{response.question}</p>
                      </div>
                      
                      <div className="bg-gray-50/80 rounded-lg p-3">
                        <p className="text-xs text-gray-900 mb-1 font-medium">Your Answer</p>
                        <p className="text-sm text-gray-900 font-semibold">
                          {typeof response.answer === 'boolean' 
                            ? (response.answer ? 'Yes' : 'No')
                            : response.answer.toString()}
                        </p>
                        {response.comment && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-900 mb-1 font-medium">Comment</p>
                            <p className="text-xs text-gray-900">{response.comment}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 justify-center">
              <Link
                href="/client-portal/check-ins"
                className="px-6 py-3 lg:px-8 lg:py-3.5 bg-white text-gray-900 rounded-xl lg:rounded-2xl hover:bg-gray-50 border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:shadow-md transition-all duration-200 text-sm lg:text-base font-semibold text-center min-h-[44px] lg:min-h-[48px] flex items-center justify-center"
              >
                Back to Check-ins
              </Link>
              <Link
                href="/client-portal"
                className="px-6 py-3 lg:px-8 lg:py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl lg:rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg text-sm lg:text-base font-semibold text-center min-h-[44px] lg:min-h-[48px] flex items-center justify-center"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/client-portal/progress"
                className="px-6 py-3 lg:px-8 lg:py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl lg:rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg text-sm lg:text-base font-semibold text-center min-h-[44px] lg:min-h-[48px] flex items-center justify-center"
              >
                View Progress
              </Link>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 