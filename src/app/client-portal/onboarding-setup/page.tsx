'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';

interface OnboardingData {
  beforeImages: {
    front?: string;
    back?: string;
    side?: string;
  };
  bodyWeight?: number;
  measurements: {
    waist?: number;
    hips?: number;
    chest?: number;
    leftThigh?: number;
    rightThigh?: number;
    leftArm?: number;
    rightArm?: number;
    [key: string]: number | undefined;
  };
  completed: boolean;
  completedAt?: string;
}

export default function OnboardingSetupPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    beforeImages: {},
    measurements: {},
    completed: false
  });
  const [activeStep, setActiveStep] = useState<'images' | 'weight' | 'measurements' | 'complete'>('images');
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetchOnboardingData();
  }, [userProfile?.email]);

  const fetchOnboardingData = async () => {
    try {
      if (!userProfile?.email) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}`);
      const result = await response.json();

      if (result.success && result.data.client) {
        const clientId = result.data.client.id;
        const onboardingResponse = await fetch(`/api/client-onboarding/data?clientId=${clientId}`);
        const onboardingResult = await onboardingResponse.json();

        if (onboardingResult.success) {
          setOnboardingData(onboardingResult.data || {
            beforeImages: {},
            measurements: {},
            completed: false
          });
        }
      }
    } catch (error) {
      console.error('Error fetching onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (orientation: 'front' | 'back' | 'side', file: File) => {
    if (!userProfile?.email) return;

    setUploading(orientation);

    try {
      const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}`);
      const result = await response.json();

      if (!result.success || !result.data.client) {
        alert('Could not find client data');
        return;
      }

      const { client } = result.data;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientId', client.id);
      formData.append('coachId', client.coachId || '');
      formData.append('imageType', 'before');
      formData.append('orientation', orientation);
      formData.append('caption', `Before photo - ${orientation} view`);

      const uploadResponse = await fetch('/api/progress-images/upload', {
        method: 'POST',
        body: formData
      });

      const uploadResult = await uploadResponse.json();

      if (uploadResult.success) {
        setOnboardingData(prev => ({
          ...prev,
          beforeImages: {
            ...prev.beforeImages,
            [orientation]: uploadResult.data.imageUrl
          }
        }));
        await saveOnboardingData();
      } else {
        alert(`Failed to upload image: ${uploadResult.message}`);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  const handleWeightChange = (value: string) => {
    const weight = parseFloat(value);
    setOnboardingData(prev => ({
      ...prev,
      bodyWeight: isNaN(weight) ? undefined : weight
    }));
  };

  const handleMeasurementChange = (key: string, value: string) => {
    const measurement = parseFloat(value);
    setOnboardingData(prev => ({
      ...prev,
      measurements: {
        ...prev.measurements,
        [key]: isNaN(measurement) ? undefined : measurement
      }
    }));
  };

  const saveOnboardingData = async () => {
    if (!userProfile?.email) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}`);
      const result = await response.json();

      if (!result.success || !result.data.client) {
        alert('Could not find client data');
        return;
      }

      const clientId = result.data.client.id;
      const saveResponse = await fetch('/api/client-onboarding/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          ...onboardingData
        })
      });

      const saveResult = await saveResponse.json();
      if (!saveResult.success) {
        alert('Failed to save data');
      }
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      alert('Failed to save data. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    const updatedData = {
      ...onboardingData,
      completed: true,
      completedAt: new Date().toISOString()
    };
    setOnboardingData(updatedData);
    await saveOnboardingData();
  };

  const getCompletionPercentage = () => {
    let completed = 0;
    let total = 0;

    // Images (3 total)
    total += 3;
    if (onboardingData.beforeImages.front) completed++;
    if (onboardingData.beforeImages.back) completed++;
    if (onboardingData.beforeImages.side) completed++;

    // Weight (1 total)
    total += 1;
    if (onboardingData.bodyWeight) completed++;

    // Measurements (6 total)
    total += 6;
    if (onboardingData.measurements.waist) completed++;
    if (onboardingData.measurements.hips) completed++;
    if (onboardingData.measurements.chest) completed++;
    if (onboardingData.measurements.neck) completed++;
    if (onboardingData.measurements.thigh) completed++;
    if (onboardingData.measurements.arm) completed++;

    return Math.round((completed / total) * 100);
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
        </div>
      </RoleProtected>
    );
  }

  const completionPercentage = getCompletionPercentage();

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-8 p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Onboarding Setup</h1>
            <p className="text-gray-600 mt-2">Set up your baseline measurements and photos</p>
            
            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm font-medium text-gray-700">{completionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-pink-600 to-rose-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Step Navigation */}
          <div className="mb-8 flex space-x-2">
            <button
              onClick={() => setActiveStep('images')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeStep === 'images'
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Before Photos
            </button>
            <button
              onClick={() => setActiveStep('weight')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeStep === 'weight'
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Body Weight
            </button>
            <button
              onClick={() => setActiveStep('measurements')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeStep === 'measurements'
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Measurements
            </button>
          </div>

          {/* Content */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            {activeStep === 'images' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Before Photos</h2>
                  <p className="text-gray-600">Upload photos from front, back, and side views. These will be used to track your progress over time.</p>
                  <p className="text-sm text-gray-700 mt-2">💡 Tip: Take photos in the same lighting and clothing each time for best comparison.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(['front', 'back', 'side'] as const).map((orientation) => (
                    <div key={orientation} className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 capitalize">
                        {orientation} View
                      </label>
                      <div className="aspect-square border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                        {onboardingData.beforeImages[orientation] ? (
                          <div className="relative w-full h-full">
                            <img
                              src={onboardingData.beforeImages[orientation]}
                              alt={`${orientation} view`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              onClick={() => {
                                setOnboardingData(prev => ({
                                  ...prev,
                                  beforeImages: {
                                    ...prev.beforeImages,
                                    [orientation]: undefined
                                  }
                                }));
                                saveOnboardingData();
                              }}
                              className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center p-4">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleImageUpload(orientation, file);
                                }
                              }}
                              disabled={uploading === orientation}
                            />
                            {uploading === orientation ? (
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
                            ) : (
                              <>
                                <svg className="w-12 h-12 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <span className="text-sm text-gray-700">Click to upload</span>
                              </>
                            )}
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveStep('weight')}
                    className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Next: Body Weight →
                  </button>
                </div>
              </div>
            )}

            {activeStep === 'weight' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Body Weight</h2>
                  <p className="text-gray-600">Record your starting body weight. This will help track your progress over time.</p>
                  <p className="text-sm text-gray-700 mt-2">💡 Tip: Weigh yourself at the same time of day, on the same scale, for consistency.</p>
                </div>

                <div className="max-w-md">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={onboardingData.bodyWeight || ''}
                    onChange={(e) => handleWeightChange(e.target.value)}
                    onBlur={saveOnboardingData}
                    placeholder="Enter your weight"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-lg"
                  />
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setActiveStep('images')}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setActiveStep('measurements')}
                    className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Next: Measurements →
                  </button>
                </div>
              </div>
            )}

            {activeStep === 'measurements' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Body Measurements</h2>
                  <p className="text-gray-600">Record your starting measurements. These help track progress beyond just weight.</p>
                  <p className="text-sm text-gray-700 mt-2">💡 Tip: Measure at the same time of day, in the same location, for consistency.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: 'waist', label: 'Waist (cm)' },
                    { key: 'hips', label: 'Hips (cm)' },
                    { key: 'chest', label: 'Chest (cm)' },
                    { key: 'leftThigh', label: 'Left Thigh (cm)' },
                    { key: 'rightThigh', label: 'Right Thigh (cm)' },
                    { key: 'leftArm', label: 'Left Arm (cm)' },
                    { key: 'rightArm', label: 'Right Arm (cm)' }
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {label}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={onboardingData.measurements[key] || ''}
                        onChange={(e) => handleMeasurementChange(key, e.target.value)}
                        onBlur={saveOnboardingData}
                        placeholder="Enter measurement"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setActiveStep('weight')}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    ← Back
                  </button>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleComplete}
                      disabled={saving}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Complete Setup'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {onboardingData.completed && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h3>
                <p className="text-gray-600 mb-6">You can always come back to update your information.</p>
                <Link
                  href="/client-portal"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Go to Dashboard
                </Link>
              </div>
            )}
          </div>

          {/* Skip Option */}
          <div className="mt-6 text-center">
            <Link
              href="/client-portal"
              className="text-gray-700 hover:text-gray-900 text-sm"
            >
              Skip for now and continue to dashboard →
            </Link>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

