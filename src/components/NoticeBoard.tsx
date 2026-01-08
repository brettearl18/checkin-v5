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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#daa450' }}></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && coachId && (
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Notice Board</h2>
          </div>
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
            className="px-4 py-2 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
            style={{ backgroundColor: '#daa450' }}
          >
            + Add Notice
          </button>
        </div>
      )}

      {readOnly && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Notice Board</h2>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && !readOnly && (
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6 mb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
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
                className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                style={{ '--tw-ring-color': '#daa450' } as React.CSSProperties}
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
                className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                style={{ '--tw-ring-color': '#daa450' } as React.CSSProperties}
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
                className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                style={{ '--tw-ring-color': '#daa450' } as React.CSSProperties}
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
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                  style={{ '--tw-ring-color': '#daa450' } as React.CSSProperties}
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
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent transition-colors"
                  style={{ '--tw-ring-color': '#daa450' } as React.CSSProperties}
                  placeholder="e.g., Read More"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-4 py-2 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-sm"
                style={{ backgroundColor: '#daa450' }}
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
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notices List */}
      {notices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-gray-600">
            {readOnly ? 'No notices posted yet.' : 'No notices posted yet. Click "Add Notice" to create one.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 sm:p-6"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-gray-900">{notice.title}</h3>
                {!readOnly && (
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleEdit(notice)}
                      className="text-sm font-medium hover:opacity-80 transition-opacity"
                      style={{ color: '#daa450' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(notice.id)}
                      className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="text-gray-700 whitespace-pre-wrap mb-4 leading-relaxed">
                {notice.content}
              </div>

              {notice.imageUrl && (
                <div className="mb-4">
                  <img
                    src={notice.imageUrl}
                    alt={notice.title}
                    className="max-w-full h-auto rounded-xl"
                  />
                </div>
              )}

              {notice.linkUrl && (
                <div className="mt-4">
                  <a
                    href={notice.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-medium hover:opacity-80 transition-opacity"
                    style={{ color: '#daa450' }}
                  >
                    {notice.linkText || notice.linkUrl}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100">
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

