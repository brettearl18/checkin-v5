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

interface ClientOfTheWeekCompactProps {
  coachId: string;
}

export default function ClientOfTheWeekCompact({ coachId }: ClientOfTheWeekCompactProps) {
  const [data, setData] = useState<ClientOfTheWeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!coachId) return;

    const fetchClientOfTheWeek = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/client-of-the-week?coachId=${coachId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setData(result.data);
        }
      } catch (err) {
        console.error('Error fetching client of the week:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchClientOfTheWeek();
  }, [coachId]);

  if (loading || !data) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-3 animate-pulse">
        <div className="h-4 bg-amber-200 rounded w-1/3"></div>
      </div>
    );
  }

  const { winner, runnerUps, weekOf } = data;
  const weekStartDate = new Date(weekOf);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Compact Header - Always Visible */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl flex-shrink-0">🏆</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 truncate">
                Client of the Week
              </span>
              <span className="text-xs text-gray-600 flex-shrink-0">
                {weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Link
                href={`/clients/${winner.clientId}`}
                className="text-sm font-bold text-orange-600 hover:text-orange-700 truncate"
              >
                {winner.clientName}
              </Link>
              <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                {winner.score}/100
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-2 p-1.5 text-gray-500 hover:text-gray-700 hover:bg-amber-100 rounded flex-shrink-0 transition-colors"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <svg 
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-amber-200 bg-white/50 p-3 space-y-3">
          {/* Top Highlight */}
          {winner.highlights && winner.highlights.length > 0 && (
            <div className="text-xs text-gray-700">
              <span className="font-semibold">Key Achievement: </span>
              <span>{winner.highlights[0]}</span>
            </div>
          )}
          
          {/* Shortened Reasoning */}
          <div className="text-xs text-gray-600 line-clamp-2">
            {winner.reasoning.substring(0, 200)}{winner.reasoning.length > 200 ? '...' : ''}
          </div>

          {/* Runner-ups (compact) */}
          {runnerUps && runnerUps.length > 0 && (
            <div className="pt-2 border-t border-amber-200">
              <div className="text-xs font-semibold text-gray-700 mb-1.5">Runner-Ups:</div>
              <div className="space-y-1.5">
                {runnerUps.slice(0, 2).map((runnerUp, index) => (
                  <Link
                    key={runnerUp.clientId}
                    href={`/clients/${runnerUp.clientId}`}
                    className="flex items-center justify-between text-xs hover:bg-amber-50 p-1.5 rounded transition-colors"
                  >
                    <span className="font-medium text-gray-900">{runnerUp.clientName}</span>
                    <span className="text-gray-500">{runnerUp.score}/100</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* View Full Link */}
          <Link
            href={`/clients/${winner.clientId}`}
            className="block text-xs text-orange-600 hover:text-orange-700 font-medium text-center pt-2 border-t border-amber-200"
          >
            View Full Profile →
          </Link>
        </div>
      )}
    </div>
  );
}

