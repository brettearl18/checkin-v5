'use client';

import { useState, useEffect, useRef } from 'react';
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
  currentAvatar?: string | null;
  clientId?: string | null;
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
  currentPersonalization,
  currentAvatar,
  clientId
}: ProfilePersonalizationModalProps) {
  const { userProfile } = useAuth();
  const [quote, setQuote] = useState('');
  const [showQuote, setShowQuote] = useState(true);
  const [colorTheme, setColorTheme] = useState('#daa450');
  const [icon, setIcon] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Image upload and cropping state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0, scale: 1 });
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (currentPersonalization) {
      setQuote(currentPersonalization.quote || '');
      setShowQuote(currentPersonalization.showQuote);
      setColorTheme(currentPersonalization.colorTheme || '#daa450');
      setIcon(currentPersonalization.icon || null);
    }
    // Reset image selection when modal opens
    if (isOpen) {
      setSelectedImage(null);
      setImagePosition({ x: 0, y: 0, scale: 1 });
    }
  }, [currentPersonalization, isOpen]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Read file as data URL
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedImage(dataUrl);
      
      // Load image to get dimensions
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
        // Calculate initial scale to fit image in 200px circle
        const containerSize = 200;
        const scale = Math.max(containerSize / img.width, containerSize / img.height);
        setImagePosition({ x: 0, y: 0, scale: scale });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedImage) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !selectedImage) return;
    setImagePosition({
      ...imagePosition,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!selectedImage) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - imagePosition.x, y: touch.clientY - imagePosition.y });
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || !selectedImage) return;
    const touch = e.touches[0];
    setImagePosition({
      ...imagePosition,
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Add/remove event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, imagePosition, dragStart, selectedImage]);

  // Crop image to circular shape
  const cropImageToCircle = async (imageSrc: string, outputSize: number = 400): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = outputSize;
          canvas.height = outputSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Create circular clipping path
          ctx.save();
          ctx.beginPath();
          ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
          ctx.clip();

          // Container size (the cropper display size)
          const containerSize = 200;
          const scale = imagePosition.scale;
          const offsetX = imagePosition.x;
          const offsetY = imagePosition.y;

          // Calculate image dimensions to fill container
          const imgAspect = img.width / img.height;
          let fitWidth, fitHeight;
          
          if (imgAspect > 1) {
            // Wider than tall - fit to height
            fitHeight = containerSize;
            fitWidth = containerSize * imgAspect;
          } else {
            // Taller than wide - fit to width
            fitWidth = containerSize;
            fitHeight = containerSize / imgAspect;
          }

          // Apply user's scale
          const scaledWidth = fitWidth * scale;
          const scaledHeight = fitHeight * scale;

          // Calculate where to draw the image
          // In the cropper, the image is centered and then offset
          const containerCenter = containerSize / 2;
          
          // Calculate the image center position in the container
          const imageCenterX = containerCenter + offsetX;
          const imageCenterY = containerCenter + offsetY;
          
          // Map to canvas coordinates (scale up from 200px container to outputSize)
          const scaleFactor = outputSize / containerSize;
          const canvasImageCenterX = imageCenterX * scaleFactor;
          const canvasImageCenterY = imageCenterY * scaleFactor;
          const canvasScaledWidth = scaledWidth * scaleFactor;
          const canvasScaledHeight = scaledHeight * scaleFactor;
          
          // Draw image centered at calculated position
          ctx.drawImage(
            img,
            canvasImageCenterX - canvasScaledWidth / 2,
            canvasImageCenterY - canvasScaledHeight / 2,
            canvasScaledWidth,
            canvasScaledHeight
          );

          ctx.restore();
          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageSrc;
    });
  };

  // Upload cropped image
  const handleImageUpload = async () => {
    if (!selectedImage || !clientId) {
      alert('Please select an image and ensure client ID is available');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      // Crop image to circle
      const croppedImageDataUrl = await cropImageToCircle(selectedImage, 400);

      // Convert data URL to blob
      const response = await fetch(croppedImageDataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'profile-image.png', { type: 'image/png' });

      // Get auth token
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

      const formData = new FormData();
      formData.append('file', file);
      if (clientId) {
        formData.append('clientId', clientId);
      }

      const headers: HeadersInit = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const uploadResponse = await fetch('/api/client-portal/profile-image', {
        method: 'POST',
        headers,
        body: formData,
      });

      const uploadResult = await uploadResponse.json();
      if (uploadResult.success) {
        // Image uploaded successfully, refresh user profile
        window.location.reload();
      } else {
        throw new Error(uploadResult.message || 'Failed to upload image');
      }
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

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

          {/* Profile Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Profile Photo
            </label>
            
            {!selectedImage ? (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  {currentAvatar ? 'Change Photo' : 'Upload Photo'}
                </button>
                {currentAvatar && (
                  <div className="mt-4 flex justify-center">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200">
                      <img src={currentAvatar} alt="Current profile" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Image Cropper */}
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-3">Reposition & Zoom:</p>
                  <div className="relative mx-auto" style={{ width: '200px', height: '200px' }}>
                    <div
                      ref={imageContainerRef}
                      className="relative w-full h-full rounded-full overflow-hidden border-4 border-gray-300 bg-gray-100"
                      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                      onMouseDown={handleMouseDown}
                      onTouchStart={handleTouchStart}
                    >
                      {selectedImage && (
                        <img
                          ref={imageRef}
                          src={selectedImage}
                          alt="Profile preview"
                          className="absolute select-none"
                          style={{
                            top: '50%',
                            left: '50%',
                            transform: `translate(-50%, -50%) translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imagePosition.scale})`,
                            width: imageDimensions.width > 0 ? `${imageDimensions.width}px` : '200px',
                            height: imageDimensions.height > 0 ? `${imageDimensions.height}px` : '200px',
                            maxWidth: 'none',
                            maxHeight: 'none',
                            objectFit: 'cover',
                            userSelect: 'none',
                            pointerEvents: 'none',
                            transformOrigin: 'center center',
                          }}
                          draggable={false}
                          onLoad={(e) => {
                            const img = e.target as HTMLImageElement;
                            if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                              setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                              // Set initial scale to fit
                              const containerSize = 200;
                              const scale = Math.max(containerSize / img.naturalWidth, containerSize / img.naturalHeight);
                              if (imagePosition.scale === 1 && imagePosition.x === 0 && imagePosition.y === 0) {
                                setImagePosition({ x: 0, y: 0, scale: scale });
                              }
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* Zoom Controls */}
                  <div className="mt-4 flex items-center justify-center space-x-4">
                    <button
                      onClick={() => setImagePosition({ ...imagePosition, scale: Math.max(0.5, imagePosition.scale - 0.1) })}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      −
                    </button>
                    <span className="text-sm text-gray-600">Zoom: {Math.round(imagePosition.scale * 100)}%</span>
                    <button
                      onClick={() => setImagePosition({ ...imagePosition, scale: Math.min(3, imagePosition.scale + 0.1) })}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      +
                    </button>
                  </div>

                  {/* Reset Position */}
                  <div className="mt-3 flex items-center justify-center space-x-2">
                    <button
                      onClick={() => setImagePosition({ x: 0, y: 0, scale: 1 })}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Reset Position
                    </button>
                    <span className="text-gray-400">|</span>
                    <button
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePosition({ x: 0, y: 0, scale: 1 });
                      }}
                      className="text-xs text-red-600 hover:text-red-800 underline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Upload Button */}
                <button
                  onClick={handleImageUpload}
                  disabled={uploadingImage}
                  className="w-full py-3 px-4 rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: colorTheme }}
                >
                  {uploadingImage ? 'Uploading...' : 'Save Photo'}
                </button>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">Preview:</p>
            <div className="rounded-xl p-4" style={{ backgroundColor: colorTheme }}>
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {(selectedImage || currentAvatar || userProfile?.avatar) ? (
                    <div className="relative w-full h-full rounded-full overflow-hidden">
                      {selectedImage ? (
                        <img
                          src={selectedImage}
                          alt={clientName}
                          className="absolute top-1/2 left-1/2 w-full h-full object-cover"
                          style={{
                            transform: `translate(-50%, -50%) translate(${imagePosition.x * 0.3}px, ${imagePosition.y * 0.3}px) scale(${imagePosition.scale * 0.3})`,
                            minWidth: '100%',
                            minHeight: '100%',
                          }}
                        />
                      ) : (
                        <img 
                          src={currentAvatar || userProfile?.avatar || ''} 
                          alt={clientName} 
                          className="w-full h-full object-cover" 
                        />
                      )}
                    </div>
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

