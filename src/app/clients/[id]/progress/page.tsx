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
    status: 'red' | 'orange' | 'green';
    answer: any;
    type: string;
  }[];
}

export default function ClientProgressPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const [client, setClient] = useState<any>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionProgress, setQuestionProgress] = useState<QuestionProgress[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<{
    question: string;
    answer: any;
    score: number;
    date: string;
    week: number;
    type: string;
  } | null>(null);

  useEffect(() => {
    if (clientId) {
      fetchClientData();
      fetchQuestionProgress();
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

      const responsesData: FormResponse[] = data.history || [];
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

    // Get all unique questions
    const questionMap = new Map<string, { questionId: string; questionText: string }>();
    
    sortedResponses.forEach(response => {
      if (response.responses && Array.isArray(response.responses)) {
        response.responses.forEach((qResp: QuestionResponse) => {
          if (qResp.questionId && !questionMap.has(qResp.questionId)) {
            questionMap.set(qResp.questionId, {
              questionId: qResp.questionId,
              questionText: qResp.question || `Question ${qResp.questionId.slice(0, 8)}`
            });
          }
        });
      }
    });

    // Create progress data for each question
    const progress: QuestionProgress[] = Array.from(questionMap.values()).map(question => {
      const weeks = sortedResponses.map((response, index) => {
        // Find this question's response in this check-in
        const qResponse = response.responses?.find(
          (r: QuestionResponse) => r.questionId === question.questionId
        );

        if (!qResponse) {
          return null;
        }

        // Get score (0-10 scale typically)
        const score = qResponse.score || 0;
        
        // Determine status based on score
        // Green: 7-10, Orange: 4-6, Red: 0-3
        let status: 'red' | 'orange' | 'green';
        if (score >= 7) {
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
          type: qResponse.type || 'text'
        };
      }).filter(w => w !== null) as { week: number; date: string; score: number; status: 'red' | 'orange' | 'green'; answer: any; type: string }[];

      return {
        questionId: question.questionId,
        questionText: question.questionText,
        weeks: weeks
      };
    });

    setQuestionProgress(progress);
  };

  const getStatusColor = (status: 'red' | 'orange' | 'green') => {
    switch (status) {
      case 'green':
        return 'bg-green-500';
      case 'orange':
        return 'bg-orange-500';
      case 'red':
        return 'bg-red-500';
    }
  };

  const getStatusBorder = (status: 'red' | 'orange' | 'green') => {
    switch (status) {
      case 'green':
        return 'border-green-600';
      case 'orange':
        return 'border-orange-600';
      case 'red':
        return 'border-red-600';
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

        {/* Question Progress Grid */}
        {questionProgress.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Question Progress Over Time</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Track how each question improves week by week</p>
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
          </div>
        ) : (
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











