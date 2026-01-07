'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface PushNotificationPreferences {
  newMessageFromCoach: boolean;
  newCheckInOpen: boolean;
  newCheckInReplyFromCoach: boolean;
  goalAchieved: boolean;
  systemAlerts: boolean;
}

export default function PushNotificationPreferences() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, subscribe, unsubscribe, isLoading: pushLoading } = usePushNotifications();
  const [preferences, setPreferences] = useState<PushNotificationPreferences>({
    newMessageFromCoach: true,
    newCheckInOpen: true,
    newCheckInReplyFromCoach: true,
    goalAchieved: true,
    systemAlerts: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPreferences();
  }, [user?.uid]);

  const loadPreferences = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const clientDoc = await getDoc(doc(db, 'clients', user.uid));
      
      if (clientDoc.exists()) {
        const clientData = clientDoc.data();
        const pushPrefs = clientData.pushNotificationPreferences || {};
        
        setPreferences({
          newMessageFromCoach: pushPrefs.newMessageFromCoach !== false,
          newCheckInOpen: pushPrefs.newCheckInOpen !== false,
          newCheckInReplyFromCoach: pushPrefs.newCheckInReplyFromCoach !== false,
          goalAchieved: pushPrefs.goalAchieved !== false,
          systemAlerts: pushPrefs.systemAlerts !== false
        });
      }
    } catch (error) {
      console.error('Error loading push notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = async (key: keyof PushNotificationPreferences, value: boolean) => {
    if (!user?.uid || saving) return;

    const newPreferences = {
      ...preferences,
      [key]: value
    };

    setPreferences(newPreferences);
    setSaving(true);

    try {
      await updateDoc(doc(db, 'clients', user.uid), {
        pushNotificationPreferences: newPreferences,
        updatedAt: new Date()
      });
      
      setMessage('Preferences updated!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating preferences:', error);
      setMessage('Failed to update preferences');
      // Revert on error
      setPreferences(preferences);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubscription = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      const success = await subscribe();
      if (!success) {
        setMessage('Failed to enable push notifications. Please check your browser settings.');
        setTimeout(() => setMessage(''), 5000);
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Push Notifications</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">
            Push notifications are not supported in this browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Push Notifications</h2>
      
      {message && (
        <div className={`mb-4 p-3 rounded-md ${
          message.includes('updated') || message.includes('enabled')
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Main Toggle */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-base font-medium text-gray-900 mb-1">Enable Push Notifications</h3>
            <p className="text-sm text-gray-600">
              Receive notifications on your device even when the app is closed
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSubscribed}
              onChange={handleToggleSubscription}
              disabled={pushLoading || saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
          </label>
        </div>
      </div>

      {/* Per-Type Preferences */}
      {isSubscribed && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-base font-medium text-gray-900 mb-4">Notification Types</h3>
          <p className="text-sm text-gray-600 mb-6">
            Choose which types of notifications you want to receive as push notifications
          </p>

          <div className="space-y-4">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.newMessageFromCoach}
                onChange={(e) => handlePreferenceChange('newMessageFromCoach', e.target.checked)}
                disabled={saving}
                className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">New Message from Coach</span>
                <p className="text-xs text-gray-600 mt-1">
                  Get notified when your coach sends you a message
                </p>
              </div>
            </label>

            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.newCheckInOpen}
                onChange={(e) => handlePreferenceChange('newCheckInOpen', e.target.checked)}
                disabled={saving}
                className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">New Check-in Open</span>
                <p className="text-xs text-gray-600 mt-1">
                  Get notified when a new check-in window opens
                </p>
              </div>
            </label>

            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.newCheckInReplyFromCoach}
                onChange={(e) => handlePreferenceChange('newCheckInReplyFromCoach', e.target.checked)}
                disabled={saving}
                className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">New Check-in Reply from Coach</span>
                <p className="text-xs text-gray-600 mt-1">
                  Get notified when your coach provides feedback on your check-in
                </p>
              </div>
            </label>

            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.goalAchieved}
                onChange={(e) => handlePreferenceChange('goalAchieved', e.target.checked)}
                disabled={saving}
                className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">Goal Achieved</span>
                <p className="text-xs text-gray-600 mt-1">
                  Get notified when you achieve a milestone or goal
                </p>
              </div>
            </label>

            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.systemAlerts}
                onChange={(e) => handlePreferenceChange('systemAlerts', e.target.checked)}
                disabled={saving}
                className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900">System Alerts</span>
                <p className="text-xs text-gray-600 mt-1">
                  Get notified about important system updates and reminders
                </p>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

