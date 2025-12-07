'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';

interface ProgressImage {
  id: string;
  clientId: string;
  clientName: string;
  imageUrl: string;
  imageType: 'profile' | 'before' | 'after' | 'progress';
  orientation?: 'front' | 'back' | 'side';
  caption?: string;
  uploadedAt: string;
}

export default function ProgressImagesPage() {
  const { userProfile } = useAuth();
  const [images, setImages] = useState<ProgressImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageType, setImageType] = useState<'profile' | 'before' | 'after' | 'progress'>('progress');
  const [orientation, setOrientation] = useState<'front' | 'back' | 'side'>('front');
  const [caption, setCaption] = useState('');
  const [filterOrientation, setFilterOrientation] = useState<'all' | 'front' | 'back' | 'side'>('all');
  const [filterDate, setFilterDate] = useState<'all' | string>('all');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchClientData();
  }, [userProfile?.email]);

  useEffect(() => {
    if (clientId) {
      fetchImages();
    }
  }, [clientId]);

  const fetchClientData = async () => {
    try {
      if (!userProfile?.email) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}`);
      const result = await response.json();

      if (result.success && result.data.client) {
        const fetchedClientId = result.data.client.id;
        console.log('Fetched client ID:', fetchedClientId);
        setClientId(fetchedClientId);
        setCoachId(result.data.client.coachId || null);
      } else {
        console.error('Failed to fetch client data:', result.message);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    try {
      if (!clientId) {
        console.log('No clientId available for fetching images');
        setLoading(false);
        return;
      }

      console.log('Fetching images for clientId:', clientId);
      const response = await fetch(`/api/progress-images?clientId=${clientId}`);
      const data = await response.json();

      console.log('Images API response:', data);

      if (data.success) {
        const fetchedImages = data.data || [];
        console.log(`Fetched ${fetchedImages.length} images`);
        setImages(fetchedImages);
      } else {
        console.error('API returned error:', data.message);
        setImages([]);
      }
    } catch (error) {
      console.error('Error fetching progress images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !clientId || !coachId) {
      alert('Please select an image and ensure client/coach data is loaded');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('clientId', clientId);
      formData.append('coachId', coachId);
      formData.append('imageType', imageType);
      formData.append('orientation', orientation);
      formData.append('caption', caption);

      const response = await fetch('/api/progress-images/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        console.log('Upload successful, response data:', data.data);
        // Small delay to ensure Firestore has indexed the new document
        setTimeout(async () => {
          await fetchImages();
        }, 500);
        // Reset form
        setSelectedFile(null);
        setCaption('');
        setImageType('progress');
        setOrientation('front');
        setShowUploadModal(false);
        alert('Image uploaded successfully!');
      } else {
        const errorMsg = data.error || data.message || 'Unknown error';
        console.error('Upload error details:', data);
        alert(`Failed to upload image: ${errorMsg}\n\nPlease check:\n1. Firebase Storage is configured\n2. Storage bucket exists\n3. Service account has storage permissions`);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      alert(`Failed to upload image: ${errorMsg}\n\nPlease check your connection and try again.`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!window.confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }

    setDeletingId(imageId);

    try {
      const response = await fetch(`/api/progress-images/${imageId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Remove from local state immediately for better UX
        setImages(images.filter(img => img.id !== imageId));
        alert('Image deleted successfully!');
      } else {
        alert(`Failed to delete image: ${data.message}`);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

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

  const getImageTypeColor = (type: string) => {
    switch (type) {
      case 'profile': return 'bg-blue-100 text-blue-800';
      case 'before': return 'bg-orange-100 text-orange-800';
      case 'after': return 'bg-green-100 text-green-800';
      case 'progress': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrientationColor = (orientation?: string) => {
    switch (orientation) {
      case 'front': return 'bg-pink-100 text-pink-800';
      case 'back': return 'bg-indigo-100 text-indigo-800';
      case 'side': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Group images by date
  const groupImagesByDate = (images: ProgressImage[]) => {
    const groups: { [key: string]: ProgressImage[] } = {};
    images.forEach(img => {
      const date = new Date(img.uploadedAt);
      const dateKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(img);
    });
    return groups;
  };

  // Get unique dates for filtering
  const getUniqueDates = () => {
    const dates = images.map(img => {
      const date = new Date(img.uploadedAt);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    });
    return Array.from(new Set(dates)).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });
  };

  // Filter images by orientation and date
  const filteredImages = images.filter(img => {
    const orientationMatch = filterOrientation === 'all' || img.orientation === filterOrientation;
    if (filterDate === 'all') return orientationMatch;
    
    const imgDate = new Date(img.uploadedAt);
    const imgDateKey = imgDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    return orientationMatch && imgDateKey === filterDate;
  });

  // Group filtered images by date
  const groupedImages = groupImagesByDate(filteredImages);
  const sortedDateKeys = Object.keys(groupedImages).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const toggleImageSelection = (imageId: string) => {
    if (selectedForComparison.includes(imageId)) {
      setSelectedForComparison(selectedForComparison.filter(id => id !== imageId));
    } else {
      if (selectedForComparison.length < 4) {
        setSelectedForComparison([...selectedForComparison, imageId]);
      }
    }
  };

  const getSelectedImages = () => {
    return images.filter(img => selectedForComparison.includes(img.id));
  };

  const clearComparison = () => {
    setSelectedForComparison([]);
    setComparisonMode(false);
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex">
          <ClientNavigation />
          <div className="flex-1 ml-4 p-5">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-4 p-5">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Progress Images</h1>
                <p className="text-gray-900 text-sm mt-1 font-medium">Track your transformation journey with photos</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={fetchImages}
                  className="p-2 bg-white/80 backdrop-blur-sm hover:bg-white text-gray-700 rounded-xl border border-gray-200/60 shadow-sm transition-all duration-200 hover:shadow-md"
                  title="Refresh images"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg text-sm"
                >
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Upload Image
                </button>
              </div>
            </div>
            
            {/* Filters and Comparison Mode */}
            {images.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-900">Filter by view:</span>
                    <button
                      onClick={() => setFilterOrientation('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        filterOrientation === 'all'
                          ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                          : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white border border-gray-200/60'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterOrientation('front')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        filterOrientation === 'front'
                          ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                          : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white border border-gray-200/60'
                      }`}
                    >
                      Front
                    </button>
                    <button
                      onClick={() => setFilterOrientation('back')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        filterOrientation === 'back'
                          ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                          : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white border border-gray-200/60'
                      }`}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setFilterOrientation('side')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        filterOrientation === 'side'
                          ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                          : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white border border-gray-200/60'
                      }`}
                    >
                      Side
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {selectedForComparison.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-900 font-medium">
                          {selectedForComparison.length} selected
                        </span>
                        <button
                          onClick={clearComparison}
                          className="px-3 py-1.5 bg-white/80 backdrop-blur-sm hover:bg-white text-gray-700 rounded-lg text-xs font-medium transition-all duration-200 border border-gray-200/60 shadow-sm"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setComparisonMode(true)}
                          className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                          Compare ({selectedForComparison.length})
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setComparisonMode(!comparisonMode);
                        if (comparisonMode) {
                          setSelectedForComparison([]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        comparisonMode
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                          : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white border border-gray-200/60'
                      }`}
                    >
                      {comparisonMode ? 'Exit Compare' : 'Select to Compare'}
                    </button>
                  </div>
                </div>
                
                {/* Date Filter */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-gray-900">Filter by date:</span>
                  <select
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/80 backdrop-blur-sm border border-gray-200/60 text-gray-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 shadow-sm"
                  >
                    <option value="all">All Dates</option>
                    {getUniqueDates().map(date => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>


          {/* Images Grid */}
          {images.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-pink-100 to-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">No images yet</h3>
              <p className="text-gray-900 text-sm mb-6">Start tracking your progress by uploading your first image</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg text-sm"
              >
                Upload Your First Image
              </button>
            </div>
          ) : (
            <>
              {filteredImages.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 p-12 text-center">
                  <p className="text-gray-900 text-sm">No {filterOrientation !== 'all' ? filterOrientation : ''} images found</p>
                </div>
              ) : (
                <>
                  {/* Comparison View */}
                  {comparisonMode && selectedForComparison.length > 0 && (
                    <div className="mb-6 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/60 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Side-by-Side Comparison</h2>
                        <button
                          onClick={clearComparison}
                          className="px-3 py-1.5 bg-white/80 backdrop-blur-sm hover:bg-white text-gray-700 rounded-lg text-xs font-medium transition-all duration-200 border border-gray-200/60 shadow-sm"
                        >
                          Close Comparison
                        </button>
                      </div>
                      <div className={`grid gap-4 ${
                        selectedForComparison.length === 1 ? 'grid-cols-1' :
                        selectedForComparison.length === 2 ? 'grid-cols-2' :
                        selectedForComparison.length === 3 ? 'grid-cols-3' :
                        'grid-cols-2 md:grid-cols-4'
                      }`}>
                        {getSelectedImages().map((image) => (
                          <div key={image.id} className="bg-white rounded-xl border-2 border-blue-400 shadow-lg overflow-hidden">
                            <div className="aspect-square relative">
                              <img
                                src={image.imageUrl}
                                alt={image.caption || image.imageType}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-2 left-2 flex flex-col gap-1">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getImageTypeColor(image.imageType)}`}>
                                  {image.imageType === 'profile' ? 'Profile' :
                                   image.imageType === 'before' ? 'Before' :
                                   image.imageType === 'after' ? 'After' :
                                   'Progress'}
                                </span>
                                {image.orientation && (
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getOrientationColor(image.orientation)}`}>
                                    {image.orientation.charAt(0).toUpperCase() + image.orientation.slice(1)}
                                  </span>
                                )}
                              </div>
                              <div className="absolute bottom-2 left-2 right-2">
                                <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
                                  <p className="text-white text-xs font-medium">
                                    {new Date(image.uploadedAt).toLocaleDateString('en-US', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </p>
                                  {image.caption && (
                                    <p className="text-white/90 text-xs mt-1">{image.caption}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Images grouped by date */}
                  {sortedDateKeys.map((dateKey) => (
                    <div key={dateKey} className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {dateKey}
                          <span className="ml-2 text-xs font-normal text-gray-700">
                            ({groupedImages[dateKey].length} {groupedImages[dateKey].length === 1 ? 'image' : 'images'})
                          </span>
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {groupedImages[dateKey].map((image) => {
                          const isSelected = selectedForComparison.includes(image.id);
                          return (
                            <div 
                              key={image.id} 
                              className={`group relative aspect-square rounded-xl overflow-hidden border transition-all duration-300 hover:shadow-lg bg-white/80 backdrop-blur-sm cursor-pointer ${
                                comparisonMode 
                                  ? isSelected 
                                    ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
                                    : 'border-gray-200/60 hover:border-blue-300'
                                  : 'border-gray-200/60 hover:border-pink-300'
                              }`}
                              onClick={() => {
                                if (comparisonMode) {
                                  toggleImageSelection(image.id);
                                }
                              }}
                            >
                              {comparisonMode && (
                                <div className={`absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                  isSelected 
                                    ? 'bg-blue-600 text-white shadow-lg' 
                                    : 'bg-white/80 backdrop-blur-sm border-2 border-gray-300'
                                }`}>
                                  {isSelected && (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              )}
                              <img
                                src={image.imageUrl}
                                alt={image.caption || image.imageType}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(`
                                    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                                      <rect width="200" height="200" fill="#f3f4f6"/>
                                      <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#9ca3af" text-anchor="middle" dy=".3em">Image</text>
                                    </svg>
                                  `)}`;
                                }}
                              />
                              <div className="absolute top-2 left-2 flex flex-col gap-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getImageTypeColor(image.imageType)}`}>
                                  {image.imageType === 'profile' ? 'Profile' :
                                   image.imageType === 'before' ? 'Before' :
                                   image.imageType === 'after' ? 'After' :
                                   'Progress'}
                                </span>
                                {image.orientation && (
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOrientationColor(image.orientation)}`}>
                                    {image.orientation.charAt(0).toUpperCase() + image.orientation.slice(1)}
                                  </span>
                                )}
                              </div>
                              <div className="absolute bottom-2 right-2">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-black bg-opacity-50 text-white">
                                  {formatTimeAgo(image.uploadedAt)}
                                </span>
                              </div>
                              {image.caption && (
                                <div className="absolute bottom-2 left-2 right-2">
                                  <p className="px-2 py-1 rounded text-xs font-medium bg-black bg-opacity-50 text-white truncate">
                                    {image.caption}
                                  </p>
                                </div>
                              )}
                              
                              {/* Delete Button - Shows on Hover */}
                              {!comparisonMode && (
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(image.id);
                                    }}
                                    disabled={deletingId === image.id}
                                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Delete image"
                                  >
                                    {deletingId === image.id ? (
                                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200/60 max-w-md w-full p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Upload Progress Image</h2>
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setSelectedFile(null);
                      setCaption('');
                      setImageType('progress');
                      setOrientation('front');
                    }}
                    className="text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Image Type</label>
                    <select
                      value={imageType}
                      onChange={(e) => setImageType(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm border border-gray-200/60 rounded-lg bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    >
                      <option value="profile">Profile</option>
                      <option value="before">Before</option>
                      <option value="progress">Progress</option>
                      <option value="after">After</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">View <span className="text-red-500">*</span></label>
                    <select
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm border border-gray-200/60 rounded-lg bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                      required
                    >
                      <option value="front">Front</option>
                      <option value="back">Back</option>
                      <option value="side">Side</option>
                    </select>
                    <p className="text-xs text-gray-700 mt-1">Select the view angle for easy comparison</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Select Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="w-full px-3 py-2 text-sm border border-gray-200/60 rounded-lg bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    />
                    {selectedFile && (
                      <p className="mt-1.5 text-xs text-gray-600">Selected: {selectedFile.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Caption (Optional)</label>
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Add a caption..."
                      className="w-full px-3 py-2 text-sm border border-gray-200/60 rounded-lg bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setSelectedFile(null);
                        setCaption('');
                        setImageType('progress');
                        setOrientation('front');
                      }}
                      className="flex-1 px-4 py-2 text-sm border border-gray-200/60 rounded-lg bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white transition-all duration-200 shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={!selectedFile || uploading}
                      className="flex-1 px-4 py-2 text-sm bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </RoleProtected>
  );
}

