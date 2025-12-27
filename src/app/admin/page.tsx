'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function SetAdminButton() {
  const [isSetting, setIsSetting] = useState(false);
  const [userId, setUserId] = useState('k5rT8EGNUqbWCSf5g56msZoFdX02');
  const [firstName, setFirstName] = useState('Silvana');
  const [lastName, setLastName] = useState('Earl');
  const [email, setEmail] = useState('Silvi@vanahealth.com.au');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSetAdmin = async () => {
    if (!userId.trim()) {
      alert('Please enter a user ID');
      return;
    }

    const confirmMessage = password 
      ? `Set user ${userId} as Admin and Coach?\n\nThis will:\n- Create/update Firebase Auth account\n- Set role to admin (with coach privileges)\n- Create/update user profile\n- Create/update coach record\n- Set Firebase Auth custom claims`
      : `Set user ${userId} as Admin and Coach?\n\nThis will:\n- Set role to admin (with coach privileges)\n- Create/update user profile\n- Create/update coach record\n- Set Firebase Auth custom claims\n\nNote: If user doesn't exist in Firebase Auth, email and password are required.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsSetting(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/set-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId.trim(),
          firstName: firstName.trim() || 'Silvana',
          lastName: lastName.trim() || 'Earl',
          email: email.trim() || undefined,
          password: password.trim() || undefined
        })
      });

      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        const message = data.accountCreated 
          ? `✅ Successfully created account and set user as Admin and Coach!\n\nUser ID: ${data.userId}\nEmail: ${data.email}\nRoles: ${data.roles.join(', ')}\n\nAccount created! User can now log in with the provided email and password.`
          : `✅ Successfully set user as Admin and Coach!\n\nUser ID: ${data.userId}\nRoles: ${data.roles.join(', ')}\n\nUser will need to sign out and sign back in for changes to take effect.`;
        alert(message);
        if (data.accountCreated) {
          setPassword(''); // Clear password after successful creation
        }
      } else {
        alert(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error setting admin role:', error);
      setResult({
        success: false,
        message: 'Failed to set admin role. Please check the console for details.'
      });
      alert('Error setting admin role. Please check the console for details.');
    } finally {
      setIsSetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1">User ID (Firebase UID)</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="k5rT8EGNUqbWCSf5g56msZoFdX02"
            className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1">Email <span className="text-red-500">*</span></label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Silvi@vanahealth.com.au"
            className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm"
          />
          <p className="text-xs text-gray-600 mt-1">Required if creating new account</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1">First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Silvana"
            className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-900 mb-1">Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Earl"
            className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-blue-900 mb-1">Password <span className="text-gray-500">(optional)</span></label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave empty if account exists"
          className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm"
        />
        <p className="text-xs text-gray-600 mt-1">Required only if creating a new Firebase Auth account</p>
      </div>
      <button
        onClick={handleSetAdmin}
        disabled={isSetting || !userId.trim()}
        className={`inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md text-white ${
          isSetting || !userId.trim()
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        }`}
      >
        {isSetting ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Setting...
          </>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Set as Admin & Coach
          </>
        )}
      </button>
      {result && (
        <div className={`p-3 rounded-md ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <p className="text-sm font-medium">{result.message}</p>
        </div>
      )}
    </div>
  );
}

function ClearTestDataButton() {
  const [isClearing, setIsClearing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; totalDeleted?: number } | null>(null);

  const handleClear = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL test/demo data including:\n\n- Questions with demo/test coach IDs\n- Clients with demo/test coach IDs or test email addresses\n- Forms, assignments, and responses for test data\n\nThis action cannot be undone. Continue?')) {
      return;
    }

    if (!window.confirm('Are you absolutely sure? Type "CLEAR" in the next prompt to confirm.')) {
      return;
    }

    const confirmText = window.prompt('Type "CLEAR" to confirm deletion of all test data:');
    if (confirmText !== 'CLEAR') {
      alert('Cancelled. Test data was not deleted.');
      return;
    }

    setIsClearing(true);
    setResult(null);

    try {
      alert('This feature has been removed for production optimization. Data management should be done through proper admin tools.');
      setIsClearing(false);
      return;
      } else {
        alert(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error clearing test data:', error);
      setResult({
        success: false,
        message: 'Failed to clear test data. Please try again.'
      });
      alert('Error clearing test data. Please check the console for details.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClear}
        disabled={isClearing}
        className={`inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md text-white ${
          isClearing
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
        }`}
      >
        {isClearing ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Clearing...
          </>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All Test Data
          </>
        )}
      </button>
      {result && (
        <div className={`mt-4 p-3 rounded-md ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <p className="text-sm font-medium">{result.message}</p>
          {result.totalDeleted !== undefined && (
            <p className="text-xs mt-1">Total records deleted: {result.totalDeleted}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface UserStats {
  totalUsers: number;
  admins: number;
  coaches: number;
  clients: number;
  activeUsers: number;
  inactiveUsers: number;
}

interface SystemStats {
  totalClients: number;
  totalForms: number;
  totalResponses: number;
  totalQuestions: number;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [userStats, setUserStats] = useState<UserStats>({
    totalUsers: 0,
    admins: 0,
    coaches: 0,
    clients: 0,
    activeUsers: 0,
    inactiveUsers: 0
  });
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalClients: 0,
    totalForms: 0,
    totalResponses: 0,
    totalQuestions: 0
  });
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch user statistics
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const users = usersSnapshot.docs.map(doc => doc.data());
        
        const userStatsData: UserStats = {
          totalUsers: users.length,
          admins: users.filter(u => u.role === 'admin').length,
          coaches: users.filter(u => u.role === 'coach').length,
          clients: users.filter(u => u.role === 'client').length,
          activeUsers: users.filter(u => u.isActive).length,
          inactiveUsers: users.filter(u => !u.isActive).length
        };
        setUserStats(userStatsData);

        // Fetch system statistics
        const [clientsSnapshot, formsSnapshot, responsesSnapshot, questionsSnapshot] = await Promise.all([
          getDocs(collection(db, 'clients')),
          getDocs(collection(db, 'forms')),
          getDocs(collection(db, 'form_responses')),
          getDocs(collection(db, 'questions'))
        ]);

        const systemStatsData: SystemStats = {
          totalClients: clientsSnapshot.size,
          totalForms: formsSnapshot.size,
          totalResponses: responsesSnapshot.size,
          totalQuestions: questionsSnapshot.size
        };
        setSystemStats(systemStatsData);
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="px-4 py-6 sm:px-0 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="mt-2 text-gray-800">System-wide analytics and user management</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4 sm:px-0 mb-8">
            {/* User Stats */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                      <dd className="text-lg font-medium text-gray-900">{userStats.totalUsers}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Users</dt>
                      <dd className="text-lg font-medium text-gray-900">{userStats.activeUsers}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Clients</dt>
                      <dd className="text-lg font-medium text-gray-900">{systemStats.totalClients}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Forms</dt>
                      <dd className="text-lg font-medium text-gray-900">{systemStats.totalForms}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Role Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 sm:px-0 mb-8">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">User Roles Breakdown</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Admins</span>
                  <span className="text-sm font-medium text-gray-900">{userStats.admins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Coaches</span>
                  <span className="text-sm font-medium text-gray-900">{userStats.coaches}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Clients</span>
                  <span className="text-sm font-medium text-gray-900">{userStats.clients}</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">System Statistics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Total Questions</span>
                  <span className="text-sm font-medium text-gray-900">{systemStats.totalQuestions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Total Responses</span>
                  <span className="text-sm font-medium text-gray-900">{systemStats.totalResponses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Active Users</span>
                  <span className="text-sm font-medium text-gray-900">{userStats.activeUsers}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-6 px-4 sm:px-0 mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/admin/users"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Manage Users
              </Link>
              <Link
                href="/admin/coaches"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                Manage Coaches
              </Link>
              <Link
                href="/admin/clients"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
              >
                Manage Clients
              </Link>
            </div>
          </div>

          {/* Production Preparation */}
          <div className="bg-red-50 border-2 border-red-200 shadow rounded-lg p-6 px-4 sm:px-0 mb-8">
            <h3 className="text-lg font-medium text-red-900 mb-2">Production Preparation</h3>
            <p className="text-sm text-red-700 mb-4">
              Clear all test/demo data (questions, clients, forms) with test identifiers or demo email addresses.
            </p>
            <ClearTestDataButton />
          </div>

          {/* Admin Management */}
          <div className="bg-blue-50 border-2 border-blue-200 shadow rounded-lg p-6 px-4 sm:px-0">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Admin Management</h3>
            <p className="text-sm text-blue-700 mb-4">
              Set user roles and permissions. Users can have multiple roles (e.g., admin + coach).
            </p>
            <SetAdminButton />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 