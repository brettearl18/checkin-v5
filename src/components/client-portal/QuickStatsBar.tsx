'use client';

interface QuickStats {
  daysActive: number;
  totalCheckIns: number;
  weightChange: number; // kg
  measurementChange: number; // cm
  currentStreak: number; // days
}

interface QuickStatsBarProps {
  stats: QuickStats | null;
  loading?: boolean;
}

export default function QuickStatsBar({ stats, loading = false }: QuickStatsBarProps) {
  if (loading || !stats) {
    return (
      <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 mb-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatWeightChange = (change: number) => {
    if (change === 0) return 'No change';
    const abs = Math.abs(change);
    const sign = change > 0 ? '-' : '+'; // Positive change = weight lost (good)
    return `${sign}${abs.toFixed(1)}kg`;
  };

  const formatMeasurementChange = (change: number) => {
    if (change === 0) return 'No change';
    const abs = Math.abs(change);
    const sign = change > 0 ? '-' : '+'; // Positive change = reduction (good for most measurements)
    return `${sign}${abs.toFixed(1)}cm`;
  };

  const statsItems = [
    {
      label: 'Days Active',
      value: `${stats.daysActive}`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      textColor: 'text-gray-900'
    },
    {
      label: 'Check-ins',
      value: `${stats.totalCheckIns}`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      textColor: 'text-gray-900'
    },
    {
      label: 'Weight Change',
      value: formatWeightChange(stats.weightChange),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      ),
      bgColor: stats.weightChange > 0 ? 'bg-green-50' : stats.weightChange < 0 ? 'bg-orange-50' : 'bg-gray-50',
      iconColor: stats.weightChange > 0 ? 'text-green-600' : stats.weightChange < 0 ? 'text-orange-600' : 'text-gray-500',
      textColor: stats.weightChange > 0 ? 'text-green-700' : stats.weightChange < 0 ? 'text-orange-700' : 'text-gray-600'
    },
    {
      label: 'Measurements',
      value: formatMeasurementChange(stats.measurementChange),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      bgColor: stats.measurementChange > 0 ? 'bg-green-50' : stats.measurementChange < 0 ? 'bg-orange-50' : 'bg-gray-50',
      iconColor: stats.measurementChange > 0 ? 'text-green-600' : stats.measurementChange < 0 ? 'text-orange-600' : 'text-gray-500',
      textColor: stats.measurementChange > 0 ? 'text-green-700' : stats.measurementChange < 0 ? 'text-orange-700' : 'text-gray-600'
    },
    {
      label: 'Streak',
      value: `${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      bgColor: stats.currentStreak > 0 ? 'bg-orange-50' : 'bg-gray-50',
      iconColor: stats.currentStreak > 0 ? 'text-orange-600' : 'text-gray-500',
      textColor: stats.currentStreak > 0 ? 'text-orange-700' : 'text-gray-600'
    }
  ];

  return (
    <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] border border-gray-100/80 p-4 sm:p-5 mb-6 transition-all duration-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.08)]">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {statsItems.map((item, index) => (
          <div key={index} className="flex flex-col items-start group">
            <div className={`flex items-center gap-2 mb-2 ${item.iconColor}`}>
              <div className={`${item.bgColor} rounded-lg p-1.5 group-hover:scale-105 transition-transform duration-200`}>
                {item.icon}
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-gray-600 uppercase tracking-wide">{item.label}</span>
            </div>
            <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${item.textColor} leading-tight`}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

