'use client';

import { useState, useEffect } from 'react';

interface AggregateMeasurementsData {
  totalWeightChange: number;
  totalClients: number;
  clientsWithData: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  bodyPartChanges: {
    waist: number;
    hips: number;
    chest: number;
    leftThigh: number;
    rightThigh: number;
    leftArm: number;
    rightArm: number;
  };
}

interface AggregateMeasurementsPanelProps {
  coachId: string;
}

export default function AggregateMeasurementsPanel({ coachId }: AggregateMeasurementsPanelProps) {
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2026-12-31');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AggregateMeasurementsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAggregateData = async () => {
    if (!coachId) return;

    setLoading(true);
    setError(null);

    try {
      // Get Firebase ID token for authentication
      let idToken: string | null = null;
      if (typeof window !== 'undefined') {
        try {
          const { auth } = await import('@/lib/firebase-client');
          if (auth?.currentUser) {
            idToken = await auth.currentUser.getIdToken();
          }
        } catch (authError) {
          console.warn('Could not get auth token:', authError);
        }
      }

      const headers: HeadersInit = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
      
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      
      const response = await fetch(`/api/coach/aggregate-measurements?${params}`, {
        headers
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching aggregate measurements:', err);
      setError('Error fetching aggregate measurements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (coachId) {
      fetchAggregateData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId, startDate, endDate]);

  const formatNumber = (num: number): string => {
    if (num === 0) return '0';
    const sign = num > 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}`;
  };

  const getChangeColor = (value: number): string => {
    if (value > 0) return 'text-green-600'; // Weight/measurements lost (positive change)
    if (value < 0) return 'text-red-600'; // Weight/measurements gained (negative change)
    return 'text-gray-600';
  };

  const getChangeLabel = (value: number, unit: string): string => {
    if (value > 0) return `${formatNumber(value)} ${unit} lost`;
    if (value < 0) return `${formatNumber(Math.abs(value))} ${unit} gained`;
    return `0 ${unit}`;
  };

  // Calculate average for thighs and arms
  const avgThighs = data ? (data.bodyPartChanges.leftThigh + data.bodyPartChanges.rightThigh) / 2 : 0;
  const avgArms = data ? (data.bodyPartChanges.leftArm + data.bodyPartChanges.rightArm) / 2 : 0;

  return (
    <div className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
      <div className="bg-[#fef9e7] px-6 md:px-10 py-6 md:py-8 border-b-2 border-[#daa450]/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Weight & Measurements Tracking</h2>
          
          {/* Date Range Picker */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="start-date" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                From:
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:border-[#daa450]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="end-date" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                To:
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:border-[#daa450]"
              />
            </div>
            <button
              onClick={fetchAggregateData}
              disabled={loading}
              className="px-4 py-2 bg-[#daa450] text-white rounded-lg text-sm font-medium hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? 'Loading...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-10">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#daa450]"></div>
          </div>
        )}

        {!loading && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Total Weight Change */}
            <div className="bg-gradient-to-br from-[#fef9e7] to-orange-50 border-2 border-[#daa450]/30 rounded-2xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Total Weight Change</h3>
                <div className="w-12 h-12 bg-[#daa450]/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#daa450]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div className="mb-4">
                <p className={`text-4xl md:text-5xl font-bold ${getChangeColor(data.totalWeightChange)}`}>
                  {formatNumber(data.totalWeightChange)}
                </p>
                <p className="text-gray-600 text-sm mt-2">KG</p>
              </div>
              <p className={`text-sm font-medium ${getChangeColor(data.totalWeightChange)}`}>
                {getChangeLabel(data.totalWeightChange, 'KG')}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {data.clientsWithData} of {data.totalClients} clients tracked
              </p>
            </div>

            {/* Body Measurements */}
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Body Measurements</h3>
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="space-y-4">
                {/* Waist */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">Waist</span>
                  <span className={`text-lg font-semibold ${getChangeColor(data.bodyPartChanges.waist)}`}>
                    {getChangeLabel(data.bodyPartChanges.waist, 'cm')}
                  </span>
                </div>
                
                {/* Hips */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">Hips</span>
                  <span className={`text-lg font-semibold ${getChangeColor(data.bodyPartChanges.hips)}`}>
                    {getChangeLabel(data.bodyPartChanges.hips, 'cm')}
                  </span>
                </div>
                
                {/* Chest */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">Chest</span>
                  <span className={`text-lg font-semibold ${getChangeColor(data.bodyPartChanges.chest)}`}>
                    {getChangeLabel(data.bodyPartChanges.chest, 'cm')}
                  </span>
                </div>
                
                {/* Thighs (Average) */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">Thighs (Avg)</span>
                  <span className={`text-lg font-semibold ${getChangeColor(avgThighs)}`}>
                    {getChangeLabel(avgThighs, 'cm')}
                  </span>
                </div>
                
                {/* Arms (Average) */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">Arms (Avg)</span>
                  <span className={`text-lg font-semibold ${getChangeColor(avgArms)}`}>
                    {getChangeLabel(avgArms, 'cm')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !data && !error && (
          <div className="text-center py-12">
            <p className="text-gray-500">No data available for the selected date range.</p>
          </div>
        )}
      </div>
    </div>
  );
}

