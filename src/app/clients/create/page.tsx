'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import { scoringProfiles, getDefaultThresholds, type ScoringProfile, type ScoringThresholds } from '@/lib/scoring-utils';

interface ClientForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  goals: string[];
  communicationPreference: 'email' | 'sms' | 'both';
  checkInFrequency: 'daily' | 'weekly' | 'monthly';
  scoringProfile: ScoringProfile;
  thresholds: ScoringThresholds;
}

export default function CreateClientPage() {
  const router = useRouter();
  const { userProfile, logout } = useAuth();
  const [formData, setFormData] = useState<ClientForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    goals: [],
    communicationPreference: 'email',
    checkInFrequency: 'weekly',
    scoringProfile: 'moderate',
    thresholds: getDefaultThresholds('moderate')
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [clientCredentials, setClientCredentials] = useState<{email: string; username: string; password: string} | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      goals: checked 
        ? [...prev.goals, value]
        : prev.goals.filter(goal => goal !== value)
    }));
  };

  const handleScoringProfileChange = (profile: ScoringProfile) => {
    const thresholds = getDefaultThresholds(profile);
    setFormData(prev => ({
      ...prev,
      scoringProfile: profile,
      thresholds: profile === 'custom' ? prev.thresholds : thresholds
    }));
  };

  const handleThresholdChange = (field: 'redMax' | 'orangeMax', value: number) => {
    setFormData(prev => ({
      ...prev,
      scoringProfile: 'custom',
      thresholds: {
        ...prev.thresholds,
        [field]: Math.max(0, Math.min(100, value))
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          coachId: userProfile?.uid
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Save scoring configuration
        const clientId = data.clientId || data.client?.id;
        if (clientId) {
          try {
            await fetch(`/api/clients/${clientId}/scoring`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                scoringProfile: formData.scoringProfile,
                thresholds: formData.thresholds
              }),
            });
          } catch (scoringError) {
            console.error('Error saving scoring config:', scoringError);
            // Don't fail the whole operation if scoring save fails
          }
        }

        // Show credentials modal if credentials were generated
        if (data.credentials) {
          setClientCredentials({
            email: data.credentials.email,
            username: data.credentials.username || data.credentials.email,
            password: data.credentials.password
          });
          setShowCredentialsModal(true);
        } else {
          setSuccess('Client created successfully! Redirecting...');
          setTimeout(() => {
            router.push('/clients');
          }, 2000);
        }
      } else {
        setError(data.message || 'Failed to create client');
      }
    } catch (error) {
      setError('An error occurred while creating the client');
      console.error('Create client error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-[#FAFAFA] flex">
        {/* Modern Sidebar */}
        <div className="w-64 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] border-r border-gray-100">
          {/* Sidebar Header */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-8">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Coach Hub</h1>
                <p className="text-orange-100 text-sm">Add Client</p>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="px-4 py-6">
            <div className="space-y-2">
              {/* Dashboard */}
              <Link
                href="/dashboard"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                  </svg>
                </div>
                <span>Dashboard</span>
              </Link>

              {/* Clients - HIGHLIGHTED */}
              <Link
                href="/clients"
                className="flex items-center space-x-3 px-4 py-3 bg-orange-50 text-orange-700 rounded-2xl font-medium transition-all duration-200 border-l-4 border-orange-500"
              >
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <span>Clients</span>
              </Link>

              {/* Check-ins */}
              <Link
                href="/check-ins"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span>Check-ins</span>
              </Link>

              {/* Responses */}
              <Link
                href="/responses"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span>Responses</span>
              </Link>

              {/* Analytics */}
              <Link
                href="/analytics"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span>Analytics</span>
              </Link>

              {/* Forms */}
              <Link
                href="/forms"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-700 rounded-2xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span>Forms</span>
              </Link>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-gray-200"></div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <h3 className="px-4 text-sm font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</h3>
              
              <Link
                href="/clients/create"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:text-green-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <span>Add Client</span>
              </Link>

              <Link
                href="/forms/create"
                className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:text-purple-700 rounded-xl font-medium transition-all duration-200"
              >
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <span>Create Form</span>
              </Link>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-gray-200"></div>

            {/* User Profile */}
            <div className="px-4">
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {userProfile?.firstName?.charAt(0) || 'C'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {userProfile?.firstName} {userProfile?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">Coach</p>
                </div>
                <button
                  onClick={logout}
                  className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center hover:bg-red-200 transition-colors"
                >
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="max-w-2xl mx-auto">
            {/* Modern Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Add New Client
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Create a new client profile and start their wellness journey
              </p>
            </div>

            {/* Modern Form Card */}
            <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
              <div className="bg-orange-50 px-10 py-8 border-b-2 border-orange-200">
                <h2 className="text-2xl font-bold text-gray-900">Client Information</h2>
              </div>
              
              <div className="p-10">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {error && (
                    <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] px-6 py-4 rounded-2xl">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="bg-[#34C759]/10 border border-[#34C759]/20 text-[#34C759] px-6 py-4 rounded-2xl">
                      {success}
                    </div>
                  )}

                  {/* Basic Information */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                          First Name *
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          required
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-gray-900 placeholder-gray-500 bg-white"
                          placeholder="Enter first name"
                        />
                      </div>

                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          required
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-gray-900 placeholder-gray-500 bg-white"
                          placeholder="Enter last name"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-gray-900 placeholder-gray-500 bg-white"
                          placeholder="Enter email address"
                        />
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
                          className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-gray-900 placeholder-gray-500 bg-white"
                          placeholder="Enter phone number"
                        />
                      </div>
                    </div>

                    {/* Login Credentials */}
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Login Credentials</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Set up login credentials for the client. These will be provided via email or shown in a popup for you to send manually.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                            Username
                          </label>
                          <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-gray-900 placeholder-gray-500 bg-white"
                            placeholder="Enter username (optional - email will be used if blank)"
                          />
                          <p className="mt-1 text-xs text-gray-500">If left blank, email will be used as username</p>
                        </div>

                        <div>
                          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                            Password *
                          </label>
                          <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            minLength={8}
                            value={formData.password}
                            onChange={handleInputChange}
                            className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-gray-900 placeholder-gray-500 bg-white"
                            placeholder="Enter password (min 8 characters, uppercase, lowercase, number)"
                          />
                          <p className="mt-1 text-xs text-gray-500">Minimum 8 characters with uppercase, lowercase, and number</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Wellness Goals */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Wellness Goals</h3>
                    <p className="text-sm text-gray-600 mb-4">Select all that apply</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        'Weight Loss',
                        'Muscle Gain',
                        'Better Sleep',
                        'Stress Management',
                        'Improved Fitness',
                        'Better Nutrition',
                        'Mental Health',
                        'Energy Boost'
                      ].map((goal) => (
                        <label key={goal} className="flex items-center p-4 bg-gray-50 rounded-2xl hover:bg-orange-50 transition-all duration-200 cursor-pointer border border-transparent hover:border-orange-200">
                          <input
                            type="checkbox"
                            value={goal}
                            checked={formData.goals.includes(goal)}
                            onChange={handleGoalChange}
                            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                          />
                          <span className="ml-3 text-sm font-medium text-gray-700">{goal}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Traffic Light Split Configuration */}
                  <div className="space-y-6 border-t border-gray-200 pt-8">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Traffic Light Split</h3>
                      <p className="text-sm text-gray-600 mb-6">
                        Configure how scores are categorized into Red, Orange, and Green zones for this client.
                      </p>
                      
                      {/* Scoring Profile Selection */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Scoring Profile
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(Object.keys(scoringProfiles) as ScoringProfile[]).map((profile) => {
                            const profileData = scoringProfiles[profile];
                            const isSelected = formData.scoringProfile === profile;
                            return (
                              <button
                                key={profile}
                                type="button"
                                onClick={() => handleScoringProfileChange(profile)}
                                className={`p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                                  isSelected
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/50'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-semibold text-gray-900">{profileData.name}</span>
                                  {isSelected && (
                                    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mb-3">{profileData.description}</p>
                                <div className="flex items-center space-x-1.5 text-xs flex-wrap">
                                  <span className="px-2 py-0.5 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20 whitespace-nowrap">
                                    🔴 0-{profileData.thresholds.redMax}%
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 whitespace-nowrap">
                                    🟠 {profileData.thresholds.redMax + 1}-{profileData.thresholds.orangeMax}%
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 whitespace-nowrap">
                                    🟢 {profileData.thresholds.orangeMax + 1}-100%
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom Thresholds (shown when custom is selected) */}
                      {formData.scoringProfile === 'custom' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
                          <h4 className="text-sm font-semibold text-gray-900 mb-4">Custom Thresholds</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Red Zone Maximum (%)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={formData.thresholds.redMax}
                                onChange={(e) => handleThresholdChange('redMax', parseInt(e.target.value) || 0)}
                                className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-gray-900 bg-white"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Scores 0-{formData.thresholds.redMax}% will be Red
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Orange Zone Maximum (%)
                              </label>
                              <input
                                type="number"
                                min={formData.thresholds.redMax + 1}
                                max="99"
                                value={formData.thresholds.orangeMax}
                                onChange={(e) => handleThresholdChange('orangeMax', parseInt(e.target.value) || formData.thresholds.redMax + 1)}
                                className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-gray-900 bg-white"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Scores {formData.thresholds.redMax + 1}-{formData.thresholds.orangeMax}% will be Orange
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 p-4 bg-white rounded-xl border border-orange-200">
                            <p className="text-xs font-medium text-gray-700 mb-2">Current Split:</p>
                            <div className="flex items-center space-x-3 text-xs">
                              <span className="px-3 py-1.5 rounded-full bg-[#FF3B30]/10 text-[#FF3B30] border border-[#FF3B30]/20 font-medium">
                                🔴 Red: 0-{formData.thresholds.redMax}%
                              </span>
                              <span className="px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-medium">
                                🟠 Orange: {formData.thresholds.redMax + 1}-{formData.thresholds.orangeMax}%
                              </span>
                              <span className="px-3 py-1.5 rounded-full bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 font-medium">
                                🟢 Green: {formData.thresholds.orangeMax + 1}-100%
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Communication Preferences */}
                  <div className="space-y-6 border-t border-gray-200 pt-8">
                    <h3 className="text-lg font-semibold text-gray-900">Communication & Frequency</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="communicationPreference" className="block text-sm font-medium text-gray-700 mb-2">
                          Preferred Communication
                        </label>
                        <select
                          id="communicationPreference"
                          name="communicationPreference"
                          value={formData.communicationPreference}
                          onChange={handleInputChange}
                          className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-gray-900 bg-white"
                        >
                          <option value="email">Email</option>
                          <option value="sms">SMS</option>
                          <option value="both">Both</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="checkInFrequency" className="block text-sm font-medium text-gray-700 mb-2">
                          Check-in Frequency
                        </label>
                        <select
                          id="checkInFrequency"
                          name="checkInFrequency"
                          value={formData.checkInFrequency}
                          onChange={handleInputChange}
                          className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-gray-900 bg-white"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4 pt-8 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="px-6 py-3 border border-gray-200 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {loading ? 'Creating...' : 'Create Client'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credentials Modal */}
      {showCredentialsModal && clientCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#34C759]/10 px-8 py-6 border-b-2 border-[#34C759]/20 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Client Account Created Successfully! ✉️</h3>
                  <p className="text-gray-600 mt-1">Welcome email with credentials has been automatically sent to the client.</p>
                  <p className="text-sm text-gray-500 mt-1">Credentials below are for your reference only.</p>
                </div>
                <button
                  onClick={() => {
                    setShowCredentialsModal(false);
                    router.push('/clients');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Email Template */}
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Email Sent to Client (for reference)</h4>
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="space-y-3 text-sm text-gray-700">
                    <p><strong>Subject:</strong> Welcome to Your Wellness Journey - Account Credentials</p>
                    <div className="border-t border-gray-200 pt-3">
                      <p className="mb-2">Dear {formData.firstName},</p>
                      <p className="mb-2">Your account has been created! Here are your login credentials:</p>
                      <div className="bg-gray-50 rounded-lg p-4 my-3 space-y-2">
                        <p><strong>Email/Username:</strong> {clientCredentials.email}</p>
                        <p><strong>Password:</strong> {clientCredentials.password}</p>
                      </div>
                      <p className="mb-2">You can log in at: <a href={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/login`} className="text-orange-600 hover:text-orange-700 underline">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/login</a></p>
                      <p className="mb-2">Please change your password after your first login for security.</p>
                      <p>Best regards,<br />Your Coach</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credentials Display */}
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Client Credentials</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email/Username</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={clientCredentials.email}
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900 font-mono"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(clientCredentials.email);
                          alert('Email copied to clipboard!');
                        }}
                        className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-medium transition-all duration-200 shadow-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={clientCredentials.password}
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900 font-mono"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(clientCredentials.password);
                          alert('Password copied to clipboard!');
                        }}
                        className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-medium transition-all duration-200 shadow-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Login URL</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/login`}
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900 font-mono text-sm"
                      />
                      <button
                        onClick={() => {
                          const loginUrl = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/login`;
                          navigator.clipboard.writeText(loginUrl);
                          alert('Login URL copied to clipboard!');
                        }}
                        className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-medium transition-all duration-200 shadow-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                      const emailText = `Subject: Welcome to Your Wellness Journey - Account Credentials

Dear ${formData.firstName},

Your account has been created! Here are your login credentials:

Email/Username: ${clientCredentials.email}
Password: ${clientCredentials.password}

You can log in at: ${baseUrl}/login

Please change your password after your first login for security.

Best regards,
Your Coach`;
                      navigator.clipboard.writeText(emailText);
                      alert('Full email text copied to clipboard!');
                    }}
                    className="w-full px-4 py-3 bg-[#34C759] hover:bg-[#30B855] text-white rounded-2xl font-medium transition-all duration-200 shadow-sm"
                  >
                    📋 Copy Full Email Text
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCredentialsModal(false);
                    router.push('/clients');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-medium transition-all duration-200"
                >
                  Done
                </button>
                <button
                  onClick={() => {
                    setShowCredentialsModal(false);
                    // Reset form
                    setFormData({
                      firstName: '',
                      lastName: '',
                      email: '',
                      phone: '',
                      username: '',
                      password: '',
                      goals: [],
                      communicationPreference: 'email',
                      checkInFrequency: 'weekly',
                      scoringProfile: 'lifestyle',
                      thresholds: getDefaultThresholds('lifestyle')
                    });
                    setClientCredentials(null);
                  }}
                  className="flex-1 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-medium transition-all duration-200 shadow-sm"
                >
                  Add Another Client
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </RoleProtected>
  );
} 