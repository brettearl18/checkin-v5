'use client';

import { useState, useEffect } from 'react';
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
}

export default function MeasurementsPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [measurementHistory, setMeasurementHistory] = useState<MeasurementEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MeasurementEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null);
  
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

  useEffect(() => {
    fetchClientData();
  }, [userProfile?.email]);

  useEffect(() => {
    if (clientId) {
      fetchMeasurementHistory();
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
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;

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
    return latest.measurements[key] || latest.bodyWeight;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
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

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-8 p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Measurements & Weight</h1>
                <p className="text-gray-600 mt-2">Track your body measurements and weight over time</p>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {showAddForm ? 'Cancel' : '+ Add New Entry'}
              </button>
            </div>
          </div>

          {/* Add/Edit Entry Form */}
          {showAddForm && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || (!bodyWeight && Object.values(measurements).every(v => !v))}
                    className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (editingEntry ? 'Updating...' : 'Saving...') : (editingEntry ? 'Update Measurement' : 'Save Measurement')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Current Measurements Summary */}
          {measurementHistory.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Current Measurements</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {getLatestMeasurement('bodyWeight') && (
                  <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-100">
                    <div className="text-sm text-gray-600 mb-1">Weight</div>
                    <div className="text-3xl font-bold text-gray-900">{getLatestMeasurement('bodyWeight')} kg</div>
                    <div className="text-xs text-gray-500 mt-2">
                      {formatDate(measurementHistory[0].date)}
                    </div>
                  </div>
                )}
                {getLatestMeasurement('waist') && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <div className="text-sm text-gray-600 mb-1">Waist</div>
                    <div className="text-3xl font-bold text-gray-900">{getLatestMeasurement('waist')} cm</div>
                    <div className="text-xs text-gray-500 mt-2">
                      {formatDate(measurementHistory[0].date)}
                    </div>
                  </div>
                )}
                {getLatestMeasurement('hips') && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                    <div className="text-sm text-gray-600 mb-1">Hips</div>
                    <div className="text-3xl font-bold text-gray-900">{getLatestMeasurement('hips')} cm</div>
                    <div className="text-xs text-gray-500 mt-2">
                      {formatDate(measurementHistory[0].date)}
                    </div>
                  </div>
                )}
                {getLatestMeasurement('chest') && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                    <div className="text-sm text-gray-600 mb-1">Chest</div>
                    <div className="text-3xl font-bold text-gray-900">{getLatestMeasurement('chest')} cm</div>
                    <div className="text-xs text-gray-500 mt-2">
                      {formatDate(measurementHistory[0].date)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Measurement History */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Measurement History</h2>
              <p className="text-sm text-gray-600 mt-1">Track your progress over time</p>
            </div>
            <div className="p-8">
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Left Thigh (cm)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Right Thigh (cm)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Left Arm (cm)</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Right Arm (cm)</th>
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
                                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
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
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {entry.measurements.leftThigh ? `${entry.measurements.leftThigh}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {entry.measurements.rightThigh ? `${entry.measurements.rightThigh}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {entry.measurements.leftArm ? `${entry.measurements.leftArm}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {entry.measurements.rightArm ? `${entry.measurements.rightArm}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEdit(entry)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit measurement"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                disabled={deletingEntry === entry.id}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete measurement"
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









