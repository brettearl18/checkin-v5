'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';

interface MeasurementEntry {
  id: string;
  date: string;
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
  createdAt: string;
  isBaseline?: boolean;
  source?: string;
}

interface BeforeImages {
  front?: string;
  back?: string;
  side?: string;
}

export default function MeasurementsPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isSavingRef = useRef(false); // Ref to prevent duplicate submissions
  const [clientId, setClientId] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [measurementHistory, setMeasurementHistory] = useState<MeasurementEntry[]>([]);
  const [beforeImages, setBeforeImages] = useState<BeforeImages>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MeasurementEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  
  // Baseline setup state
  const [isBaselineSetup, setIsBaselineSetup] = useState(false);
  const [baselineStep, setBaselineStep] = useState<'images' | 'weight' | 'measurements' | 'complete'>('images');
  
  // Form state
  const [bodyWeight, setBodyWeight] = useState('');
  const [measurements, setMeasurements] = useState({
    waist: '',
    hips: '',
    chest: '',
    leftThigh: '',
    rightThigh: '',
    leftArm: '',
    rightArm: ''
  });

  // Baseline form state (for onboarding flow)
  const [baselineWeight, setBaselineWeight] = useState('');
  const [baselineMeasurements, setBaselineMeasurements] = useState({
    waist: '',
    hips: '',
    chest: '',
    leftThigh: '',
    rightThigh: '',
    leftArm: '',
    rightArm: ''
  });

  useEffect(() => {
    fetchClientData();
  }, [userProfile?.email]);

  useEffect(() => {
    if (clientId) {
      checkBaselineStatus();
      fetchMeasurementHistory();
      fetchBeforeImages();
    }
  }, [clientId]);

  const fetchClientData = async () => {
    try {
      if (!userProfile?.email) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}`);
      const result = await response.json();

      if (result.success && result.data.client) {
        setClientId(result.data.client.id);
        setCoachId(result.data.client.coachId || null);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBaselineStatus = async () => {
    if (!clientId) return;

    try {
      // Check for baseline measurement entry
      const measurementsResponse = await fetch(`/api/client-measurements?clientId=${clientId}`);
      const measurementsData = await measurementsResponse.json();
      
      const hasBaselineMeasurement = measurementsData.success && measurementsData.data?.some((m: any) => m.isBaseline);
      
      // Check for before photos
      const imagesResponse = await fetch(`/api/progress-images?clientId=${clientId}`);
      const imagesData = await imagesResponse.json();
      
      const hasBeforePhotos = imagesData.success && imagesData.data?.some((img: any) => img.imageType === 'before');
      
      // If no baseline measurement OR no before photos, show onboarding flow
      if (!hasBaselineMeasurement || !hasBeforePhotos) {
        setIsBaselineSetup(true);
        // Pre-populate baseline form with existing data if any
        if (measurementsData.success && measurementsData.data?.length > 0) {
          const existing = measurementsData.data.find((m: any) => m.isBaseline) || measurementsData.data[0];
          if (existing.bodyWeight) setBaselineWeight(existing.bodyWeight.toString());
          if (existing.measurements) {
            setBaselineMeasurements({
              waist: existing.measurements.waist?.toString() || '',
              hips: existing.measurements.hips?.toString() || '',
              chest: existing.measurements.chest?.toString() || '',
              leftThigh: existing.measurements.leftThigh?.toString() || '',
              rightThigh: existing.measurements.rightThigh?.toString() || '',
              leftArm: existing.measurements.leftArm?.toString() || '',
              rightArm: existing.measurements.rightArm?.toString() || ''
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking baseline status:', error);
    }
  };

  const fetchBeforeImages = async () => {
    if (!clientId) return;

    try {
      const response = await fetch(`/api/progress-images?clientId=${clientId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const beforeImgs: BeforeImages = {};
        data.data.forEach((img: any) => {
          if (img.imageType === 'before' && img.orientation) {
            beforeImgs[img.orientation as 'front' | 'back' | 'side'] = img.imageUrl;
          }
        });
        setBeforeImages(beforeImgs);
      }
    } catch (error) {
      console.error('Error fetching before images:', error);
    }
  };

  const fetchMeasurementHistory = async () => {
    if (!clientId) return;

    try {
      const response = await fetch(`/api/client-measurements?clientId=${clientId}`);
      const data = await response.json();
      if (data.success) {
        setMeasurementHistory(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching measurement history:', error);
    }
  };

  const handleImageUpload = async (orientation: 'front' | 'back' | 'side', file: File) => {
    if (!clientId || !coachId) {
      alert('Client or coach information not available');
      return;
    }

    setUploading(orientation);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientId', clientId);
      formData.append('coachId', coachId);
      formData.append('imageType', 'before');
      formData.append('orientation', orientation);
      formData.append('caption', `Before photo - ${orientation} view`);

      const uploadResponse = await fetch('/api/progress-images/upload', {
        method: 'POST',
        body: formData
      });

      const uploadResult = await uploadResponse.json();

      if (uploadResult.success) {
        setBeforeImages(prev => ({
          ...prev,
          [orientation]: uploadResult.data.imageUrl
        }));
        // Refresh baseline status after upload
        await checkBaselineStatus();
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

  const handleBaselineSave = async (): Promise<boolean> => {
    if (!clientId) return false;
    
    // Prevent double submission using ref (more reliable than state)
    if (isSavingRef.current) {
      console.log('Already saving baseline, ignoring duplicate call');
      return false;
    }
    
    // Build measurement data - only include fields that have values
    const measurementData: any = {
      clientId,
      date: new Date().toISOString(),
      isBaseline: true
    };

    // Add bodyWeight only if it's valid
    if (baselineWeight && baselineWeight.trim() !== '') {
      const weight = parseFloat(baselineWeight);
      if (!isNaN(weight) && weight > 0) {
        measurementData.bodyWeight = weight;
      }
    }

    // Build measurements object - only include non-empty values
    const validMeasurements: any = {};
    Object.entries(baselineMeasurements).forEach(([key, value]) => {
      if (value && value.trim() !== '') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0) {
          validMeasurements[key] = numValue;
        }
      }
    });

    // Only add measurements object if it has at least one value
    if (Object.keys(validMeasurements).length > 0) {
      measurementData.measurements = validMeasurements;
    }

    // Validate: must have at least bodyWeight OR at least one measurement
    const hasBodyWeight = measurementData.bodyWeight !== undefined && !isNaN(measurementData.bodyWeight);
    const hasMeasurements = measurementData.measurements && Object.keys(measurementData.measurements).length > 0;
    
    if (!hasBodyWeight && !hasMeasurements) {
      // No data to save yet - this is fine, just return true without saving
      console.warn('handleBaselineSave: No valid data to save', {
        baselineWeight,
        baselineMeasurements,
        measurementData
      });
      return true;
    }
    
    isSavingRef.current = true;
    setSaving(true);
    try {
      // Always use POST - the API will handle updating existing baseline automatically
      // This prevents race conditions where the client-side state might be stale
      const response = await fetch('/api/client-measurements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(measurementData)
      });
      
      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // Response is not JSON, use status text
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to save baseline');
      }

      // Refresh data
      await fetchMeasurementHistory();
      await checkBaselineStatus();
      
      // Move to next step or complete
      if (baselineStep === 'images') {
        setBaselineStep('weight');
        return true;
      } else if (baselineStep === 'weight') {
        setBaselineStep('measurements');
        return true;
      } else {
        // On measurements step - just save, don't auto-complete
        // Completion should only happen when user clicks "Complete Setup" button
        return true;
      }
    } catch (error: any) {
      // Log full error details for debugging
      console.error('Error saving baseline:', {
        error,
        message: error?.message,
        stack: error?.stack,
        measurementData: {
          hasBodyWeight: measurementData.bodyWeight !== undefined,
          hasMeasurements: Object.keys(measurementData.measurements).length > 0,
          isBaseline: measurementData.isBaseline,
          clientId: measurementData.clientId
        }
      });
      
      // Only show alert if it's not a "no data" error
      const errorMsg = error?.message || String(error);
      if (!errorMsg.includes('must be provided') && !errorMsg.includes('No data to save')) {
        // Show more descriptive error message
        const userMessage = errorMsg.includes('HTTP') 
          ? `Failed to save baseline: ${errorMsg}` 
          : 'Failed to save baseline. Please try again.';
        alert(userMessage);
      }
      return false;
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    if (!clientId) return;
    
    // Prevent double submission using ref (more reliable than state)
    if (isSavingRef.current) {
      console.log('Already saving, ignoring duplicate submit');
      return;
    }
    
    isSavingRef.current = true;
    setSaving(true);
    try {
      const measurementData: any = {
        measurements: {}
      };

      if (editingEntry) {
        // Update existing entry
        measurementData.id = editingEntry.id;
        if (bodyWeight) {
          measurementData.bodyWeight = parseFloat(bodyWeight);
        } else {
          measurementData.bodyWeight = editingEntry.bodyWeight;
        }

        Object.entries(measurements).forEach(([key, value]) => {
          if (value) {
            measurementData.measurements[key] = parseFloat(value);
          } else if (editingEntry.measurements[key as keyof typeof editingEntry.measurements]) {
            measurementData.measurements[key] = editingEntry.measurements[key as keyof typeof editingEntry.measurements];
          }
        });

        const response = await fetch('/api/client-measurements', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(measurementData)
        });

        const data = await response.json();
        if (data.success) {
          setEditingEntry(null);
          resetForm();
          await fetchMeasurementHistory();
          alert('Measurements updated successfully!');
        } else {
          alert(`Failed to update: ${data.message}`);
        }
      } else {
        // Create new entry
        measurementData.clientId = clientId;
        measurementData.date = new Date().toISOString();

        if (bodyWeight) {
          measurementData.bodyWeight = parseFloat(bodyWeight);
        }

        Object.entries(measurements).forEach(([key, value]) => {
          if (value) {
            measurementData.measurements[key] = parseFloat(value);
          }
        });

        const response = await fetch('/api/client-measurements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(measurementData)
        });

        const data = await response.json();
        if (data.success) {
          resetForm();
          setShowAddForm(false);
          await fetchMeasurementHistory();
          alert('Measurements saved successfully!');
        } else {
          alert(`Failed to save: ${data.message}`);
        }
      }
    } catch (error) {
      console.error('Error saving measurements:', error);
      alert('Failed to save measurements. Please try again.');
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const resetForm = () => {
    setBodyWeight('');
    setMeasurements({
      waist: '',
      hips: '',
      chest: '',
      leftThigh: '',
      rightThigh: '',
      leftArm: '',
      rightArm: ''
    });
  };

  const handleEdit = (entry: MeasurementEntry) => {
    setEditingEntry(entry);
    setBodyWeight(entry.bodyWeight?.toString() || '');
    setMeasurements({
      waist: entry.measurements.waist?.toString() || '',
      hips: entry.measurements.hips?.toString() || '',
      chest: entry.measurements.chest?.toString() || '',
      leftThigh: entry.measurements.leftThigh?.toString() || '',
      rightThigh: entry.measurements.rightThigh?.toString() || '',
      leftArm: entry.measurements.leftArm?.toString() || '',
      rightArm: entry.measurements.rightArm?.toString() || ''
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this measurement entry? This action cannot be undone.')) {
      return;
    }

    setDeletingEntry(id);
    try {
      const response = await fetch(`/api/client-measurements?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        await fetchMeasurementHistory();
        alert('Measurement deleted successfully!');
      } else {
        alert(`Failed to delete: ${data.message}`);
      }
    } catch (error) {
      console.error('Error deleting measurement:', error);
      alert('Failed to delete measurement. Please try again.');
    } finally {
      setDeletingEntry(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    resetForm();
    setShowAddForm(false);
  };

  const getLatestMeasurement = (key: string) => {
    const latest = measurementHistory[0];
    if (!latest) return null;
    if (key === 'bodyWeight') {
      return latest.bodyWeight || null;
    }
    return latest.measurements[key] || null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getBaselineCompletionPercentage = () => {
    let completed = 0;
    let total = 3; // 3 images
    
    if (beforeImages.front) completed++;
    if (beforeImages.back) completed++;
    if (beforeImages.side) completed++;
    
    if (baselineStep === 'weight' || baselineStep === 'measurements') {
      total += 1; // weight
      if (baselineWeight) completed++;
    }
    
    if (baselineStep === 'measurements') {
      total += 7; // 7 measurements
      Object.values(baselineMeasurements).forEach(val => {
        if (val) completed++;
      });
    }
    
    return Math.round((completed / total) * 100);
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderBottomColor: '#daa450' }}></div>
        </div>
      </RoleProtected>
    );
  }

  // BASELINE SETUP MODE (Onboarding Flow)
  if (isBaselineSetup) {
    const completionPercentage = getBaselineCompletionPercentage();
    
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-white flex">
          <ClientNavigation />
          
          <div className="flex-1 ml-4 lg:ml-8 p-5 lg:p-6">
            {/* Header */}
            <div className="mb-6 lg:mb-8">
              <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2 mb-4 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Set Your Baseline</h1>
                <p className="text-gray-600 text-sm lg:text-base">Record your starting measurements and photos to track progress</p>
                
                {/* Progress Bar */}
                <div className="mt-4 lg:mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs lg:text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-xs lg:text-sm font-medium text-gray-700">{completionPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 lg:h-3">
                    <div 
                      className="h-2.5 lg:h-3 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${completionPercentage}%`,
                        backgroundColor: '#daa450'
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step Navigation */}
            <div className="mb-6 lg:mb-8 flex flex-wrap gap-2 lg:gap-2">
              <button
                onClick={() => setBaselineStep('images')}
                className={`px-5 py-3 lg:px-4 lg:py-2 rounded-xl lg:rounded-lg font-semibold whitespace-nowrap transition-all duration-200 min-h-[48px] lg:min-h-[44px] flex items-center justify-center text-sm lg:text-base ${
                  baselineStep === 'images'
                    ? 'text-white shadow-md'
                    : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
                }`}
                style={baselineStep === 'images' ? { backgroundColor: '#daa450' } : {}}
              >
                Before Photos
              </button>
              <button
                onClick={() => setBaselineStep('weight')}
                className={`px-5 py-3 lg:px-4 lg:py-2 rounded-xl lg:rounded-lg font-semibold whitespace-nowrap transition-all duration-200 min-h-[48px] lg:min-h-[44px] flex items-center justify-center text-sm lg:text-base ${
                  baselineStep === 'weight'
                    ? 'text-white shadow-md'
                    : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
                }`}
                style={baselineStep === 'weight' ? { backgroundColor: '#daa450' } : {}}
              >
                Body Weight
              </button>
              <button
                onClick={() => setBaselineStep('measurements')}
                className={`px-5 py-3 lg:px-4 lg:py-2 rounded-xl lg:rounded-lg font-semibold whitespace-nowrap transition-all duration-200 min-h-[48px] lg:min-h-[44px] flex items-center justify-center text-sm lg:text-base ${
                  baselineStep === 'measurements'
                    ? 'text-white shadow-md'
                    : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
                }`}
                style={baselineStep === 'measurements' ? { backgroundColor: '#daa450' } : {}}
              >
                Measurements
              </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-5 lg:p-8">
              {baselineStep === 'images' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">Before Photos</h2>
                    <p className="text-gray-600 text-sm lg:text-base">Upload photos from front, back, and side views. These will be used to track your progress over time.</p>
                    <p className="text-sm text-gray-700 mt-2 flex items-center gap-2">
                      <span>💡</span>
                      <span>Tip: Take photos in the same lighting and clothing each time for best comparison.</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                    {(['front', 'back', 'side'] as const).map((orientation) => (
                      <div key={orientation} className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 capitalize">
                          {orientation} View
                        </label>
                        <div className="aspect-square border-2 border-dashed border-gray-300 rounded-xl lg:rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center">
                          {beforeImages[orientation] ? (
                            <div className="relative w-full h-full">
                              <img
                                src={beforeImages[orientation]}
                                alt={`${orientation} view`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                onClick={async () => {
                                  setBeforeImages(prev => {
                                    const updated = { ...prev };
                                    delete updated[orientation];
                                    return updated;
                                  });
                                  await checkBaselineStatus();
                                }}
                                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
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
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: '#daa450' }}></div>
                              ) : (
                                <>
                                  <svg className="w-12 h-12 lg:w-10 lg:h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                  </svg>
                                  <span className="text-xs lg:text-sm text-gray-700 text-center">Click to upload</span>
                                </>
                              )}
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => {
                        // Just navigate - NO saving until Complete Setup button is clicked
                        setBaselineStep('weight');
                      }}
                      className="px-6 py-3 lg:py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                      style={{ backgroundColor: '#daa450' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                    >
                      Next: Body Weight →
                    </button>
                  </div>
                </div>
              )}

              {baselineStep === 'weight' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">Body Weight</h2>
                    <p className="text-gray-600 text-sm lg:text-base">Record your starting body weight. This will help track your progress over time.</p>
                    <p className="text-sm text-gray-700 mt-2 flex items-center gap-2">
                      <span>💡</span>
                      <span>Tip: Weigh yourself at the same time of day, on the same scale, for consistency.</span>
                    </p>
                  </div>

                  <div className="max-w-md">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={baselineWeight}
                      onChange={(e) => setBaselineWeight(e.target.value)}
                      onFocus={(e) => e.target.style.borderColor = '#daa450'}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#d1d5db';
                        // Don't auto-save on blur - only save on explicit actions (Next button, Complete Setup)
                      }}
                      placeholder="Enter your weight"
                      className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg focus:ring-2 focus:outline-none transition-all text-base lg:text-lg"
                      style={{ focusRingColor: '#daa450' }}
                    />
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setBaselineStep('images')}
                      className="px-6 py-3 lg:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl lg:rounded-lg font-semibold transition-colors min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => {
                        // Just navigate - NO saving until Complete Setup button is clicked
                        setBaselineStep('measurements');
                      }}
                      className="px-6 py-3 lg:py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                      style={{ backgroundColor: '#daa450' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                    >
                      Next: Measurements →
                    </button>
                  </div>
                </div>
              )}

              {baselineStep === 'measurements' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">Body Measurements</h2>
                    <p className="text-gray-600 text-sm lg:text-base">Record your starting measurements. These help track progress beyond just weight.</p>
                    <p className="text-sm text-gray-700 mt-2 flex items-center gap-2">
                      <span>💡</span>
                      <span>Tip: Measure at the same time of day, in the same location, for consistency.</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
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
                          value={baselineMeasurements[key as keyof typeof baselineMeasurements]}
                          onChange={(e) => {
                            setBaselineMeasurements(prev => ({
                              ...prev,
                              [key]: e.target.value
                            }));
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#daa450'}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#d1d5db';
                            // Don't auto-save on blur - only save on explicit actions (Next button, Complete Setup)
                          }}
                          placeholder="Enter measurement"
                          className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg focus:ring-2 focus:outline-none transition-all"
                          style={{ focusRingColor: '#daa450' }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setBaselineStep('weight')}
                      className="px-6 py-3 lg:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl lg:rounded-lg font-semibold transition-colors min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Prevent double-clicks
                        if (isSavingRef.current || saving) {
                          return;
                        }
                        
                        // Verify all requirements are met before completing
                        // Only photos and weight are required - measurements are optional
                        const hasAllPhotos = beforeImages.front && beforeImages.back && beforeImages.side;
                        const hasWeight = baselineWeight && baselineWeight.trim() && !isNaN(parseFloat(baselineWeight)) && parseFloat(baselineWeight) > 0;
                        
                        if (!hasAllPhotos) {
                          alert('Please upload all three before photos (front, back, and side) to complete setup.');
                          return;
                        }
                        
                        if (!hasWeight) {
                          alert('Please enter your body weight to complete setup.');
                          return;
                        }
                        
                        // Measurements are optional - no validation needed
                        
                        // All requirements met - THIS IS THE ONLY PLACE WE SAVE
                        try {
                          const saved = await handleBaselineSave();
                          if (saved) {
                            setIsBaselineSetup(false);
                            alert('Baseline setup completed! You can now track your progress over time.');
                          }
                        } catch (error) {
                          console.error('Failed to save baseline:', error);
                          alert('Failed to save baseline. Please try again.');
                        }
                      }}
                      disabled={saving}
                      type="button"
                      className="px-6 py-3 lg:py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] flex items-center justify-center disabled:opacity-50"
                      style={{ backgroundColor: '#22c55e' }}
                      onMouseEnter={(e) => {
                        if (!saving) e.currentTarget.style.backgroundColor = '#16a34a';
                      }}
                      onMouseLeave={(e) => {
                        if (!saving) e.currentTarget.style.backgroundColor = '#22c55e';
                      }}
                    >
                      {saving ? 'Saving...' : 'Complete Setup'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  // NORMAL MEASUREMENT TRACKING MODE
  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-white flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-4 lg:ml-8 p-5 lg:p-6">
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2 mb-4 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Measurements & Weight</h1>
                  <p className="text-gray-600 text-sm lg:text-base">Track your body measurements and weight over time</p>
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-5 py-3 lg:px-6 lg:py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                  style={{ backgroundColor: '#daa450' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                >
                  {showAddForm ? 'Cancel' : '+ Add New Entry'}
                </button>
              </div>
            </div>
          </div>

          {/* Add/Edit Entry Form */}
          {showAddForm && (
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-5 lg:p-8 mb-6 lg:mb-8">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-6">
                {editingEntry ? 'Edit Measurement' : 'Add New Measurement'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Body Weight */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Body Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={bodyWeight}
                    onChange={(e) => setBodyWeight(e.target.value)}
                    placeholder="Enter your weight"
                    className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg focus:ring-2 focus:outline-none transition-all"
                    style={{ focusRingColor: '#daa450' }}
                    onFocus={(e) => e.target.style.borderColor = '#daa450'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                {/* Measurements */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Body Measurements (cm)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'waist', label: 'Waist' },
                      { key: 'hips', label: 'Hips' },
                      { key: 'chest', label: 'Chest' },
                      { key: 'leftThigh', label: 'Left Thigh' },
                      { key: 'rightThigh', label: 'Right Thigh' },
                      { key: 'leftArm', label: 'Left Arm' },
                      { key: 'rightArm', label: 'Right Arm' }
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {label}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={measurements[key as keyof typeof measurements]}
                          onChange={(e) => setMeasurements(prev => ({
                            ...prev,
                            [key]: e.target.value
                          }))}
                          placeholder="Enter measurement"
                          className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg focus:ring-2 focus:outline-none transition-all"
                          style={{ focusRingColor: '#daa450' }}
                          onFocus={(e) => e.target.style.borderColor = '#daa450'}
                          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-6 py-3 lg:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl lg:rounded-lg font-semibold transition-colors min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || (!bodyWeight && Object.values(measurements).every(v => !v))}
                    className="px-6 py-3 lg:py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                    style={{ backgroundColor: '#daa450' }}
                    onMouseEnter={(e) => {
                      if (!saving && (bodyWeight || Object.values(measurements).some(v => v))) {
                        e.currentTarget.style.backgroundColor = '#c89540';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!saving && (bodyWeight || Object.values(measurements).some(v => v))) {
                        e.currentTarget.style.backgroundColor = '#daa450';
                      }
                    }}
                  >
                    {saving ? (editingEntry ? 'Updating...' : 'Saving...') : (editingEntry ? 'Update Measurement' : 'Save Measurement')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Current Measurements Summary */}
          {measurementHistory.length > 0 && (
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-5 lg:p-8 mb-6 lg:mb-8">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-6">Current Measurements</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {getLatestMeasurement('bodyWeight') && (
                  <div className="bg-gray-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-gray-200">
                    <div className="text-xs lg:text-sm text-gray-600 mb-1">Weight</div>
                    <div className="text-2xl lg:text-3xl font-bold text-gray-900">{getLatestMeasurement('bodyWeight')} kg</div>
                    <div className="text-[10px] lg:text-xs text-gray-500 mt-2">
                      {formatDate(measurementHistory[0].date)}
                    </div>
                  </div>
                )}
                {getLatestMeasurement('waist') && (
                  <div className="bg-gray-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-gray-200">
                    <div className="text-xs lg:text-sm text-gray-600 mb-1">Waist</div>
                    <div className="text-2xl lg:text-3xl font-bold text-gray-900">{getLatestMeasurement('waist')} cm</div>
                    <div className="text-[10px] lg:text-xs text-gray-500 mt-2">
                      {formatDate(measurementHistory[0].date)}
                    </div>
                  </div>
                )}
                {getLatestMeasurement('hips') && (
                  <div className="bg-gray-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-gray-200">
                    <div className="text-xs lg:text-sm text-gray-600 mb-1">Hips</div>
                    <div className="text-2xl lg:text-3xl font-bold text-gray-900">{getLatestMeasurement('hips')} cm</div>
                    <div className="text-[10px] lg:text-xs text-gray-500 mt-2">
                      {formatDate(measurementHistory[0].date)}
                    </div>
                  </div>
                )}
                {getLatestMeasurement('chest') && (
                  <div className="bg-gray-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-gray-200">
                    <div className="text-xs lg:text-sm text-gray-600 mb-1">Chest</div>
                    <div className="text-2xl lg:text-3xl font-bold text-gray-900">{getLatestMeasurement('chest')} cm</div>
                    <div className="text-[10px] lg:text-xs text-gray-500 mt-2">
                      {formatDate(measurementHistory[0].date)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Measurement History */}
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
            <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Measurement History</h2>
              <p className="text-gray-600 text-xs lg:text-sm mt-1">Track your progress over time</p>
            </div>
            <div className="p-5 lg:p-8">
              {measurementHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg mb-2">No measurements recorded yet</p>
                  <p className="text-gray-400 text-sm">Start tracking by adding your first measurement</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Weight (kg)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Waist (cm)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Hips (cm)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Chest (cm)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {measurementHistory.map((entry) => (
                        <tr key={entry.id} className={`hover:bg-gray-50 ${entry.isBaseline ? 'bg-blue-50' : ''}`}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            <div className="flex items-center space-x-2">
                              <span>{formatDate(entry.date)}</span>
                              {entry.isBaseline && (
                                <span className="px-2 py-0.5 text-white text-xs font-semibold rounded-full" style={{ backgroundColor: '#daa450' }}>
                                  Baseline
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {entry.bodyWeight ? `${entry.bodyWeight}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {entry.measurements.waist ? `${entry.measurements.waist}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {entry.measurements.hips ? `${entry.measurements.hips}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {entry.measurements.chest ? `${entry.measurements.chest}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEdit(entry)}
                                className="p-2 rounded-lg transition-colors"
                                style={{ color: '#daa450' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef9e7'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                title="Edit measurement"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                disabled={deletingEntry === entry.id || entry.isBaseline}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={entry.isBaseline ? 'Cannot delete baseline' : 'Delete measurement'}
                              >
                                {deletingEntry === entry.id ? (
                                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}
