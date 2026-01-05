'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import Link from 'next/link';

interface PlatformUpdate {
  id?: string;
  date: string;
  category: 'bug-fix' | 'new-feature' | 'maintenance' | 'downtime' | 'security' | 'performance';
  title: string;
  description: string;
  details?: string;
  status: 'completed' | 'in-progress' | 'planned';
  impact?: 'low' | 'medium' | 'high' | 'critical';
}

export default function PlatformUpdatesAdminPage() {
  const { userProfile } = useAuth();
  const [updates, setUpdates] = useState<PlatformUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlatformUpdate>({
    date: new Date().toISOString().split('T')[0],
    category: 'bug-fix',
    title: '',
    description: '',
    details: '',
    status: 'completed',
    impact: 'medium',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/platform-updates');
      
      if (!response.ok) {
        throw new Error('Failed to fetch updates');
      }

      const data = await response.json();
      if (data.success) {
        setUpdates(data.updates || []);
      }
    } catch (err: any) {
      console.error('Error fetching updates:', err);
      setError(err.message || 'Failed to load updates');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const url = editingId
        ? `/api/admin/platform-updates/${editingId}`
        : '/api/admin/platform-updates';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save update');
      }

      setSuccess(editingId ? 'Update edited successfully!' : 'Update created successfully!');
      setFormData({
        date: new Date().toISOString().split('T')[0],
        category: 'bug-fix',
        title: '',
        description: '',
        details: '',
        status: 'completed',
        impact: 'medium',
      });
      setEditingId(null);
      fetchUpdates();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving update:', err);
      setError(err.message || 'Failed to save update');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (update: PlatformUpdate) => {
    setEditingId(update.id || null);
    setFormData({
      ...update,
      date: update.date.split('T')[0], // Convert ISO date to date input format
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this update?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/platform-updates/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete update');
      }

      setSuccess('Update deleted successfully!');
      fetchUpdates();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting update:', err);
      setError(err.message || 'Failed to delete update');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      category: 'bug-fix',
      title: '',
      description: '',
      details: '',
      status: 'completed',
      impact: 'medium',
    });
    setError(null);
  };

  return (
    <RoleProtected requiredRole="admin">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Platform Updates Management</h1>
                <p className="mt-2 text-gray-600">Manage changelog entries visible to clients</p>
              </div>
              <Link
                href="/admin"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Admin
              </Link>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-sm font-medium">{success}</p>
            </div>
          )}

          {/* Form */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? 'Edit Update' : 'Create New Update'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="bug-fix">🐛 Bug Fix</option>
                    <option value="new-feature">✨ New Feature</option>
                    <option value="maintenance">🔧 Maintenance</option>
                    <option value="downtime">⚠️ Downtime</option>
                    <option value="security">🔒 Security</option>
                    <option value="performance">⚡ Performance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="completed">Completed</option>
                    <option value="in-progress">In Progress</option>
                    <option value="planned">Planned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Impact Level
                  </label>
                  <select
                    value={formData.impact}
                    onChange={(e) => setFormData({ ...formData, impact: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Brief title for the update"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the update (shown in list)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extended Details (Optional)
                </label>
                <textarea
                  value={formData.details || ''}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Extended details (shown in expandable section)"
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Updates List */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Existing Updates</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading updates...</p>
              </div>
            ) : updates.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No updates yet. Create one above!</p>
            ) : (
              <div className="space-y-4">
                {updates.map((update) => (
                  <div
                    key={update.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                            {update.category}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {update.status}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(update.date).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{update.title}</h3>
                        <p className="text-sm text-gray-600">{update.description}</p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(update)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(update.id!)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

