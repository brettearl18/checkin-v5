'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ProfilePersonalizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  currentPersonalization?: {
    quote: string | null;
    showQuote: boolean;
    colorTheme: string;
    icon: string | null;
  };
}

const colorThemes = [
  { name: 'Golden Brown', value: '#daa450', bg: '#daa450' },
  { name: 'Ocean Blue', value: '#3b82f6', bg: '#3b82f6' },
  { name: 'Forest Green', value: '#10b981', bg: '#10b981' },
  { name: 'Sunset Orange', value: '#f97316', bg: '#f97316' },
  { name: 'Lavender Purple', value: '#8b5cf6', bg: '#8b5cf6' },
  { name: 'Rose Pink', value: '#ec4899', bg: '#ec4899' },
];

const wellnessIcons = [
  { emoji: '💪', name: 'Strength' },
  { emoji: '🌱', name: 'Growth' },
  { emoji: '⭐', name: 'Goals' },
  { emoji: '🎯', name: 'Focus' },
  { emoji: '❤️', name: 'Heart' },
  { emoji: '🌟', name: 'Shine' },
  { emoji: '🦋', name: 'Transformation' },
  { emoji: '🌈', name: 'Balance' },
  { emoji: '🔥', name: 'Motivation' },
  { emoji: '🌙', name: 'Peace' },
];

export default function ProfilePersonalizationModal({
  isOpen,
  onClose,
  onSave,
  currentPersonalization
}: ProfilePersonalizationModalProps) {
  const { userProfile } = useAuth();
  const [quote, setQuote] = useState('');
  const [showQuote, setShowQuote] = useState(true);
  const [colorTheme, setColorTheme] = useState('#daa450');
  const [icon, setIcon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentPersonalization) {
      setQuote(currentPersonalization.quote || '');
      setShowQuote(currentPersonalization.showQuote);
      setColorTheme(currentPersonalization.colorTheme || '#daa450');
      setIcon(currentPersonalization.icon || null);
    }
  }, [currentPersonalization, isOpen]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      // Get Firebase ID token
      let idToken: string | null = null;
      if (typeof window !== 'undefined' && userProfile?.uid) {
        try {
          const { auth } = await import('@/lib/firebase-client');
          if (auth?.currentUser) {
            idToken = await auth.currentUser.getIdToken();
          }
        } catch (authError) {
          console.warn('Could not get auth token:', authError);
        }
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/client-portal/profile-personalization', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          quote: quote.trim() || null,
          showQuote: showQuote && quote.trim().length > 0,
          colorTheme,
          icon,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save personalization');
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('Error saving personalization:', err);
      setError(err.message || 'Failed to save personalization. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const clientName = userProfile ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() : 'Client';
  const initials = userProfile ? `${userProfile.firstName?.charAt(0) || ''}${userProfile.lastName?.charAt(0) || ''}`.toUpperCase() : 'CL';
  const displayQuote = showQuote && quote.trim() ? quote.trim() : 'Wellness journey';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Customize Your Profile</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">Preview:</p>
            <div className="rounded-xl p-4" style={{ backgroundColor: colorTheme }}>
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {userProfile?.avatar ? (
                    <img src={userProfile.avatar} alt={clientName} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-white text-base font-medium">{initials.substring(0, 2)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-bold text-lg truncate">{clientName}</h3>
                  <p className="text-white text-sm opacity-90 mt-1">
                    {icon && <span className="mr-1">{icon}</span>}
                    {displayQuote}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Quote */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Personal Quote <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="e.g., Progress, not perfection"
              rows={3}
              maxLength={100}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:outline-none transition-all text-sm resize-y"
              style={{ focusRingColor: colorTheme }}
              onFocus={(e) => e.target.style.borderColor = colorTheme}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">{quote.length}/100 characters</p>
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={showQuote}
                  onChange={(e) => setShowQuote(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Show quote</span>
              </label>
            </div>
            {!showQuote && quote.trim() && (
              <p className="text-xs text-amber-600 mt-1">
                Quote will show "Wellness journey" until you enable "Show quote"
              </p>
            )}
          </div>

          {/* Color Theme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Color Theme
            </label>
            <div className="grid grid-cols-3 gap-3">
              {colorThemes.map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => setColorTheme(theme.value)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    colorTheme === theme.value
                      ? 'border-gray-900 shadow-md scale-105'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className="w-full h-12 rounded-lg mb-2"
                    style={{ backgroundColor: theme.bg }}
                  />
                  <p className="text-xs font-medium text-gray-700">{theme.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Personal Icon <span className="text-gray-500">(optional)</span>
            </label>
            <div className="grid grid-cols-5 gap-3">
              <button
                onClick={() => setIcon(null)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  icon === null
                    ? 'border-gray-900 bg-gray-100'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">—</div>
                <p className="text-xs font-medium text-gray-700">None</p>
              </button>
              {wellnessIcons.map((iconOption) => (
                <button
                  key={iconOption.emoji}
                  onClick={() => setIcon(iconOption.emoji)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    icon === iconOption.emoji
                      ? 'border-gray-900 bg-gray-100 scale-105'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{iconOption.emoji}</div>
                  <p className="text-xs font-medium text-gray-700">{iconOption.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: colorTheme }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!saving) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

