'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';

interface Notice {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface NoticeBoardProps {
  coachId?: string;
  clientId?: string;
  readOnly?: boolean; // If true, shows notices in read-only mode (for clients)
}

export default function NoticeBoard({ coachId, clientId, readOnly = false }: NoticeBoardProps) {
  const { userProfile } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    imageUrl: '',
    linkUrl: '',
    linkText: ''
  });

  // Helper function to get Firebase ID token
  const getIdToken = async (): Promise<string | null> => {
    if (typeof window === 'undefined' || !userProfile?.uid) return null;
    try {
      const { auth } = await import('@/lib/firebase-client');
      if (auth?.currentUser) {
        return await auth.currentUser.getIdToken();
      }
    } catch (authError) {
      console.warn('Could not get auth token:', authError);
    }
    return null;
  };

  useEffect(() => {
    if (coachId || clientId) {
      fetchNotices();
    }
  }, [coachId, clientId]);

  const fetchNotices = async () => {
    try {
      const params = new URLSearchParams();
      if (coachId) params.append('coachId', coachId);
      if (clientId) params.append('clientId', clientId);

      const response = await fetch(`/api/notices?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setNotices(data.notices || []);
      }
    } catch (error) {
      console.error('Error fetching notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachId) return;

    try {
      const idToken = await getIdToken();
      const url = editingNotice ? `/api/notices/${editingNotice.id}` : '/api/notices';
      const method = editingNotice ? 'PUT' : 'POST';

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          ...formData,
          clientIds: clientId ? [clientId] : [],
          isPublic: !clientId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowAddForm(false);
        setEditingNotice(null);
        setFormData({
          title: '',
          content: '',
          imageUrl: '',
          linkUrl: '',
          linkText: ''
        });
        fetchNotices();
      } else {
        alert(data.message || 'Failed to save notice');
      }
    } catch (error) {
      console.error('Error saving notice:', error);
      alert('An error occurred while saving the notice');
    }
  };

  const handleDelete = async (noticeId: string) => {
    if (!confirm('Are you sure you want to delete this notice?')) return;

    try {
      const idToken = await getIdToken();
      const headers: HeadersInit = {};
      
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/notices/${noticeId}`, {
        method: 'DELETE',
        headers,
      });

      const data = await response.json();

      if (data.success) {
        fetchNotices();
      } else {
        alert(data.message || 'Failed to delete notice');
      }
    } catch (error) {
      console.error('Error deleting notice:', error);
      alert('An error occurred while deleting the notice');
    }
  };

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      content: notice.content,
      imageUrl: notice.imageUrl || '',
      linkUrl: notice.linkUrl || '',
      linkText: notice.linkText || ''
    });
    setShowAddForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && coachId && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Notice Board</h2>
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingNotice(null);
              setFormData({
                title: '',
                content: '',
                imageUrl: '',
                linkUrl: '',
                linkText: ''
              });
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Notice
          </button>
        </div>
      )}

      {readOnly && (
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Notice Board</h2>
      )}

      {/* Add/Edit Form */}
      {showAddForm && !readOnly && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {editingNotice ? 'Edit Notice' : 'Add New Notice'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter notice title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content *
              </label>
              <textarea
                required
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter notice content"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL (Optional)
              </label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.linkUrl}
                  onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link Text (Optional)
                </label>
                <input
                  type="text"
                  value={formData.linkText}
                  onChange={(e) => setFormData({ ...formData, linkText: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Read More"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingNotice ? 'Update' : 'Post'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingNotice(null);
                  setFormData({
                    title: '',
                    content: '',
                    imageUrl: '',
                    linkUrl: '',
                    linkText: ''
                  });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notices List */}
      {notices.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500">
            {readOnly ? 'No notices posted yet.' : 'No notices posted yet. Click "Add Notice" to create one.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{notice.title}</h3>
                {!readOnly && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(notice)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(notice.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="text-gray-700 whitespace-pre-wrap mb-4">
                {notice.content}
              </div>

              {notice.imageUrl && (
                <div className="mb-4">
                  <img
                    src={notice.imageUrl}
                    alt={notice.title}
                    className="max-w-full h-auto rounded-lg"
                  />
                </div>
              )}

              {notice.linkUrl && (
                <div className="mt-4">
                  <a
                    href={notice.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    {notice.linkText || notice.linkUrl}
                  </a>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Posted {new Date(notice.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

