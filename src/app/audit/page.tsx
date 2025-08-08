'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import CoachNavigation from '@/components/CoachNavigation';

interface AuditResult {
  timestamp: string;
  firebaseConnection: {
    status: 'success' | 'error';
    projectId?: string;
    error?: string;
  };
  collections: {
    name: string;
    documentCount: number;
    sampleData: any;
    status: 'success' | 'error';
    error?: string;
  }[];
  dataFlows: {
    name: string;
    status: 'success' | 'error';
    description: string;
    error?: string;
  }[];
  analyticsProcessing: {
    name: string;
    status: 'success' | 'error';
    description: string;
    error?: string;
  }[];
  recommendations: string[];
}

export default function AuditPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [auditData, setAuditData] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditData();
  }, []);

  const fetchAuditData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/audit');
      if (response.ok) {
        const data = await response.json();
        setAuditData(data.audit);
      } else {
        setError('Failed to fetch audit data');
      }
    } catch (error) {
      setError('Error fetching audit data');
    } finally {
      setIsLoading(false);
    }
  };

  const generateSampleData = async () => {
    try {
      const response = await fetch('/api/sample-data-generator', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        alert(`Sample data generated: ${data.added.formResponses} responses, ${data.added.scoringConfigs} scoring configs`);
        fetchAuditData(); // Refresh audit data
      } else {
        alert('Failed to generate sample data');
      }
    } catch (error) {
      alert('Error generating sample data');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="h-96 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !auditData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-red-400 text-6xl mb-4">❌</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Audit Failed</h3>
            <p className="text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalCollections = auditData.collections.length;
  const successfulCollections = auditData.collections.filter(c => c.status === 'success').length;
  const totalDocuments = auditData.collections.reduce((sum, c) => sum + c.documentCount, 0);
  const emptyCollections = auditData.collections.filter(c => c.documentCount === 0).length;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Navigation Sidebar */}
      <CoachNavigation />
      
      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">🔍 Project Audit Report</h1>
              <p className="text-gray-800">Comprehensive analysis of Firebase connections, data flows, and analytics processing</p>
              <p className="text-sm text-gray-500 mt-2">Last updated: {new Date(auditData.timestamp).toLocaleString()}</p>
            </div>
            <div className="flex gap-3 mt-4 sm:mt-0">
              <Link 
                href="/analytics"
                className="px-4 py-2 text-gray-800 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Back to Analytics
              </Link>
              <button 
                onClick={generateSampleData}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Generate Sample Data
              </button>
              <button 
                onClick={fetchAuditData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh Audit
              </button>
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Firebase Status</p>
                  <p className={`text-2xl font-bold ${auditData.firebaseConnection.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {auditData.firebaseConnection.status === 'success' ? 'Connected' : 'Error'}
                  </p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-blue-600 text-xl">🔥</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Collections</p>
                  <p className="text-2xl font-bold text-gray-900">{successfulCollections}/{totalCollections}</p>
                  <p className="text-xs text-gray-500">Working</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-green-600 text-xl">📁</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Total Documents</p>
                  <p className="text-2xl font-bold text-gray-900">{totalDocuments}</p>
                  <p className="text-xs text-gray-500">Across all collections</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <span className="text-purple-600 text-xl">📄</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Empty Collections</p>
                  <p className="text-2xl font-bold text-orange-600">{emptyCollections}</p>
                  <p className="text-xs text-gray-500">Need sample data</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <span className="text-orange-600 text-xl">⚠️</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Collections Analysis */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">📁 Collections Analysis</h2>
                <p className="text-gray-800 text-sm">Firestore collections and their current state</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {auditData.collections.map((collection) => (
                    <div key={collection.name} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{collection.name}</h3>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          collection.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {collection.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-800">
                        <p>Documents: {collection.documentCount}</p>
                        {collection.error && (
                          <p className="text-red-600 mt-1">Error: {collection.error}</p>
                        )}
                        {collection.sampleData && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                              View Sample Data
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(collection.sampleData, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Data Flows */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">🔄 Data Flows</h2>
                <p className="text-gray-800 text-sm">How data moves through the system</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {auditData.dataFlows.map((flow) => (
                    <div key={flow.name} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{flow.name}</h3>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          flow.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {flow.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{flow.description}</p>
                      {flow.error && (
                        <p className="text-red-600 text-sm mt-1">Error: {flow.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Analytics Processing */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">📊 Analytics Processing</h2>
                <p className="text-gray-800 text-sm">How analytics data is calculated and processed</p>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {auditData.analyticsProcessing.map((analytics) => (
                    <div key={analytics.name} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{analytics.name}</h3>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          analytics.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {analytics.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800">{analytics.description}</p>
                      {analytics.error && (
                        <p className="text-red-600 text-sm mt-1">Error: {analytics.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">💡 Recommendations</h2>
                <p className="text-gray-800 text-sm">Actions to improve system performance and data quality</p>
              </div>
              <div className="p-6">
                {auditData.recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {auditData.recommendations.map((recommendation, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <span className="text-yellow-600 text-lg">💡</span>
                        <p className="text-sm text-gray-900">{recommendation}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-green-400 text-4xl mb-2">✅</div>
                    <p className="text-gray-800">No recommendations - system is running optimally!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                onClick={generateSampleData}
                className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <span className="text-green-600 mr-3">📊</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-green-900">Generate Sample Data</p>
                  <p className="text-xs text-green-700">Populate empty collections</p>
                </div>
              </button>
              
              <Link 
                href="/analytics"
                className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <span className="text-blue-600 mr-3">📈</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-blue-900">View Analytics</p>
                  <p className="text-xs text-blue-700">Check processed data</p>
                </div>
              </Link>
              
              <Link 
                href="/analytics/risk"
                className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                <span className="text-red-600 mr-3">⚠️</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-red-900">Risk Analysis</p>
                  <p className="text-xs text-red-700">View client risk scores</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 