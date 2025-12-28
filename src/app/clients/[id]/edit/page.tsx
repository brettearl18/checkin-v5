'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';
import CoachNavigation from '@/components/CoachNavigation';

interface ClientForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params?.id as string;
  const { userProfile } = useAuth();
  const [formData, setFormData] = useState<ClientForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchClient = async () => {
      if (!clientId) {
        setError('Client ID is required');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/clients/${clientId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.client) {
            setFormData({
              firstName: data.client.firstName || '',
              lastName: data.client.lastName || '',
              email: data.client.email || '',
              phone: data.client.phone || ''
            });
          } else {
            setError('Client not found');
          }
        } else {
          setError('Failed to load client data');
        }
      } catch (error) {
        console.error('Error fetching client:', error);
        setError('An error occurred while loading client data');
      } finally {
        setLoading(false);
      }
    };

    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.firstName.trim()) {
      setError('First name is required');
      setSaving(false);
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required');
      setSaving(false);
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      setSaving(false);
      return;
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Client profile updated successfully!');
        setTimeout(() => {
          router.push(`/clients/${clientId}`);
        }, 1500);
      } else {
        setError(data.error || data.message || 'Failed to update client profile');
      }
    } catch (error) {
      console.error('Error updating client:', error);
      setError('An error occurred while updating the client profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <RoleProtected allowedRoles={['coach', 'admin']}>
        <div className="min-h-screen bg-gray-50 flex">
          <CoachNavigation />
          <div className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading client data...</p>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected allowedRoles={['coach', 'admin']}>
      <div className="min-h-screen bg-gray-50 flex">
        <CoachNavigation />
        <div className="flex-1 p-6">
            <div className="max-w-2xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <Link
                  href={`/clients/${clientId}`}
                  className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Client Profile
                </Link>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Edit Client Profile
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  Update client information
                </p>
              </div>

              {/* Form */}
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
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                      <Link
                        href={`/clients/${clientId}`}
                        className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl font-medium transition-colors"
                      >
                        Cancel
                      </Link>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
