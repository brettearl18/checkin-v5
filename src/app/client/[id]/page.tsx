'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface ClientProfilePageProps {
  params: {
    id: string;
  };
}

export default function ClientProfilePage({ params }: ClientProfilePageProps) {
  const [client, setClient] = useState<any>(null);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [clientId, setClientId] = useState<string>('');

  useEffect(() => {
    const fetchClientAndCheckIns = async () => {
      try {
        // Await params to get the client ID
        const resolvedParams = await params;
        const id = resolvedParams.id;
        setClientId(id);

        // Fetch client data
        const clientDoc = await getDoc(doc(db, 'clients', id));
        if (clientDoc.exists()) {
          setClient({ id: clientDoc.id, ...clientDoc.data() });
        }

        // Fetch check-ins for this client
        const checkInsQuery = query(
          collection(db, 'form_responses'),
          where('clientId', '==', id),
          orderBy('submittedAt', 'desc')
        );
        const checkInsSnapshot = await getDocs(checkInsQuery);
        
        const checkInsData: any[] = [];
        checkInsSnapshot.forEach((doc) => {
          const data = doc.data();
          checkInsData.push({
            id: doc.id,
            ...data
          });
        });
        
        setCheckIns(checkInsData);
      } catch (error) {
        console.error('Error fetching client data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientAndCheckIns();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
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

  const filteredCheckIns = checkIns.filter(checkIn => {
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
    
    return formMatch && dateMatch;
  });

  const getUniqueForms = () => {
    const forms = new Set<string>();
    checkIns.forEach(checkIn => forms.add(checkIn.formTitle));
    return Array.from(forms);
  };

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Client Not Found</h1>
          <p className="text-gray-800">The client you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
              <p className="mt-2 text-gray-800">Client Profile Dashboard</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                client.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {client.status}
              </span>
              <Link
                href={`/clients/${clientId}/scoring`}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                🎯 Scoring Config
              </Link>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Basic Info & Health Metrics */}
          <div className="lg:col-span-1 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-800">Email:</span>
                  <span className="font-medium">{client.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-800">Phone:</span>
                  <span className="font-medium">{client.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-800">Age:</span>
                  <span className="font-medium">{new Date().getFullYear() - new Date(client.dateOfBirth).getFullYear()} years</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-800">Gender:</span>
                  <span className="font-medium capitalize">{client.gender}</span>
                </div>
              </div>
            </div>

            {/* Health Metrics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Health Metrics</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{client.weight}kg</div>
                    <div className="text-sm text-gray-800">Current Weight</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{client.targetWeight}kg</div>
                    <div className="text-sm text-gray-800">Target Weight</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{client.bmi}</div>
                    <div className="text-sm text-gray-800">BMI</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{client.height}cm</div>
                    <div className="text-sm text-gray-800">Height</div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-800">Blood Pressure:</span>
                    <span className="font-medium">{client.healthMetrics?.bloodPressure}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-800">Heart Rate:</span>
                    <span className="font-medium">{client.healthMetrics?.restingHeartRate} bpm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-800">Body Fat:</span>
                    <span className="font-medium">{client.healthMetrics?.bodyFatPercentage}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lifestyle */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Lifestyle</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-800">Activity Level:</span>
                  <span className="font-medium capitalize">{client.lifestyle?.activityLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-800">Exercise:</span>
                  <span className="font-medium">{client.lifestyle?.exerciseFrequency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-800">Sleep:</span>
                  <span className="font-medium">{client.lifestyle?.sleepHours} hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-800">Stress Level:</span>
                  <span className="font-medium capitalize">{client.lifestyle?.stressLevel}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Goals, Progress, Coaching */}
          <div className="lg:col-span-2 space-y-6">
            {/* Goals */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Health Goals</h2>
              <div className="space-y-4">
                {client.goals?.map((goal) => (
                  <div key={goal.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">{goal.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        goal.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {goal.status}
                      </span>
                    </div>
                    <p className="text-gray-800 text-sm mb-3">{goal.description}</p>
                    <div className="flex justify-between items-center">
                      <div className="flex-1 mr-4">
                        <div className="flex justify-between text-sm text-gray-800 mb-1">
                          <span>Progress</span>
                          <span>{Math.round(goal.progress * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${goal.progress * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">Due: {new Date(goal.targetDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress Tracking */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Progress Tracking</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weight History */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Weight History</h3>
                  <div className="space-y-2">
                    {client.progress?.weightHistory?.map((entry, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-800">{new Date(entry.date).toLocaleDateString()}</span>
                        <span className="font-medium">{entry.weight}kg</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fitness Scores */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Fitness Scores</h3>
                  <div className="space-y-3">
                    {client.progress?.fitnessScores && Object.entries(client.progress.fitnessScores).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-sm text-gray-800 capitalize">{key}</span>
                        <div className="flex items-center">
                          <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${(value / 10) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{value}/10</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Coaching Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Coaching Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-800">Coach:</span>
                    <span className="font-medium">{client.coaching?.coachName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-800">Program:</span>
                    <span className="font-medium capitalize">{client.coaching?.programType?.replace('-', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-800">Frequency:</span>
                    <span className="font-medium capitalize">{client.coaching?.sessionFrequency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-800">Next Session:</span>
                    <span className="font-medium">{client.coaching?.nextSession ? new Date(client.coaching.nextSession).toLocaleDateString() : 'Not scheduled'}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-800">Start Date:</span>
                    <span className="font-medium">{client.coaching?.startDate ? new Date(client.coaching.startDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-800">Sessions:</span>
                    <span className="font-medium">{client.coaching?.completedSessions}/{client.coaching?.totalSessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-800">Check-in Rate:</span>
                    <span className="font-medium">{Math.round((client.engagement?.checkInRate || 0) * 100)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-800">Satisfaction:</span>
                    <span className="font-medium">{client.engagement?.satisfactionScore}/10</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Risk Assessment</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Risk Score</h3>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">{Math.round((client.riskFactors?.riskScore || 0) * 100)}%</div>
                    <div className="text-sm text-green-700">Low Risk</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Risk Factors</h3>
                  <div className="space-y-2">
                    {client.riskFactors?.currentRisks?.map((risk, index) => (
                      <div key={index} className="flex items-center">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-900 capitalize">{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Check-in History */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Check-in History</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-800">Total: {checkIns.length}</span>
                  <span className="text-sm text-gray-800">Avg Score: {checkIns.length > 0 ? Math.round(checkIns.reduce((sum, c) => sum + c.score, 0) / checkIns.length) : 0}%</span>
                </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Filter by Form
                  </label>
                  <select
                    value={selectedForm}
                    onChange={(e) => setSelectedForm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Date Range
                  </label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                  </select>
                </div>
              </div>

              {/* Check-ins List */}
              <div className="space-y-4">
                {filteredCheckIns.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-500 text-lg mb-2">No check-ins found</div>
                    <p className="text-gray-600">
                      {checkIns.length === 0 
                        ? "This client hasn't submitted any check-ins yet."
                        : "No check-ins match your current filters."
                      }
                    </p>
                  </div>
                ) : (
                  filteredCheckIns.map((checkIn) => (
                    <div key={checkIn.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {checkIn.formTitle || 'Unknown Form'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Submitted: {formatDate(checkIn.submittedAt)}
                          </p>
                          <p className="text-sm text-gray-500">
                            Questions: {checkIn.answeredQuestions}/{checkIn.totalQuestions}
                          </p>
                        </div>
                        <div className="ml-4">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(checkIn.score)}`}>
                            {checkIn.score}% - {getScoreLabel(checkIn.score)}
                          </div>
                        </div>
                      </div>

                      {/* Response Summary */}
                      <div className="border-t pt-3">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Response Summary:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            {Object.entries(checkIn.responses).slice(0, Math.ceil(Object.keys(checkIn.responses).length / 2)).map(([questionId, answer]) => (
                              <div key={questionId} className="text-sm">
                                <span className="font-medium text-gray-800">Q{questionId}:</span>
                                <span className="ml-2 text-gray-900">
                                  {typeof answer === 'boolean' ? (answer ? 'Yes' : 'No') : answer}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1">
                            {Object.entries(checkIn.responses).slice(Math.ceil(Object.keys(checkIn.responses).length / 2)).map(([questionId, answer]) => (
                              <div key={questionId} className="text-sm">
                                <span className="font-medium text-gray-800">Q{questionId}:</span>
                                <span className="ml-2 text-gray-900">
                                  {typeof answer === 'boolean' ? (answer ? 'Yes' : 'No') : answer}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="border-t pt-3 mt-3">
                        <div className="flex space-x-3">
                          <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            View Full Response
                          </button>
                          <button className="text-purple-600 hover:text-purple-800 text-sm font-medium">
                            Add Notes
                          </button>
                          <button className="text-green-600 hover:text-green-800 text-sm font-medium">
                            Send Follow-up
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notes */}
            {client.notes && client.notes.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Coach Notes</h2>
                <div className="space-y-4">
                  {client.notes.map((note) => (
                    <div key={note.id} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">{note.type}</span>
                        <span className="text-sm text-gray-500">{new Date(note.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-900">{note.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 