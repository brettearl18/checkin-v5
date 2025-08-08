'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  goals?: string[];
  healthConditions?: string[];
  riskFactors?: string[];
  lastCheckIn?: string;
  averageScore?: number;
  missedCheckIns?: number;
  engagementScore?: number;
}

interface RiskAnalysis {
  clientId: string;
  clientName: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  lastAssessment: string;
  trend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
  alerts: string[];
}

interface RiskMetrics {
  totalClients: number;
  atRiskClients: number;
  criticalRisk: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  averageRiskScore: number;
  riskTrend: 'improving' | 'stable' | 'declining';
  topRiskFactors: Array<{ factor: string; count: number }>;
  recentAlerts: Array<{ clientId: string; clientName: string; alert: string; timestamp: string }>;
}

export default function RiskAnalysisPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [riskData, setRiskData] = useState<RiskAnalysis[]>([]);
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'riskScore' | 'clientName' | 'lastAssessment'>('riskScore');

  useEffect(() => {
    fetchRiskData();
  }, []);

  const fetchRiskData = async () => {
    try {
      setIsLoading(true);
      // Get coach ID from user context or use a default for testing
      const coachId = 'BYAUh1d6PwanHhIUhISsmZtgt0B2'; // This should come from auth context
      
      const response = await fetch(`/api/analytics/risk?coachId=${coachId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRiskData(data.riskAnalysis || []);
          setMetrics(data.metrics || null);
        } else {
          console.error('Failed to fetch risk data:', data.message);
          setRiskData([]);
          setMetrics(null);
        }
      } else {
        console.error('Failed to fetch risk data');
        setRiskData([]);
        setMetrics(null);
      }
    } catch (error) {
      console.error('Error fetching risk data:', error);
      setRiskData([]);
      setMetrics(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setMockData = () => {
    const mockRiskAnalysis: RiskAnalysis[] = [
      {
        clientId: '1',
        clientName: 'Sarah Johnson',
        riskScore: 85,
        riskLevel: 'critical',
        riskFactors: ['Missed 3 check-ins', 'Declining performance', 'Low engagement'],
        lastAssessment: '2025-01-15',
        trend: 'declining',
        recommendations: ['Schedule intervention call', 'Review goals', 'Increase support'],
        alerts: ['Critical: Performance dropped 30%', 'Alert: 3 missed check-ins']
      },
      {
        clientId: '2',
        clientName: 'Mike Chen',
        riskScore: 72,
        riskLevel: 'high',
        riskFactors: ['Inconsistent responses', 'Below target scores'],
        lastAssessment: '2025-01-14',
        trend: 'stable',
        recommendations: ['Weekly check-in calls', 'Goal reassessment'],
        alerts: ['High Risk: Below target for 2 weeks']
      },
      {
        clientId: '3',
        clientName: 'Emma Davis',
        riskScore: 58,
        riskLevel: 'medium',
        riskFactors: ['Occasional missed check-ins'],
        lastAssessment: '2025-01-13',
        trend: 'improving',
        recommendations: ['Monitor progress', 'Encourage consistency'],
        alerts: ['Medium Risk: 1 missed check-in this week']
      },
      {
        clientId: '4',
        clientName: 'David Wilson',
        riskScore: 25,
        riskLevel: 'low',
        riskFactors: ['Minor fluctuations'],
        lastAssessment: '2025-01-12',
        trend: 'improving',
        recommendations: ['Continue current approach'],
        alerts: []
      }
    ];

    const mockMetrics: RiskMetrics = {
      totalClients: 24,
      atRiskClients: 8,
      criticalRisk: 2,
      highRisk: 3,
      mediumRisk: 3,
      lowRisk: 16,
      averageRiskScore: 42,
      riskTrend: 'stable',
      topRiskFactors: [
        { factor: 'Missed Check-ins', count: 12 },
        { factor: 'Declining Performance', count: 8 },
        { factor: 'Low Engagement', count: 6 },
        { factor: 'Inconsistent Responses', count: 4 }
      ],
      recentAlerts: [
        { clientId: '1', clientName: 'Sarah Johnson', alert: 'Critical: Performance dropped 30%', timestamp: '2025-01-15 10:30' },
        { clientId: '2', clientName: 'Mike Chen', alert: 'High Risk: Below target for 2 weeks', timestamp: '2025-01-14 14:20' },
        { clientId: '3', clientName: 'Emma Davis', alert: 'Medium Risk: 1 missed check-in this week', timestamp: '2025-01-13 09:15' }
      ]
    };

    setRiskData(mockRiskAnalysis);
    setMetrics(mockMetrics);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '↗️';
      case 'declining': return '↘️';
      case 'stable': return '→';
      default: return '→';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600';
      case 'declining': return 'text-red-600';
      case 'stable': return 'text-yellow-600';
      default: return 'text-gray-800';
    }
  };

  const filteredData = riskData.filter(client => {
    const matchesRiskLevel = selectedRiskLevel === 'all' || client.riskLevel === selectedRiskLevel;
    const matchesSearch = client.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRiskLevel && matchesSearch;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    switch (sortBy) {
      case 'riskScore':
        return b.riskScore - a.riskScore;
      case 'clientName':
        return a.clientName.localeCompare(b.clientName);
      case 'lastAssessment':
        return new Date(b.lastAssessment).getTime() - new Date(a.lastAssessment).getTime();
      default:
        return 0;
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-300 rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Risk Analysis</h1>
            <p className="text-gray-800">Identify and manage at-risk clients with advanced risk scoring</p>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            <Link 
              href="/analytics"
              className="px-4 py-2 text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back to Analytics
            </Link>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Export Report
            </button>
          </div>
        </div>

        {/* Risk Metrics Overview */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Total Clients</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalClients}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-blue-600 text-xl">👥</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">At Risk</p>
                  <p className="text-2xl font-bold text-orange-600">{metrics.atRiskClients}</p>
                  <p className="text-xs text-gray-500">{((metrics.atRiskClients / metrics.totalClients) * 100).toFixed(1)}% of total</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <span className="text-orange-600 text-xl">⚠️</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Critical Risk</p>
                  <p className="text-2xl font-bold text-red-600">{metrics.criticalRisk}</p>
                  <p className="text-xs text-gray-500">Immediate attention needed</p>
                </div>
                <div className="p-2 bg-red-100 rounded-lg">
                  <span className="text-red-600 text-xl">🚨</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Avg Risk Score</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.averageRiskScore}</p>
                  <p className="text-xs text-gray-500">Trend: {metrics.riskTrend}</p>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">
                  <span className="text-gray-800 text-xl">📊</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Risk Analysis Table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h2 className="text-xl font-semibold text-gray-900">Client Risk Assessment</h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Search clients..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={selectedRiskLevel}
                      onChange={(e) => setSelectedRiskLevel(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Risk Levels</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="riskScore">Sort by Risk Score</option>
                      <option value="clientName">Sort by Name</option>
                      <option value="lastAssessment">Sort by Last Assessment</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedData.map((client) => (
                      <tr key={client.clientId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{client.clientName}</div>
                            <div className="text-sm text-gray-500">Last assessed: {client.lastAssessment}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelColor(client.riskLevel)}`}>
                            {client.riskLevel.charAt(0).toUpperCase() + client.riskLevel.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{client.riskScore}</div>
                          <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className={`h-2 rounded-full ${
                                client.riskScore >= 80 ? 'bg-red-600' : 
                                client.riskScore >= 60 ? 'bg-orange-500' : 
                                client.riskScore >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${client.riskScore}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${getTrendColor(client.trend)}`}>
                            {getTrendIcon(client.trend)} {client.trend}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link 
                            href={`/clients/${client.clientId}`}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            View Profile
                          </Link>
                          <button className="text-green-600 hover:text-green-900">
                            Intervene
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sortedData.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-gray-600 text-6xl mb-4">📊</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
                  <p className="text-gray-500">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Risk Factors */}
            {metrics && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Risk Factors</h3>
                <div className="space-y-3">
                  {metrics.topRiskFactors.map((factor, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-800">{factor.factor}</span>
                      <span className="text-sm font-medium text-gray-900">{factor.count} clients</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Alerts */}
            {metrics && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h3>
                <div className="space-y-3">
                  {metrics.recentAlerts.map((alert, index) => (
                    <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900">{alert.clientName}</p>
                          <p className="text-xs text-red-700 mt-1">{alert.alert}</p>
                          <p className="text-xs text-red-600 mt-1">{alert.timestamp}</p>
                        </div>
                        <button className="text-red-600 hover:text-red-800 text-sm">
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-4 text-sm text-blue-600 hover:text-blue-800">
                  View All Alerts →
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full text-left p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                  <div className="flex items-center">
                    <span className="text-blue-600 mr-3">📞</span>
                    <div>
                      <p className="text-sm font-medium text-blue-900">Schedule Intervention Calls</p>
                      <p className="text-xs text-blue-700">Reach out to high-risk clients</p>
                    </div>
                  </div>
                </button>
                <button className="w-full text-left p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-3">📊</span>
                    <div>
                      <p className="text-sm font-medium text-green-900">Generate Risk Report</p>
                      <p className="text-xs text-green-700">Export detailed analysis</p>
                    </div>
                  </div>
                </button>
                <button className="w-full text-left p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                  <div className="flex items-center">
                    <span className="text-purple-600 mr-3">⚙️</span>
                    <div>
                      <p className="text-sm font-medium text-purple-900">Configure Alerts</p>
                      <p className="text-xs text-purple-700">Set up automated notifications</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 