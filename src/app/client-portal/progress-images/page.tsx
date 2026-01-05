'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import { compressImage, shouldCompressImage } from '@/lib/image-compression';

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
  const [showSocialEditor, setShowSocialEditor] = useState(false);
  const [socialEditorImages, setSocialEditorImages] = useState<{left: ProgressImage | null, right: ProgressImage | null}>({left: null, right: null});
  const [imagePositions, setImagePositions] = useState<{left: {x: number, y: number, scale: number}, right: {x: number, y: number, scale: number}}>({
    left: {x: 0, y: 0, scale: 1},
    right: {x: 0, y: 0, scale: 1}
  });
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);

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
      
      if (!response.ok) {
        // Silently handle non-OK responses - API might be starting up
        setLoading(false);
        return;
      }
      
      const result = await response.json();

      if (result.success && result.data.client) {
        setClientId(result.data.client.id);
        setCoachId(result.data.client.coachId || null);
      } else {
        setLoading(false);
      }
    } catch (error: any) {
      // Silently handle network errors - they're often transient
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.debug('Error fetching client data (will retry):', error);
      }
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    try {
      if (!clientId) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/progress-images?clientId=${clientId}`);
      const data = await response.json();

      if (data.success) {
        setImages(data.data || []);
      } else {
        setImages([]);
      }
    } catch (error) {
      console.error('Error fetching progress images:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Check if file is very large (over 10MB) - reject immediately
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be less than 10MB. Please choose a smaller image.');
        return;
      }

      // If image is over 1MB, compress it automatically
      if (shouldCompressImage(file, 1)) {
        try {
          const compressedFile = await compressImage(file, {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            quality: 0.8,
          });
          setSelectedFile(compressedFile);
          console.log('Image compressed before upload');
        } catch (error) {
          console.error('Error compressing image:', error);
          // If compression fails, still allow the original file
          setSelectedFile(file);
        }
      } else {
        // File is already small enough, use as-is
        setSelectedFile(file);
      }
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
        setTimeout(async () => {
          await fetchImages();
        }, 500);
        setSelectedFile(null);
        setCaption('');
        setImageType('progress');
        setOrientation('front');
        setShowUploadModal(false);
        alert('Image uploaded successfully!');
      } else {
        const errorMsg = data.error || data.message || 'Unknown error';
        alert(`Failed to upload image: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
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

  const handleSocialEditorOpen = () => {
    if (selectedForComparison.length === 2) {
      const selectedImages = getSelectedImages();
      setSocialEditorImages({
        left: selectedImages[0] || null,
        right: selectedImages[1] || null
      });
      // Reset positions - will be calculated when images load
      setImagePositions({
        left: {x: 0, y: 0, scale: 1},
        right: {x: 0, y: 0, scale: 1}
      });
      setShowSocialEditor(true);
    }
  };

  const handleMouseDown = (side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(side);
    const startX = e.clientX;
    const startY = e.clientY;
    const currentX = imagePositions[side].x;
    const currentY = imagePositions[side].y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      setImagePositions(prev => ({
        ...prev,
        [side]: { ...prev[side], x: currentX + deltaX, y: currentY + deltaY }
      }));
    };

    const handleMouseUp = () => {
      setDragging(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (side: 'left' | 'right', e: React.TouchEvent) => {
    e.preventDefault();
    setDragging(side);
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const currentX = imagePositions[side].x;
    const currentY = imagePositions[side].y;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 1) {
        const touch = moveEvent.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        setImagePositions(prev => ({
          ...prev,
          [side]: { ...prev[side], x: currentX + deltaX, y: currentY + deltaY }
        }));
      }
    };

    const handleTouchEnd = () => {
      setDragging(null);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleScaleChange = (side: 'left' | 'right', delta: number) => {
    setImagePositions(prev => ({
      ...prev,
      [side]: { ...prev[side], scale: Math.max(0.5, Math.min(2, prev[side].scale + delta)) }
    }));
  };

  const exportSocialMediaImage = async () => {
    if (!socialEditorImages.left || !socialEditorImages.right) return;

    try {
      // Wait a brief moment for any pending renders to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Find the preview container
      const previewContainer = document.getElementById('social-editor-preview');
      if (!previewContainer) {
        throw new Error('Preview container not found');
      }

      // Get actual rendered dimensions
      const previewSize = previewContainer.offsetWidth || 600;
      const exportSize = 1080;
      const scaleFactor = exportSize / previewSize; // Scale from preview to export

      // Create export canvas
      const canvas = document.createElement('canvas');
      canvas.width = exportSize;
      canvas.height = exportSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportSize, exportSize);

      // Helper to load image
      const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise(async (resolve, reject) => {
          try {
            const proxyUrl = `/api/progress-images/proxy?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              URL.revokeObjectURL(objectUrl);
              resolve(img);
            };
            img.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              reject(new Error('Failed to load image'));
            };
            img.src = objectUrl;
          } catch (error) {
            reject(error);
          }
        });
      };

      // Load both images
      const [leftImg, rightImg] = await Promise.all([
        loadImage(socialEditorImages.left.imageUrl),
        loadImage(socialEditorImages.right.imageUrl)
      ]);

      // Calculate dimensions
      const exportHalfWidth = exportSize / 2; // 540px
      const exportHalfHeight = exportSize; // 1080px (full height for each half)
      const previewHalfHeight = previewSize; // 600px (full preview height)

      // Draw left image
      // The stored scale is: containerHeight / naturalHeight (from onLoad)
      // This scale makes the image fit the container height (600px) when applied
      // So: naturalHeight * scale = containerHeight (when scale = containerHeight/naturalHeight)
      // For export, we maintain the same visual scale: naturalHeight * exportScale = exportHeight
      // Therefore: exportScale = storedScale * (exportHeight / previewHeight)
      const leftNaturalHeight = leftImg.naturalHeight || leftImg.height;
      const leftNaturalWidth = leftImg.naturalWidth || leftImg.width;
      
      // Calculate what size the image appears in preview
      // Preview size = naturalHeight * storedScale
      const leftPreviewHeight = leftNaturalHeight * imagePositions.left.scale;
      const leftPreviewWidth = leftNaturalWidth * imagePositions.left.scale;
      
      // Scale to export dimensions (maintain same visual size ratio)
      const leftDisplayHeight = leftPreviewHeight * (exportHalfHeight / previewHalfHeight);
      const leftDisplayWidth = leftPreviewWidth * (exportHalfHeight / previewHalfHeight);
      
      // Position calculation
      // CSS: top: 50%, left: 50% positions top-left corner at center
      // translate(-50%, -50%) moves it back by half its size (centers it)
      // translate(x, y) applies the offset
      // scale(s) scales it around the center
      // In preview: left half center is at (previewSize/4, previewSize/2) = (150, 300)
      // In export: left half center is at (exportSize/4, exportSize/2) = (270, 540)
      const leftContainerCenterX = exportHalfWidth / 2; // 270px
      const leftContainerCenterY = exportHalfHeight / 2; // 540px
      
      // Canvas positioning: center + offset - half image size
      const leftX = leftContainerCenterX + (imagePositions.left.x * scaleFactor) - (leftDisplayWidth / 2);
      const leftY = leftContainerCenterY + (imagePositions.left.y * scaleFactor) - (leftDisplayHeight / 2);

      ctx.drawImage(leftImg, leftX, leftY, leftDisplayWidth, leftDisplayHeight);

      // Draw divider line
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = Math.max(2, 2 * scaleFactor);
      ctx.beginPath();
      ctx.moveTo(exportHalfWidth, 0);
      ctx.lineTo(exportHalfWidth, exportSize);
      ctx.stroke();

      // Draw right image
      const rightNaturalHeight = rightImg.naturalHeight || rightImg.height;
      const rightNaturalWidth = rightImg.naturalWidth || rightImg.width;
      
      const rightPreviewHeight = rightNaturalHeight * imagePositions.right.scale;
      const rightPreviewWidth = rightNaturalWidth * imagePositions.right.scale;
      
      const rightDisplayHeight = rightPreviewHeight * (exportHalfHeight / previewHalfHeight);
      const rightDisplayWidth = rightPreviewWidth * (exportHalfHeight / previewHalfHeight);
      
      // Right half center: (540 + 270, 540) = (810, 540)
      const rightContainerCenterX = exportHalfWidth + exportHalfWidth / 2; // 810px
      const rightContainerCenterY = exportHalfHeight / 2; // 540px
      
      const rightX = rightContainerCenterX + (imagePositions.right.x * scaleFactor) - (rightDisplayWidth / 2);
      const rightY = rightContainerCenterY + (imagePositions.right.y * scaleFactor) - (rightDisplayHeight / 2);

      ctx.drawImage(rightImg, rightX, rightY, rightDisplayWidth, rightDisplayHeight);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `progress-comparison-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error exporting image:', error);
      alert('Failed to export image. Please try again.');
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
      case 'front': return 'bg-blue-100 text-blue-800';
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
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderBottomColor: '#daa450' }}></div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-white flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-4 lg:ml-8 p-5 lg:p-6">
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2 mb-4 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Progress Images</h1>
                  <p className="text-gray-600 text-sm lg:text-base">Track your transformation journey with photos</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={fetchImages}
                    className="p-2.5 lg:p-2 rounded-xl lg:rounded-lg hover:bg-white/50 transition-colors min-w-[48px] lg:min-w-[44px] min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                    title="Refresh images"
                    style={{ color: '#daa450' }}
                  >
                    <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-5 py-3 lg:px-6 lg:py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#daa450' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                  >
                    <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-sm lg:text-base">Upload Image</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Filters and Comparison Mode */}
            {images.length > 0 && (
              <div className="space-y-4 lg:space-y-3 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs lg:text-sm font-medium text-gray-700">Filter by view:</span>
                    {(['all', 'front', 'back', 'side'] as const).map((orient) => (
                      <button
                        key={orient}
                        onClick={() => setFilterOrientation(orient)}
                        className={`px-4 py-2.5 lg:px-3 lg:py-1.5 rounded-xl lg:rounded-lg text-xs lg:text-sm font-semibold transition-all duration-200 min-h-[48px] lg:min-h-[44px] whitespace-nowrap ${
                          filterOrientation === orient
                            ? 'text-white shadow-sm'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                        }`}
                        style={filterOrientation === orient ? { backgroundColor: '#daa450' } : {}}
                        onMouseEnter={(e) => {
                          if (filterOrientation !== orient) {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (filterOrientation !== orient) {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                          }
                        }}
                      >
                        {orient === 'all' ? 'All' : orient.charAt(0).toUpperCase() + orient.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedForComparison.length > 0 && (
                      <>
                        <span className="text-xs lg:text-sm text-gray-700 font-medium">
                          {selectedForComparison.length} selected
                        </span>
                        <button
                          onClick={clearComparison}
                          className="px-4 py-2.5 lg:px-3 lg:py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl lg:rounded-lg text-xs lg:text-sm font-semibold transition-colors border border-gray-200 min-h-[48px] lg:min-h-[44px] whitespace-nowrap"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setComparisonMode(true)}
                          className="px-4 py-2.5 lg:px-3 lg:py-1.5 rounded-xl lg:rounded-lg text-white text-xs lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] whitespace-nowrap"
                          style={{ backgroundColor: '#3b82f6' }}
                        >
                          Compare ({selectedForComparison.length})
                        </button>
                        {selectedForComparison.length === 2 && (
                          <button
                            onClick={handleSocialEditorOpen}
                            className="px-4 py-2.5 lg:px-3 lg:py-1.5 rounded-xl lg:rounded-lg text-white text-xs lg:text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] whitespace-nowrap"
                            style={{ backgroundColor: '#daa450' }}
                          >
                            Create Social Media Post
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => {
                        setComparisonMode(!comparisonMode);
                        if (comparisonMode) {
                          setSelectedForComparison([]);
                        }
                      }}
                      className={`px-4 py-2.5 lg:px-3 lg:py-1.5 rounded-xl lg:rounded-lg text-xs lg:text-sm font-semibold transition-all duration-200 min-h-[48px] lg:min-h-[44px] whitespace-nowrap ${
                        comparisonMode
                          ? 'text-white shadow-sm'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                      }`}
                      style={comparisonMode ? { backgroundColor: '#22c55e' } : {}}
                    >
                      {comparisonMode ? 'Exit Compare' : 'Select to Compare'}
                    </button>
                  </div>
                </div>
                
                {/* Date Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs lg:text-sm font-medium text-gray-700">Filter by date:</span>
                  <select
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="px-4 py-2.5 lg:px-3 lg:py-1.5 rounded-xl lg:rounded-lg text-xs lg:text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 transition-all min-h-[48px] lg:min-h-[44px]"
                    style={{ focusRingColor: '#daa450' }}
                    onFocus={(e) => e.target.style.borderColor = '#daa450'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
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
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-8 lg:p-12 text-center">
              <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#fef9e7' }}>
                <svg className="w-8 h-8 lg:w-10 lg:h-10" style={{ color: '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg lg:text-xl font-bold text-gray-900 mb-2">No images yet</h3>
              <p className="text-gray-600 text-sm lg:text-base mb-6">Start tracking your progress by uploading your first image</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 lg:py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: '#daa450' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Upload Your First Image
              </button>
            </div>
          ) : (
            <>
              {filteredImages.length === 0 ? (
                <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-8 lg:p-12 text-center">
                  <p className="text-gray-600 text-sm lg:text-base">No {filterOrientation !== 'all' ? filterOrientation : ''} images found</p>
                </div>
              ) : (
                <>
                  {/* Comparison View */}
                  {comparisonMode && selectedForComparison.length > 0 && (
                    <div className="mb-6 lg:mb-8 bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-5 lg:p-8">
                      <div className="flex items-center justify-between mb-4 lg:mb-6">
                        <h2 className="text-lg lg:text-xl font-bold text-gray-900">Side-by-Side Comparison</h2>
                        <button
                          onClick={clearComparison}
                          className="px-4 py-2.5 lg:px-3 lg:py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl lg:rounded-lg text-xs lg:text-sm font-semibold transition-colors border border-gray-200 min-h-[48px] lg:min-h-[44px] whitespace-nowrap"
                        >
                          Close Comparison
                        </button>
                      </div>
                      <div className={`grid gap-4 ${
                        selectedForComparison.length === 1 ? 'grid-cols-1' :
                        selectedForComparison.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                        selectedForComparison.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4'
                      }`}>
                        {getSelectedImages().map((image) => (
                          <div key={image.id} className="bg-white rounded-2xl border-2 overflow-hidden shadow-md" style={{ borderColor: '#daa450' }}>
                            <div className="aspect-square relative">
                              <img
                                src={image.imageUrl}
                                alt={image.caption || image.imageType}
                                className="w-full h-full object-cover"
                              />
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
                    <div key={dateKey} className="mb-6 lg:mb-8">
                      <div className="flex items-center justify-between mb-4 lg:mb-6">
                        <h3 className="text-base lg:text-lg font-bold text-gray-900 flex items-center gap-2">
                          <svg className="w-4 h-4 lg:w-5 lg:h-5" style={{ color: '#daa450' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {dateKey}
                          <span className="ml-2 text-xs lg:text-sm font-normal text-gray-600">
                            ({groupedImages[dateKey].length} {groupedImages[dateKey].length === 1 ? 'image' : 'images'})
                          </span>
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
                        {groupedImages[dateKey].map((image) => {
                          const isSelected = selectedForComparison.includes(image.id);
                          return (
                            <div 
                              key={image.id} 
                              className="flex flex-col"
                              onClick={() => {
                                if (comparisonMode) {
                                  toggleImageSelection(image.id);
                                }
                              }}
                            >
                              <div 
                                className={`group relative aspect-square rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-lg cursor-pointer ${
                                  comparisonMode 
                                    ? isSelected 
                                      ? 'ring-2 shadow-md' 
                                      : 'border-gray-200 hover:border-gray-300'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                style={comparisonMode && isSelected ? { borderColor: '#daa450', ringColor: '#fef9e7' } : {}}
                              >
                                {comparisonMode && (
                                  <div className={`absolute top-2 right-2 z-10 w-7 h-7 lg:w-6 lg:h-6 rounded-full flex items-center justify-center transition-all shadow-md ${
                                    isSelected 
                                      ? 'text-white' 
                                      : 'bg-white border-2 border-gray-300'
                                  }`}
                                  style={isSelected ? { backgroundColor: '#daa450' } : {}}
                                  >
                                    {isSelected && (
                                      <svg className="w-4 h-4 lg:w-3.5 lg:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                
                                {/* Delete Button - Shows on Hover */}
                                {!comparisonMode && (
                                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(image.id);
                                      }}
                                      disabled={deletingId === image.id}
                                      className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[40px] min-h-[40px] flex items-center justify-center"
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
                              <div className="mt-2 text-center">
                                <p className="text-gray-700 text-sm font-semibold">
                                  {new Date(image.uploadedAt).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </p>
                              </div>
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
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
              setShowUploadModal(false);
              setSelectedFile(null);
              setCaption('');
              setImageType('progress');
              setOrientation('front');
            }}>
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-xl border border-gray-100 max-w-md w-full p-5 lg:p-8" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5 lg:mb-6">
                  <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Upload Progress Image</h2>
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setSelectedFile(null);
                      setCaption('');
                      setImageType('progress');
                      setOrientation('front');
                    }}
                    className="text-gray-600 hover:text-gray-800 transition-colors p-2 rounded-lg hover:bg-gray-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-5 lg:space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Image Type</label>
                    <select
                      value={imageType}
                      onChange={(e) => setImageType(e.target.value as any)}
                      className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white focus:ring-2 focus:outline-none transition-all text-sm lg:text-base min-h-[48px] lg:min-h-[44px]"
                      style={{ focusRingColor: '#daa450' }}
                      onFocus={(e) => e.target.style.borderColor = '#daa450'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    >
                      <option value="profile">Profile</option>
                      <option value="before">Before</option>
                      <option value="progress">Progress</option>
                      <option value="after">After</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      View <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value as any)}
                      className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white focus:ring-2 focus:outline-none transition-all text-sm lg:text-base min-h-[48px] lg:min-h-[44px]"
                      style={{ focusRingColor: '#daa450' }}
                      onFocus={(e) => e.target.style.borderColor = '#daa450'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                      required
                    >
                      <option value="front">Front</option>
                      <option value="back">Back</option>
                      <option value="side">Side</option>
                    </select>
                    <p className="text-xs text-gray-600 mt-2">Select the view angle for easy comparison</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white focus:ring-2 focus:outline-none transition-all text-sm lg:text-base file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 min-h-[48px] lg:min-h-[44px]"
                      style={{ focusRingColor: '#daa450' }}
                      onFocus={(e) => e.target.style.borderColor = '#daa450'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                    {selectedFile && (
                      <p className="mt-2 text-xs lg:text-sm text-gray-600">Selected: {selectedFile.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Caption (Optional)</label>
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Add a caption..."
                      className="w-full px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white focus:ring-2 focus:outline-none transition-all text-sm lg:text-base min-h-[48px] lg:min-h-[44px]"
                      style={{ focusRingColor: '#daa450' }}
                      onFocus={(e) => e.target.style.borderColor = '#daa450'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => {
                        setShowUploadModal(false);
                        setSelectedFile(null);
                        setCaption('');
                        setImageType('progress');
                        setOrientation('front');
                      }}
                      className="flex-1 px-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors font-semibold text-sm lg:text-base min-h-[48px] lg:min-h-[44px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={!selectedFile || uploading}
                      className="flex-1 px-4 py-3 lg:py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base min-h-[48px] lg:min-h-[44px]"
                      style={{ backgroundColor: '#daa450' }}
                      onMouseEnter={(e) => {
                        if (!uploading && selectedFile) {
                          e.currentTarget.style.backgroundColor = '#c89540';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!uploading && selectedFile) {
                          e.currentTarget.style.backgroundColor = '#daa450';
                        }
                      }}
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

      {/* Social Media Editor Modal */}
      {showSocialEditor && socialEditorImages.left && socialEditorImages.right && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Create Social Media Post</h2>
              <button
                onClick={() => setShowSocialEditor(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  Reposition and scale the images to create your 1:1 social media post. Drag images to move, use buttons to scale.
                </p>
              </div>

              {/* Canvas Area */}
              <div className="relative mx-auto mb-6" style={{ width: '100%', maxWidth: '600px', aspectRatio: '1/1' }}>
                <div 
                  id="social-editor-preview"
                  className="absolute inset-0 bg-gray-100 rounded-2xl border-4 border-gray-300 touch-none select-none overflow-hidden"
                >
                  {/* Left Image */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1/2 overflow-hidden cursor-move touch-none"
                    onMouseDown={(e) => handleMouseDown('left', e)}
                    onTouchStart={(e) => handleTouchStart('left', e)}
                    style={{ zIndex: dragging === 'left' ? 10 : 1 }}
                  >
                    <img
                      src={socialEditorImages.left.imageUrl}
                      alt="Left"
                      className="pointer-events-none"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: 'auto',
                        height: 'auto',
                        maxWidth: 'none',
                        maxHeight: 'none',
                        transform: `translate(-50%, -50%) translate(${imagePositions.left.x}px, ${imagePositions.left.y}px) scale(${imagePositions.left.scale})`,
                        transformOrigin: 'center center',
                        transition: dragging === 'left' ? 'none' : 'transform 0.1s ease-out',
                        objectFit: 'contain'
                      }}
                      draggable={false}
                      onLoad={(e) => {
                        // Calculate initial scale to fit image height to container height
                        const img = e.target as HTMLImageElement;
                        const container = img.parentElement;
                        if (container && img.naturalWidth > 0 && img.naturalHeight > 0) {
                          const containerHeight = container.offsetHeight;
                          
                          // Scale to fit height of container (1:1 box height)
                          // This scale will be applied to the natural image dimensions
                          const initialScale = containerHeight / img.naturalHeight;
                          
                          // Only set initial scale if positions are at default (first load)
                          setImagePositions(prev => {
                            if (prev.left.scale === 1 && prev.left.x === 0 && prev.left.y === 0) {
                              return { ...prev, left: { ...prev.left, scale: initialScale } };
                            }
                            return prev;
                          });
                        }
                      }}
                    />
                  </div>

                  {/* Divider Line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-400 transform -translate-x-1/2 pointer-events-none z-20"></div>

                  {/* Right Image */}
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1/2 overflow-hidden cursor-move touch-none"
                    onMouseDown={(e) => handleMouseDown('right', e)}
                    onTouchStart={(e) => handleTouchStart('right', e)}
                    style={{ zIndex: dragging === 'right' ? 10 : 1 }}
                  >
                    <img
                      src={socialEditorImages.right.imageUrl}
                      alt="Right"
                      className="pointer-events-none"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: 'auto',
                        height: 'auto',
                        maxWidth: 'none',
                        maxHeight: 'none',
                        transform: `translate(-50%, -50%) translate(${imagePositions.right.x}px, ${imagePositions.right.y}px) scale(${imagePositions.right.scale})`,
                        transformOrigin: 'center center',
                        transition: dragging === 'right' ? 'none' : 'transform 0.1s ease-out',
                        objectFit: 'contain'
                      }}
                      draggable={false}
                      onLoad={(e) => {
                        // Calculate initial scale to fit image height to container height
                        const img = e.target as HTMLImageElement;
                        const container = img.parentElement;
                        if (container && img.naturalWidth > 0 && img.naturalHeight > 0) {
                          const containerHeight = container.offsetHeight;
                          
                          // Scale to fit height of container (1:1 box height)
                          // This scale will be applied to the natural image dimensions
                          const initialScale = containerHeight / img.naturalHeight;
                          
                          // Only set initial scale if positions are at default (first load)
                          setImagePositions(prev => {
                            if (prev.right.scale === 1 && prev.right.x === 0 && prev.right.y === 0) {
                              return { ...prev, right: { ...prev.right, scale: initialScale } };
                            }
                            return prev;
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="space-y-4 sm:space-y-6">
                {/* Left Image Controls */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Left Image Controls</h3>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <button
                      onClick={() => handleScaleChange('left', -0.1)}
                      className="px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 text-sm"
                    >
                      Zoom Out
                    </button>
                    <span className="text-xs sm:text-sm text-gray-600">
                      Scale: {Math.round(imagePositions.left.scale * 100)}%
                    </span>
                    <button
                      onClick={() => handleScaleChange('left', 0.1)}
                      className="px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 text-sm"
                    >
                      Zoom In
                    </button>
                    <button
                      onClick={() => {
                        // Reset to fit height of container
                        const img = document.querySelector('[alt="Left"]') as HTMLImageElement;
                        if (img && img.naturalHeight > 0) {
                          const container = img.parentElement;
                          if (container) {
                            const containerHeight = container.offsetHeight;
                            const resetScale = containerHeight / img.naturalHeight;
                            setImagePositions(prev => ({ ...prev, left: {x: 0, y: 0, scale: resetScale} }));
                          }
                        } else {
                          setImagePositions(prev => ({ ...prev, left: {x: 0, y: 0, scale: 1} }));
                        }
                      }}
                      className="px-3 sm:px-4 py-2 bg-gray-200 border border-gray-300 rounded-lg hover:bg-gray-300 font-medium text-gray-700 text-sm"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Right Image Controls */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Right Image Controls</h3>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <button
                      onClick={() => handleScaleChange('right', -0.1)}
                      className="px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 text-sm"
                    >
                      Zoom Out
                    </button>
                    <span className="text-xs sm:text-sm text-gray-600">
                      Scale: {Math.round(imagePositions.right.scale * 100)}%
                    </span>
                    <button
                      onClick={() => handleScaleChange('right', 0.1)}
                      className="px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 text-sm"
                    >
                      Zoom In
                    </button>
                    <button
                      onClick={() => {
                        // Reset to fit height of container
                        const img = document.querySelector('[alt="Right"]') as HTMLImageElement;
                        if (img && img.naturalHeight > 0) {
                          const container = img.parentElement;
                          if (container) {
                            const containerHeight = container.offsetHeight;
                            const resetScale = containerHeight / img.naturalHeight;
                            setImagePositions(prev => ({ ...prev, right: {x: 0, y: 0, scale: resetScale} }));
                          }
                        } else {
                          setImagePositions(prev => ({ ...prev, right: {x: 0, y: 0, scale: 1} }));
                        }
                      }}
                      className="px-3 sm:px-4 py-2 bg-gray-200 border border-gray-300 rounded-lg hover:bg-gray-300 font-medium text-gray-700 text-sm"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Export Button */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowSocialEditor(false)}
                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={exportSocialMediaImage}
                    className="px-6 py-3 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                    style={{ backgroundColor: '#daa450' }}
                  >
                    Export Image
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </RoleProtected>
  );
}
