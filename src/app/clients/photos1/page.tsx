'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import CoachNavigation from '@/components/CoachNavigation';
import Link from 'next/link';

interface ClientPhoto {
  id: string;
  clientId: string;
  clientName: string;
  imageUrl: string;
  imageType: 'before' | 'after';
  orientation?: 'front' | 'back' | 'side';
  uploadedAt: string;
  caption?: string;
}

export default function PhotoGalleryPage() {
  const { user, userProfile } = useAuth();
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'before' | 'after'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'clientName' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedPhoto, setSelectedPhoto] = useState<ClientPhoto | null>(null);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    setAuthError(false);
    if (user && userProfile?.uid) {
      fetchPhotos();
    }
  }, [user, userProfile?.uid]);

  const fetchPhotos = async (retry = false) => {
    const uid = userProfile?.uid;
    if (!uid) return;
    try {
      setLoading(true);
      setAuthError(false);
      const token = user ? await user.getIdToken(true) : null;
      if (!token) {
        if (!retry) {
          setTimeout(() => fetchPhotos(true), 800);
          return;
        }
        setAuthError(true);
        setLoading(false);
        return;
      }
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const response = await fetch(`/api/progress-images?coachId=${uid}&limit=1000`, {
        headers,
        credentials: 'same-origin',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const all = (data.data as any[]).map((img: any) => ({
            id: img.id,
            clientId: img.clientId,
            clientName: img.clientName || 'Client',
            imageUrl: img.imageUrl,
            imageType: img.imageType,
            orientation: img.orientation,
            uploadedAt: img.uploadedAt || new Date().toISOString(),
            caption: img.caption || '',
          }));
          setPhotos(all.filter((p): p is ClientPhoto => p.imageType === 'before' || p.imageType === 'after'));
        } else {
          setPhotos([]);
        }
      } else {
        setPhotos([]);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  const uniqueClients = useMemo(() => {
    const map = new Map<string, string>();
    photos.forEach((p) => {
      if (!map.has(p.clientId)) map.set(p.clientId, p.clientName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [photos]);

  const filteredAndSortedPhotos = useMemo(() => {
    let list = photos.filter((p) => {
      if (filterClient !== 'all' && p.clientId !== filterClient) return false;
      if (filterType !== 'all' && p.imageType !== filterType) return false;
      return true;
    });
    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      } else if (sortBy === 'clientName') {
        comparison = a.clientName.localeCompare(b.clientName);
      } else {
        comparison = a.imageType.localeCompare(b.imageType);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [photos, filterClient, filterType, sortBy, sortOrder]);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    return `${Math.floor(diffInDays / 30)}mo ago`;
  };

  const labelClass = (type: 'before' | 'after') =>
    type === 'before' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white';

  if (loading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
          <CoachNavigation />
          <div className="flex-1 ml-8 p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded-2xl" />
                ))}
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
        <div className="flex-1 ml-8 p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Photo Gallery
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  Before & after progress photos from all clients
                </p>
              </div>
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 font-medium">
                ← Back to Dashboard
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="all">All Clients ({photos.length})</option>
                  {uniqueClients.map(([clientId, clientName]) => (
                    <option key={clientId} value={clientId}>
                      {clientName} ({photos.filter((p) => p.clientId === clientId).length})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | 'before' | 'after')}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="all">Before & After</option>
                  <option value="before">Before only</option>
                  <option value="after">After only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'clientName' | 'type')}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="date">Date</option>
                  <option value="clientName">Client name</option>
                  <option value="type">Before / After</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                <button
                  type="button"
                  onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
              </div>
            </div>
            <p className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredAndSortedPhotos.length}</span> of {photos.length} photos
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8">
              {filteredAndSortedPhotos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-700 text-lg mb-2">No before/after photos yet</p>
                  <p className="text-gray-400 text-sm">
                    {authError
                      ? "Couldn't load photos. Please refresh the page."
                      : 'Only before and after images from client progress are shown here.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {filteredAndSortedPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative cursor-pointer rounded-2xl overflow-hidden border border-gray-200 hover:border-orange-300 hover:shadow-lg transition-all"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <div className="aspect-square bg-gray-100 relative">
                        <img
                          src={photo.imageUrl}
                          alt={`${photo.clientName} - ${photo.imageType}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div
                          className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-semibold shadow ${labelClass(photo.imageType)}`}
                        >
                          {photo.imageType === 'before' ? 'Before' : 'After'}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-white text-sm font-medium truncate">{photo.clientName}</p>
                          <p className="text-white/80 text-xs">{formatTimeAgo(photo.uploadedAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div className="relative max-w-6xl max-h-full w-full flex items-center justify-center">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <img
                src={selectedPhoto.imageUrl}
                alt={`${selectedPhoto.clientName} - ${selectedPhoto.imageType}`}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              <div
                className="absolute bottom-4 left-4 right-4 bg-white rounded-xl p-4 shadow-2xl border border-gray-200 flex flex-wrap items-center justify-between gap-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-bold text-gray-900">{selectedPhoto.clientName}</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${labelClass(selectedPhoto.imageType)}`}>
                    {selectedPhoto.imageType === 'before' ? 'Before' : 'After'}
                  </span>
                  {selectedPhoto.orientation && (
                    <span className="px-2 py-1 rounded-lg text-xs bg-gray-100 text-gray-700 capitalize">
                      {selectedPhoto.orientation}
                    </span>
                  )}
                  <span className="text-sm text-gray-500">{formatTimeAgo(selectedPhoto.uploadedAt)}</span>
                </div>
                <Link
                  href={`/clients/${selectedPhoto.clientId}`}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  View client
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleProtected>
  );
}
