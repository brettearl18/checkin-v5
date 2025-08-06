'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ClientFormData {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  
  // Contact & Address
  address: string;
  city: string;
  state: string;
  zipCode: string;
  emergencyContact: string;
  emergencyPhone: string;
  
  // Health Information
  height: string;
  weight: string;
  primaryGoal: string;
  secondaryGoals: string[];
  medicalConditions: string;
  medications: string;
  allergies: string;
  injuries: string;
  
  // Lifestyle & Preferences
  activityLevel: string;
  sleepHours: string;
  stressLevel: string;
  dietaryRestrictions: string;
  preferredContactMethod: string;
  timeZone: string;
  
  // Coaching Preferences
  coachingStyle: string;
  sessionFrequency: string;
  sessionDuration: string;
  preferredTime: string;
  notes: string;
}

export default function AddNewClient() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ClientFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    emergencyContact: '',
    emergencyPhone: '',
    height: '',
    weight: '',
    primaryGoal: '',
    secondaryGoals: [],
    medicalConditions: '',
    medications: '',
    allergies: '',
    injuries: '',
    activityLevel: '',
    sleepHours: '',
    stressLevel: '',
    dietaryRestrictions: '',
    preferredContactMethod: '',
    timeZone: '',
    coachingStyle: '',
    sessionFrequency: '',
    sessionDuration: '',
    preferredTime: '',
    notes: ''
  });

  const goalOptions = [
    'Weight Loss',
    'Muscle Gain',
    'Improve Fitness',
    'Better Nutrition',
    'Stress Management',
    'Sleep Improvement',
    'Injury Recovery',
    'General Wellness',
    'Sports Performance',
    'Mental Health'
  ];

  const handleInputChange = (field: keyof ClientFormData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGoalToggle = (goal: string) => {
    setFormData(prev => ({
      ...prev,
      secondaryGoals: prev.secondaryGoals.includes(goal)
        ? prev.secondaryGoals.filter(g => g !== goal)
        : [...prev.secondaryGoals, goal]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Send the data to our API
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to clients list with success message
        router.push('/clients?success=true&clientId=' + result.clientId);
      } else {
        console.error('Error creating client:', result.error);
        alert('Failed to create client: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Failed to create client. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">➕ Add New Client</h1>
              <p className="mt-2 text-gray-600">Create a comprehensive client profile for personalized coaching</p>
            </div>
            <Link
              href="/clients"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Back to Clients
            </Link>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">👤 Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact & Address */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📍 Contact & Address</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ZIP Code</label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => handleInputChange('zipCode', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Emergency Contact</label>
                <input
                  type="text"
                  value={formData.emergencyContact}
                  onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Emergency Phone</label>
                <input
                  type="tel"
                  value={formData.emergencyPhone}
                  onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Health Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🏥 Health Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) => handleInputChange('height', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Primary Goal *</label>
                <select
                  required
                  value={formData.primaryGoal}
                  onChange={(e) => handleInputChange('primaryGoal', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select primary goal</option>
                  {goalOptions.map(goal => (
                    <option key={goal} value={goal}>{goal}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Secondary Goals</label>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                  {goalOptions.map(goal => (
                    <label key={goal} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.secondaryGoals.includes(goal)}
                        onChange={() => handleGoalToggle(goal)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{goal}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Medical Conditions</label>
                <textarea
                  value={formData.medicalConditions}
                  onChange={(e) => handleInputChange('medicalConditions', e.target.value)}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="List any medical conditions, injuries, or health concerns..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Current Medications</label>
                <textarea
                  value={formData.medications}
                  onChange={(e) => handleInputChange('medications', e.target.value)}
                  rows={2}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="List current medications and dosages..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Allergies</label>
                <input
                  type="text"
                  value={formData.allergies}
                  onChange={(e) => handleInputChange('allergies', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Food, medication, environmental..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Previous Injuries</label>
                <input
                  type="text"
                  value={formData.injuries}
                  onChange={(e) => handleInputChange('injuries', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="List any previous injuries..."
                />
              </div>
            </div>
          </div>

          {/* Lifestyle & Preferences */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">💪 Lifestyle & Preferences</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Activity Level</label>
                <select
                  value={formData.activityLevel}
                  onChange={(e) => handleInputChange('activityLevel', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select activity level</option>
                  <option value="sedentary">Sedentary (little to no exercise)</option>
                  <option value="lightly-active">Lightly Active (light exercise 1-3 days/week)</option>
                  <option value="moderately-active">Moderately Active (moderate exercise 3-5 days/week)</option>
                  <option value="very-active">Very Active (hard exercise 6-7 days/week)</option>
                  <option value="extremely-active">Extremely Active (very hard exercise, physical job)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sleep Hours (per night)</label>
                <select
                  value={formData.sleepHours}
                  onChange={(e) => handleInputChange('sleepHours', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select sleep hours</option>
                  <option value="less-than-6">Less than 6 hours</option>
                  <option value="6-7">6-7 hours</option>
                  <option value="7-8">7-8 hours</option>
                  <option value="8-9">8-9 hours</option>
                  <option value="more-than-9">More than 9 hours</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Stress Level</label>
                <select
                  value={formData.stressLevel}
                  onChange={(e) => handleInputChange('stressLevel', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select stress level</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="very-high">Very High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Dietary Restrictions</label>
                <input
                  type="text"
                  value={formData.dietaryRestrictions}
                  onChange={(e) => handleInputChange('dietaryRestrictions', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Vegetarian, vegan, gluten-free, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Preferred Contact Method</label>
                <select
                  value={formData.preferredContactMethod}
                  onChange={(e) => handleInputChange('preferredContactMethod', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select preferred method</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="text">Text Message</option>
                  <option value="video-call">Video Call</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Time Zone</label>
                <select
                  value={formData.timeZone}
                  onChange={(e) => handleInputChange('timeZone', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select time zone</option>
                  <option value="EST">Eastern Time (EST/EDT)</option>
                  <option value="CST">Central Time (CST/CDT)</option>
                  <option value="MST">Mountain Time (MST/MDT)</option>
                  <option value="PST">Pacific Time (PST/PDT)</option>
                  <option value="AKST">Alaska Time (AKST/AKDT)</option>
                  <option value="HST">Hawaii Time (HST/HDT)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Coaching Preferences */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🎯 Coaching Preferences</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Coaching Style</label>
                <select
                  value={formData.coachingStyle}
                  onChange={(e) => handleInputChange('coachingStyle', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select coaching style</option>
                  <option value="supportive">Supportive & Encouraging</option>
                  <option value="challenging">Challenging & Motivational</option>
                  <option value="educational">Educational & Informative</option>
                  <option value="accountability">Accountability Focused</option>
                  <option value="flexible">Flexible & Adaptive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Session Frequency</label>
                <select
                  value={formData.sessionFrequency}
                  onChange={(e) => handleInputChange('sessionFrequency', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select frequency</option>
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="as-needed">As needed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Session Duration</label>
                <select
                  value={formData.sessionDuration}
                  onChange={(e) => handleInputChange('sessionDuration', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select duration</option>
                  <option value="30-min">30 minutes</option>
                  <option value="45-min">45 minutes</option>
                  <option value="60-min">60 minutes</option>
                  <option value="90-min">90 minutes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Preferred Time</label>
                <select
                  value={formData.preferredTime}
                  onChange={(e) => handleInputChange('preferredTime', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select preferred time</option>
                  <option value="morning">Morning (6 AM - 12 PM)</option>
                  <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                  <option value="evening">Evening (5 PM - 9 PM)</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Additional Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={4}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Any additional information, preferences, or special considerations..."
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-4">
            <Link
              href="/clients"
              className="px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating Client...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 