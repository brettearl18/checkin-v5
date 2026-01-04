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
  imageType: 'profile' | 'before' | 'after' | 'progress';
  orientation?: 'front' | 'back' | 'side';
  uploadedAt: string;
  caption?: string;
}

export default function ClientPhotosGalleryPage() {
  const { userProfile } = useAuth();
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterOrientation, setFilterOrientation] = useState<'all' | 'front' | 'back' | 'side'>('all');
  const [filterImageType, setFilterImageType] = useState<'all' | 'profile' | 'before' | 'after' | 'progress'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'clientName'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedPhoto, setSelectedPhoto] = useState<ClientPhoto | null>(null);

  useEffect(() => {
    if (userProfile?.uid) {
      fetchPhotos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/progress-images?coachId=${userProfile?.uid}&limit=1000`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const photosData: ClientPhoto[] = data.data.map((img: any) => ({
            id: img.id,
            clientId: img.clientId,
            clientName: img.clientName || 'Client',
            imageUrl: img.imageUrl,
            imageType: img.imageType,
            orientation: img.orientation,
            uploadedAt: img.uploadedAt || new Date().toISOString(),
            caption: img.caption || ''
          }));
          setPhotos(photosData);
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

  // Get unique clients for filter dropdown
  const uniqueClients = useMemo(() => {
    const clients = new Map<string, string>();
    photos.forEach(photo => {
      if (!clients.has(photo.clientId)) {
        clients.set(photo.clientId, photo.clientName);
      }
    });
    return Array.from(clients.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [photos]);

  // Filter and sort photos
  const filteredAndSortedPhotos = useMemo(() => {
    let filtered = photos.filter(photo => {
      // Filter by client
      if (filterClient !== 'all' && photo.clientId !== filterClient) {
        return false;
      }
      // Filter by orientation
      if (filterOrientation !== 'all' && photo.orientation !== filterOrientation) {
        return false;
      }
      // Filter by image type
      if (filterImageType !== 'all' && photo.imageType !== filterImageType) {
        return false;
      }
      return true;
    });

    // Sort photos
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        const dateA = new Date(a.uploadedAt).getTime();
        const dateB = new Date(b.uploadedAt).getTime();
        comparison = dateA - dateB;
      } else if (sortBy === 'clientName') {
        comparison = a.clientName.localeCompare(b.clientName);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [photos, filterClient, filterOrientation, filterImageType, sortBy, sortOrder]);

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
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
          <CoachNavigation />
          <div className="flex-1 ml-8 p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded-2xl"></div>
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
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  All Client Photos
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  View and manage all client progress photos
                </p>
              </div>
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>

          {/* Filters and Sort Controls */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Client Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Client
                </label>
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="all">All Clients ({photos.length})</option>
                  {uniqueClients.map(([clientId, clientName]) => {
                    const count = photos.filter(p => p.clientId === clientId).length;
                    return (
                      <option key={clientId} value={clientId}>
                        {clientName} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Orientation Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by View
                </label>
                <select
                  value={filterOrientation}
                  onChange={(e) => setFilterOrientation(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="all">All Views</option>
                  <option value="front">Front</option>
                  <option value="back">Back</option>
                  <option value="side">Side</option>
                </select>
              </div>

              {/* Image Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Type
                </label>
                <select
                  value={filterImageType}
                  onChange={(e) => setFilterImageType(e.target.value as any)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="progress">Progress</option>
                  <option value="before">Before</option>
                  <option value="after">After</option>
                  <option value="profile">Profile</option>
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="date">Date</option>
                    <option value="clientName">Client Name</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Count */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredAndSortedPhotos.length}</span> of {photos.length} photos
              </p>
            </div>
          </div>

          {/* Photos Grid */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8">
              {filteredAndSortedPhotos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-700 text-lg mb-2">No photos found</p>
                  <p className="text-gray-400 text-sm">
                    {photos.length === 0 
                      ? "No client photos have been uploaded yet"
                      : "Try adjusting your filters to see more photos"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-6">
                  {filteredAndSortedPhotos.map((photo) => (
                    <div key={photo.id} className="group relative cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden border border-gray-200 hover:border-orange-300 transition-all duration-200 hover:shadow-lg">
                        {/* Photo */}
                        <img
                          src={photo.imageUrl}
                          alt={`${photo.clientName} - ${photo.imageType}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling as HTMLElement;
                            if (placeholder) {
                              placeholder.style.display = 'flex';
                            }
                          }}
                        />
                        {/* Fallback Placeholder */}
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50 absolute inset-0" style={{ display: 'none' }}>
                          <div className="text-center">
                            <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-2">
                              <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <p className="text-xs text-pink-600 font-medium">{photo.clientName}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Hover Overlay - Show Client Name */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                        <div className="px-4 py-2 bg-white/95 backdrop-blur-sm text-gray-900 rounded-lg font-semibold text-sm shadow-lg">
                          {photo.clientName}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full Screen Image Modal */}
        {selectedPhoto && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center">
              {/* Close Button */}
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Image */}
              <img
                src={selectedPhoto.imageUrl}
                alt={`${selectedPhoto.clientName} - ${selectedPhoto.imageType}`}
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Image Info Overlay */}
              <div 
                className="absolute bottom-4 left-4 right-4 bg-white rounded-lg p-4 shadow-2xl border border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedPhoto.clientName}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${
                        selectedPhoto.imageType === 'profile' ? 'bg-blue-500' :
                        selectedPhoto.imageType === 'before' ? 'bg-orange-500' :
                        selectedPhoto.imageType === 'after' ? 'bg-green-500' :
                        'bg-purple-500'
                      }`}>
                        {selectedPhoto.imageType === 'profile' ? 'Profile' :
                         selectedPhoto.imageType === 'before' ? 'Before' :
                         selectedPhoto.imageType === 'after' ? 'After' :
                         'Progress'}
                      </span>
                      {selectedPhoto.orientation && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${
                          selectedPhoto.orientation === 'front' ? 'bg-pink-500' :
                          selectedPhoto.orientation === 'back' ? 'bg-indigo-500' :
                          'bg-teal-500'
                        }`}>
                          {selectedPhoto.orientation.charAt(0).toUpperCase() + selectedPhoto.orientation.slice(1)}
                        </span>
                      )}
                      <span className="text-xs text-gray-600">{formatTimeAgo(selectedPhoto.uploadedAt)}</span>
                    </div>
                  </div>
                  <Link
                    href={`/clients/${selectedPhoto.clientId}`}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Client Profile
                  </Link>
                </div>
                {selectedPhoto.caption && (
                  <p className="text-sm text-gray-700 mt-2">{selectedPhoto.caption}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleProtected>
  );
}
