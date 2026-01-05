'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';
import ClientNavigation from '@/components/ClientNavigation';

export default function ClientProfilePage() {
  const { userProfile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    firstName: userProfile?.firstName || '',
    lastName: userProfile?.lastName || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
    age: userProfile?.profile?.age || '',
    gender: userProfile?.profile?.gender || '',
    fitnessLevel: userProfile?.profile?.fitnessLevel || '',
    healthGoals: userProfile?.profile?.healthGoals || [],
    emailNotifications: userProfile?.emailNotifications ?? true // Default to true (opt-out)
  });

  // Load client data when component mounts or userProfile changes
  useEffect(() => {
    const loadClientData = async () => {
      if (!user?.uid) return;
      
      try {
        const response = await fetch(`/api/clients/${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.client) {
            const client = data.client;
            setFormData({
              firstName: client.firstName || '',
              lastName: client.lastName || '',
              email: client.email || '',
              phone: client.phone || '',
              age: client.profile?.age || '',
              gender: client.profile?.gender || '',
              fitnessLevel: client.profile?.fitnessLevel || '',
              healthGoals: client.profile?.healthGoals || [],
              emailNotifications: client.emailNotifications ?? true // Default to true if not set
            });
          }
        }
      } catch (error) {
        console.error('Error loading client data:', error);
      }
    };

    loadClientData();
  }, [user?.uid]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleHealthGoalChange = (goal: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      healthGoals: checked 
        ? [...prev.healthGoals, goal]
        : prev.healthGoals.filter(g => g !== goal)
    }));
  };

  const handleEmailNotificationChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      emailNotifications: checked
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage('');

    try {
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        emailNotifications: formData.emailNotifications,
        profile: {
          age: formData.age ? parseInt(formData.age) : null,
          gender: formData.gender,
          fitnessLevel: formData.fitnessLevel,
          healthGoals: formData.healthGoals
        },
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'clients', user.uid), updateData);
      setMessage('Profile updated successfully!');
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const healthGoalOptions = [
    'Weight Loss',
    'Muscle Gain',
    'Cardiovascular Health',
    'Stress Management',
    'Nutrition Improvement',
    'Sleep Quality',
    'Injury Prevention',
    'Athletic Performance'
  ];

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-8 p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Your Profile</h1>
                <p className="text-gray-600 mt-2 text-lg">Manage your personal information and preferences</p>
              </div>
              <Link
                href="/client-portal"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Profile Form */}
          <div className="bg-white rounded-lg shadow p-8">
            <form onSubmit={handleSubmit}>
              {/* Personal Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Health Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Health Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-2">
                      Age
                    </label>
                    <input
                      type="number"
                      id="age"
                      name="age"
                      value={formData.age}
                      onChange={handleInputChange}
                      min="13"
                      max="120"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                      Gender
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="fitnessLevel" className="block text-sm font-medium text-gray-700 mb-2">
                      Fitness Level
                    </label>
                    <select
                      id="fitnessLevel"
                      name="fitnessLevel"
                      value={formData.fitnessLevel}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select level</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="athlete">Athlete</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Health Goals */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Health Goals</h2>
                <p className="text-sm text-gray-600 mb-4">Select all that apply to your current goals</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {healthGoalOptions.map((goal) => (
                    <label key={goal} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.healthGoals.includes(goal)}
                        onChange={(e) => handleHealthGoalChange(goal, e.target.checked)}
                        className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{goal}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Email Notifications */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Email Notifications</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.emailNotifications}
                      onChange={(e) => handleEmailNotificationChange(e.target.checked)}
                      className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <span className="text-base font-medium text-gray-900">Receive email notifications</span>
                      <p className="text-sm text-gray-600 mt-1">
                        Get notified via email about check-in reminders, window openings, and important updates from your coach.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Message */}
              {message && (
                <div className={`mb-6 p-4 rounded-md ${
                  message.includes('successfully') 
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {message}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Account Information */}
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Account Created</p>
                <p className="font-medium text-gray-900">
                  {userProfile?.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="font-medium text-gray-900">
                  {userProfile?.updatedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Account Status</p>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  {userProfile?.status || 'Active'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Assigned Coach</p>
                <p className="font-medium text-gray-900">
                  {userProfile?.assignedCoach ? 'Coach Assigned' : 'No Coach Assigned'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h2 className="text-lg font-medium text-blue-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/client-portal/progress"
                className="flex items-center p-4 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <span className="text-2xl mr-3">📈</span>
                <div>
                  <h3 className="font-medium text-blue-900">View Progress</h3>
                  <p className="text-sm text-blue-700">See your detailed progress report</p>
                </div>
              </Link>
              
              <Link
                href="/client-portal/history"
                className="flex items-center p-4 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <span className="text-2xl mr-3">📋</span>
                <div>
                  <h3 className="font-medium text-blue-900">Response History</h3>
                  <p className="text-sm text-blue-700">View all your past check-ins</p>
                </div>
              </Link>
              
              <button
                onClick={() => {/* Add logout functionality */}}
                className="flex items-center p-4 bg-white rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-left"
              >
                <span className="text-2xl mr-3">🚪</span>
                <div>
                  <h3 className="font-medium text-red-900">Sign Out</h3>
                  <p className="text-sm text-red-700">Log out of your account</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 
