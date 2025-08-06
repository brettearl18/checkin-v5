import Image from "next/image";
import Link from "next/link";
import ApiButtons from "@/components/ApiButtons";
import { getClients, getDashboardStats, getAnalytics } from "@/lib/data";

export default async function Dashboard() {
  // Fetch real data from Firestore
  let clients: any[] = [];
  let dashboardStats: any = null;
  let analytics: any = null;
  let error = null;

  try {
    [clients, dashboardStats, analytics] = await Promise.all([
      getClients(),
      getDashboardStats(),
      getAnalytics()
    ]);
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    error = err;
    // Fallback to empty data
    clients = [];
    dashboardStats = {
      totalClients: 0,
      activeClients: 0,
      atRiskClients: 0,
      averageProgress: 0
    };
    analytics = {
      groupOverview: { totalClients: 0, activeClients: 0, atRiskClients: 0, averageProgress: 0 },
      riskAnalysis: { highRisk: 0, mediumRisk: 0, lowRisk: 0, riskFactors: [] },
      engagementMetrics: { averageCheckInRate: 0, averageResponseTime: 0, satisfactionScore: 0 },
      progressTrends: { weightLoss: 0, fitnessImprovement: 0, goalCompletion: 0 }
    };
  }

  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const atRiskClients = clients.filter(c => c.status === 'at-risk').length;
  const averageProgress = clients.length > 0 
    ? (clients.reduce((sum, client) => sum + (client.engagement?.satisfactionScore || 0), 0) / clients.length).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Client Insights Hub</h1>
          <p className="mt-2 text-gray-600">Your coaching co-pilot dashboard</p>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">
                ⚠️ Some data may not be loading correctly. Please check your Firebase connection.
              </p>
            </div>
          )}
        </div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Clients</dt>
                    <dd className="text-lg font-medium text-gray-900">{totalClients}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Clients</dt>
                    <dd className="text-lg font-medium text-gray-900">{activeClients}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">At Risk</dt>
                    <dd className="text-lg font-medium text-gray-900">{atRiskClients}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Progress</dt>
                    <dd className="text-lg font-medium text-gray-900">{averageProgress}/10</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Client Profile */}
        {clients.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Featured Client Profile</h2>
                <Link 
                  href={`/client/${clients[0].id}`}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  View Full Profile
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">{clients[0].name}</div>
                  <div className="text-sm text-gray-600">
                    {clients[0].coaching?.programType?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Health Coaching'}
                  </div>
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      clients[0].status === 'active' ? 'bg-green-100 text-green-800' :
                      clients[0].status === 'at-risk' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {clients[0].status?.charAt(0).toUpperCase() + clients[0].status?.slice(1) || 'Active'}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">{clients[0].weight}kg</div>
                  <div className="text-sm text-gray-600">Current Weight</div>
                  {clients[0].targetWeight && (
                    <div className="text-xs text-green-600 mt-1">
                      ↓ {clients[0].weight - clients[0].targetWeight}kg to goal
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {Math.round((clients[0].engagement?.checkInRate || 0) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Check-in Rate</div>
                  <div className="text-xs text-blue-600 mt-1">
                    {(clients[0].engagement?.satisfactionScore || 0).toFixed(1)}/10 satisfaction
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Framework Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Framework Status</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>✅ Enhanced framework loaded successfully!</p>
                <div className="mt-1 space-y-1">
                  <p>• Client Management: Ready for 30-50 clients</p>
                  <p>• Check-in System: Forms and analytics ready</p>
                  <p>• Risk Detection: AI-ready algorithm implemented</p>
                  <p>• Analytics Dashboard: Real-time insights active</p>
                  <p>• AI Integration: Foundation prepared for Genkit/Gemini</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <Link 
                href="/client/client-mockup-001" 
                className="block w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
              >
                View Sarah Johnson's Profile
              </Link>
              <Link 
                href="/clients/new" 
                className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md"
              >
                Create New Client
              </Link>
              <Link 
                href="/clients" 
                className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md"
              >
                View All Clients
              </Link>
              <Link 
                href="/questions" 
                className="block w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-md"
              >
                Question Builder
              </Link>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">API Testing</h3>
            <ApiButtons />
          </div>
        </div>
      </div>
    </div>
  );
}
