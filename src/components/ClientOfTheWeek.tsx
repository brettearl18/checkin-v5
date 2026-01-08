'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ClientOfTheWeekData {
  winner: {
    clientId: string;
    clientName: string;
    score: number;
    highlights: string[];
    reasoning: string;
  };
  runnerUps?: Array<{
    clientId: string;
    clientName: string;
    score: number;
    highlight: string;
  }>;
  generatedAt: string;
  weekOf: string;
}

interface ClientOfTheWeekProps {
  coachId: string;
}

export default function ClientOfTheWeek({ coachId }: ClientOfTheWeekProps) {
  const [data, setData] = useState<ClientOfTheWeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coachId) return;

    const fetchClientOfTheWeek = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/client-of-the-week?coachId=${coachId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.message || 'Failed to load client of the week');
        }
      } catch (err) {
        console.error('Error fetching client of the week:', err);
        setError('Failed to load client of the week');
      } finally {
        setLoading(false);
      }
    };

    fetchClientOfTheWeek();
  }, [coachId]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl shadow-lg border-2 border-amber-200 p-6 lg:p-8">
        <div className="animate-pulse">
          <div className="h-6 bg-amber-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-amber-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-amber-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-6 lg:p-8">
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-gray-600 font-medium">{error || 'Unable to load Client of the Week'}</p>
          <p className="text-sm text-gray-500 mt-2">Try refreshing the page</p>
        </div>
      </div>
    );
  }

  const { winner, runnerUps, weekOf } = data;
  const weekStartDate = new Date(weekOf);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  return (
    <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-3xl shadow-xl border-2 border-amber-300 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 lg:px-8 py-4 lg:py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-3xl">🏆</span>
              Client of the Week
            </h2>
            <p className="text-amber-50 text-sm mt-1">
              {weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="bg-white/20 rounded-full px-4 py-2">
            <span className="text-white font-bold text-lg">{winner.score}/100</span>
          </div>
        </div>
      </div>

      {/* Winner Section */}
      <div className="p-6 lg:p-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8 mb-6 border-2 border-amber-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-2xl lg:text-3xl shadow-lg">
                {winner.clientName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-1">
                  {winner.clientName}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium border border-amber-300">
                    🥇 Winner
                  </span>
                </div>
              </div>
            </div>
            <Link
              href={`/clients/${winner.clientId}`}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors text-sm lg:text-base"
            >
              View Profile →
            </Link>
          </div>

          {/* Highlights */}
          {winner.highlights && winner.highlights.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Key Achievements
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {winner.highlights.map((highlight, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 bg-amber-50 rounded-lg p-3 border border-amber-200"
                  >
                    <span className="text-amber-500 text-lg mt-0.5">✓</span>
                    <p className="text-gray-700 text-sm lg:text-base">{highlight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 lg:p-6 border border-amber-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
              <span className="text-xl">💡</span>
              Why {winner.clientName.split(' ')[0]} Won This Week
            </h4>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {winner.reasoning}
            </p>
          </div>
        </div>

        {/* Runner-ups */}
        {runnerUps && runnerUps.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
              Runner-Ups
            </h4>
            <div className="space-y-3">
              {runnerUps.map((runnerUp, index) => (
                <div
                  key={runnerUp.clientId}
                  className="bg-white rounded-xl shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {index === 0 ? '🥈' : index === 1 ? '🥉' : `${index + 2}`}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/clients/${runnerUp.clientId}`}
                            className="font-semibold text-gray-900 hover:text-orange-600 transition-colors"
                          >
                            {runnerUp.clientName}
                          </Link>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {runnerUp.score}/100
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{runnerUp.highlight}</p>
                      </div>
                    </div>
                    <Link
                      href={`/clients/${runnerUp.clientId}`}
                      className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

