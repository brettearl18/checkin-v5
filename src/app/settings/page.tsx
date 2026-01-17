'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import CoachNavigation from '@/components/CoachNavigation';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface CoachSettings {
  timezone: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialization?: string;
  bio?: string;
  notificationPreferences: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    checkInReminders: boolean;
    clientMessages: boolean;
  };
}

const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Europe/Berlin', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
  { value: 'Australia/Perth', label: 'Australian Western Time (AWT)' },
  { value: 'Pacific/Auckland', label: 'New Zealand Standard Time (NZST)' }
];

// Email Management Component
function EmailManagementSection() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [missedEmails, setMissedEmails] = useState<any[]>([]);
  const [upcomingEmails, setUpcomingEmails] = useState<any[]>([]);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [selectedMissedEmails, setSelectedMissedEmails] = useState<Set<string>>(new Set());
  const [selectedUpcomingEmails, setSelectedUpcomingEmails] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ sent: 0, total: 0, errors: 0 });

  useEffect(() => {
    loadEmailData();
  }, []);

  const loadEmailData = async () => {
    try {
      setLoading(true);
      let idToken: string | null = null;
      
      if (typeof window !== 'undefined' && user?.uid) {
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

      const response = await fetch('/api/coach/missed-emails', {
        headers
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMissedEmails(data.data.missedEmails || []);
          setUpcomingEmails(data.data.upcomingEmails || []);
        }
      }
    } catch (error) {
      console.error('Error loading email data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (type: string, assignmentId: string, emailInfo?: any, skipConfirm?: boolean) => {
    if (!skipConfirm && !confirm(`Send ${type === 'check-in-window-open' ? 'Window Open' : 'Due Reminder'} email to ${emailInfo?.clientName || 'client'}?`)) {
      return false;
    }

    let data: any = null;

    try {
      setSendingEmail(assignmentId);
      setMessage('');

      let idToken: string | null = null;
      if (typeof window !== 'undefined' && user?.uid) {
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

      const response = await fetch('/api/coach/send-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, assignmentId })
      });

      data = await response.json();

      if (data.success) {
        setMessage(`Email sent successfully to ${data.recipient || emailInfo?.clientName || 'client'}`);
        setTimeout(() => setMessage(''), 5000);
        // Reload email data to update the list
        loadEmailData();
      } else {
        setMessage(`Failed to send email: ${data.message || 'Unknown error'}`);
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setMessage('Failed to send email. Please try again.');
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setSendingEmail(null);
    }
    
    return data?.success || false;
  };

  const handleSelectMissedEmail = (emailId: string) => {
    setSelectedMissedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const handleSelectUpcomingEmail = (key: string) => {
    setSelectedUpcomingEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleSelectAllMissed = () => {
    const sendableEmails = missedEmails.filter(e => e.clientId && e.metadata?.assignmentId);
    if (selectedMissedEmails.size === sendableEmails.length) {
      setSelectedMissedEmails(new Set());
    } else {
      setSelectedMissedEmails(new Set(sendableEmails.map(e => e.id)));
    }
  };

  const handleSelectAllUpcoming = () => {
    if (selectedUpcomingEmails.size === upcomingEmails.length) {
      setSelectedUpcomingEmails(new Set());
    } else {
      setSelectedUpcomingEmails(new Set(upcomingEmails.map((e, idx) => `${e.type}-${e.assignmentId}-${idx}`)));
    }
  };

  const handleBulkSend = async () => {
    const missedToSend = missedEmails.filter(e => 
      selectedMissedEmails.has(e.id) && e.clientId && e.metadata?.assignmentId
    );
    const upcomingToSend = upcomingEmails.filter((e, idx) => 
      selectedUpcomingEmails.has(`${e.type}-${e.assignmentId}-${idx}`)
    );

    const total = missedToSend.length + upcomingToSend.length;
    if (total === 0) {
      setMessage('Please select at least one email to send.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (!confirm(`Send ${total} email${total > 1 ? 's' : ''}? This may take a few moments.`)) {
      return;
    }

    setBulkSending(true);
    setBulkProgress({ sent: 0, total, errors: 0 });
    setMessage('');

    let successCount = 0;
    let errorCount = 0;

    // Send missed emails
    for (const email of missedToSend) {
      const success = await handleSendEmail(
        email.emailType,
        email.metadata.assignmentId,
        email,
        true // skip confirm
      );
      if (success) {
        successCount++;
        setSelectedMissedEmails(prev => {
          const newSet = new Set(prev);
          newSet.delete(email.id);
          return newSet;
        });
      } else {
        errorCount++;
      }
      setBulkProgress({ sent: successCount, total, errors: errorCount });
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Send upcoming emails
    for (const email of upcomingToSend) {
      const success = await handleSendEmail(
        email.type,
        email.assignmentId,
        email,
        true // skip confirm
      );
      if (success) {
        successCount++;
        setSelectedUpcomingEmails(prev => {
          const newSet = new Set(prev);
          newSet.delete(`${email.type}-${email.assignmentId}-${upcomingEmails.indexOf(email)}`);
          return newSet;
        });
      } else {
        errorCount++;
      }
      setBulkProgress({ sent: successCount, total, errors: errorCount });
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setBulkSending(false);
    setMessage(`Bulk send complete: ${successCount} sent successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
    setTimeout(() => setMessage(''), 5000);
    
    // Reload email data
    loadEmailData();
  };

  const getEmailTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'check-in-window-open': 'Window Open',
      'check-in-due-reminder': 'Due Reminder',
      'check-in-assigned': 'Check-in Assigned',
      'check-in-completed': 'Check-in Completed',
      'check-in-overdue': 'Overdue Reminder',
      'unknown': 'Unknown'
    };
    return labels[type] || type;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Email Management</h2>
      <p className="text-gray-600 mb-6">
        View and manually send emails that haven't been delivered to your clients, or send upcoming emails early.
      </p>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.includes('successfully') 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      ) : (
        <>
          {/* Bulk Actions */}
          {(missedEmails.length > 0 || upcomingEmails.length > 0) && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-gray-700">
                    Selected: {selectedMissedEmails.size + selectedUpcomingEmails.size} email{(selectedMissedEmails.size + selectedUpcomingEmails.size) !== 1 ? 's' : ''}
                  </span>
                  {bulkSending && (
                    <span className="text-sm text-blue-600">
                      Sending: {bulkProgress.sent}/{bulkProgress.total} {bulkProgress.errors > 0 && `(${bulkProgress.errors} errors)`}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleBulkSend}
                  disabled={bulkSending || (selectedMissedEmails.size === 0 && selectedUpcomingEmails.size === 0)}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSending ? `Sending... (${bulkProgress.sent}/${bulkProgress.total})` : 'Send Selected'}
                </button>
              </div>
            </div>
          )}

          {/* Missed Emails */}
          {missedEmails.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                  Missed Emails ({missedEmails.length})
                </h3>
                {missedEmails.filter(e => e.clientId && e.metadata?.assignmentId).length > 0 && (
                  <button
                    onClick={handleSelectAllMissed}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selectedMissedEmails.size === missedEmails.filter(e => e.clientId && e.metadata?.assignmentId).length
                      ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {missedEmails.map((email) => {
                  const canSend = email.clientId && email.metadata?.assignmentId;
                  const isSelected = selectedMissedEmails.has(email.id);
                  return (
                  <div key={email.id} className={`border rounded-lg p-4 ${isSelected ? 'border-blue-400 bg-blue-100' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex items-start gap-3">
                      {canSend && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectMissedEmail(email.id)}
                          className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          disabled={bulkSending}
                        />
                      )}
                      <div className="flex-1 flex items-start justify-between">
                        <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-900">{email.clientName}</span>
                          <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">
                            {getEmailTypeLabel(email.emailType)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">{email.subject}</p>
                        <p className="text-xs text-gray-600">
                          Recipient: {email.recipient} • Sent: {formatDate(email.sentAt)}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          {email.mailgunSent === false ? 'Not sent via Mailgun' : 
                           email.delivered ? 'Delivered' :
                           email.failed ? 'Failed' : 'Delivery status unknown'}
                        </p>
                      </div>
                        {canSend && (
                          <button
                            onClick={() => handleSendEmail(email.emailType, email.metadata.assignmentId, email)}
                            disabled={sendingEmail === email.metadata.assignmentId || bulkSending}
                            className="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sendingEmail === email.metadata.assignmentId ? 'Sending...' : 'Resend'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Emails */}
          {upcomingEmails.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  Upcoming Emails ({upcomingEmails.length})
                </h3>
                <button
                  onClick={handleSelectAllUpcoming}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedUpcomingEmails.size === upcomingEmails.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                These emails are scheduled to be sent automatically. You can send them now if needed.
              </p>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {upcomingEmails.map((email, idx) => {
                  const emailKey = `${email.type}-${email.assignmentId}-${idx}`;
                  const isSelected = selectedUpcomingEmails.has(emailKey);
                  return (
                  <div key={emailKey} className={`border rounded-lg p-4 ${isSelected ? 'border-green-400 bg-green-100' : 'border-blue-200 bg-blue-50'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectUpcomingEmail(emailKey)}
                        className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        disabled={bulkSending}
                      />
                      <div className="flex-1 flex items-start justify-between">
                        <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-900">{email.clientName}</span>
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                            {getEmailTypeLabel(email.type)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">{email.formTitle}</p>
                        <p className="text-xs text-gray-600">
                          Scheduled: {formatDate(email.shouldSendAt)} • Due: {formatDate(email.dueDate)}
                        </p>
                      </div>
                        <button
                          onClick={() => handleSendEmail(email.type, email.assignmentId, email)}
                          disabled={sendingEmail === email.assignmentId || bulkSending}
                          className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingEmail === email.assignmentId ? 'Sending...' : 'Send Now'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          )}

          {missedEmails.length === 0 && upcomingEmails.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg mb-2">All emails are up to date! ✅</p>
              <p className="text-sm">No missed or upcoming emails found.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { userProfile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<CoachSettings>({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialization: '',
    bio: '',
    notificationPreferences: {
      emailNotifications: true,
      pushNotifications: true,
      checkInReminders: true,
      clientMessages: true
    }
  });

  useEffect(() => {
    loadCoachSettings();
  }, [user?.uid]);

  const loadCoachSettings = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      
      // Fetch coach data from Firestore
      const coachDoc = await getDoc(doc(db, 'coaches', user.uid));
      
      if (coachDoc.exists()) {
        const coachData = coachDoc.data();
        setSettings({
          timezone: coachData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          firstName: coachData.firstName || '',
          lastName: coachData.lastName || '',
          email: coachData.email || '',
          phone: coachData.phone || '',
          specialization: coachData.specialization || '',
          bio: coachData.bio || '',
          notificationPreferences: {
            emailNotifications: coachData.notificationPreferences?.emailNotifications ?? true,
            pushNotifications: coachData.notificationPreferences?.pushNotifications ?? true,
            checkInReminders: coachData.notificationPreferences?.checkInReminders ?? true,
            clientMessages: coachData.notificationPreferences?.clientMessages ?? true
          }
        });
      }
    } catch (error) {
      console.error('Error loading coach settings:', error);
      setMessage('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      const [category, field] = name.split('.');
      
      if (category === 'notificationPreferences') {
        setSettings(prev => ({
          ...prev,
          notificationPreferences: {
            ...prev.notificationPreferences,
            [field]: checked
          }
        }));
      }
    } else {
      setSettings(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    setSaving(true);
    setMessage('');

    try {
      const updateData = {
        timezone: settings.timezone,
        firstName: settings.firstName,
        lastName: settings.lastName,
        phone: settings.phone,
        specialization: settings.specialization,
        bio: settings.bio,
        notificationPreferences: settings.notificationPreferences,
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'coaches', user.uid), updateData);
      setMessage('Settings updated successfully!');
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating settings:', error);
      setMessage('Failed to update settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getCurrentTimeInTimezone = (timezone: string) => {
    try {
      return new Date().toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (error) {
      return 'Invalid timezone';
    }
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
          <CoachNavigation />
          <div className="flex-1 p-6">
            <div className="max-w-4xl mx-auto">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                <div className="space-y-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl shadow-lg p-6">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                      <div className="space-y-3">
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <CoachNavigation />
        
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Settings
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Manage your account preferences and timezone settings
              </p>
            </div>

            {message && (
              <div className={`mb-6 p-4 rounded-lg ${
                message.includes('successfully') 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Timezone Settings */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Timezone Settings</h2>
                <p className="text-gray-600 mb-6">
                  Set your timezone to ensure all dates and times are displayed correctly for your location.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="timezone" className="block text-sm font-semibold text-gray-700 mb-2">
                      Timezone
                    </label>
                    <select
                      id="timezone"
                      name="timezone"
                      value={settings.timezone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      {timezones.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Current Time in Selected Timezone
                    </label>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-mono">
                      {getCurrentTimeInTimezone(settings.timezone)}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <span className="text-blue-600 text-lg">ℹ️</span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-900">Timezone Information</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Your timezone setting affects how dates and times are displayed throughout the application. 
                        This includes check-in due dates, appointment times, and activity timestamps.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Settings */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Profile Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={settings.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={settings.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={settings.email}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={settings.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="specialization" className="block text-sm font-semibold text-gray-700 mb-2">
                      Specialization
                    </label>
                    <input
                      type="text"
                      id="specialization"
                      name="specialization"
                      value={settings.specialization}
                      onChange={handleInputChange}
                      placeholder="e.g., Weight Loss, Mental Health, Fitness"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
                
                <div className="mt-6">
                  <label htmlFor="bio" className="block text-sm font-semibold text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={settings.bio}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Tell your clients about your coaching approach and experience..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Notification Preferences</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-gray-900">Email Notifications</h3>
                      <p className="text-sm text-gray-600">Receive notifications via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="notificationPreferences.emailNotifications"
                        checked={settings.notificationPreferences.emailNotifications}
                        onChange={handleInputChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-gray-900">Push Notifications</h3>
                      <p className="text-sm text-gray-600">Receive push notifications in your browser</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="notificationPreferences.pushNotifications"
                        checked={settings.notificationPreferences.pushNotifications}
                        onChange={handleInputChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-gray-900">Check-in Reminders</h3>
                      <p className="text-sm text-gray-600">Get notified when clients complete check-ins</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="notificationPreferences.checkInReminders"
                        checked={settings.notificationPreferences.checkInReminders}
                        onChange={handleInputChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-gray-900">Client Messages</h3>
                      <p className="text-sm text-gray-600">Get notified when clients send messages</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="notificationPreferences.clientMessages"
                        checked={settings.notificationPreferences.clientMessages}
                        onChange={handleInputChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Email Management Section */}
              <EmailManagementSection />

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 