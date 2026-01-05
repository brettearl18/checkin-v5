/**
 * Client-side image compression utility
 * 
 * Resizes and compresses images before upload to reduce file size,
 * improve upload speed, and reduce storage costs.
 */

import imageCompression from 'browser-image-compression';

export interface ImageCompressionOptions {
  maxSizeMB?: number; // Maximum file size in MB (default: 1MB)
  maxWidthOrHeight?: number; // Maximum width or height in pixels (default: 1920px)
  useWebWorker?: boolean; // Use web worker for better performance (default: true)
  quality?: number; // Image quality 0-1 (default: 0.8)
  fileType?: string; // Output file type (default: keep original)
}

const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxSizeMB: 1, // 1MB max file size
  maxWidthOrHeight: 1920, // Max 1920px width or height (good for mobile/desktop viewing)
  useWebWorker: true, // Use web worker for better performance
  quality: 0.8, // 80% quality (good balance between size and quality)
  fileType: '', // Keep original file type
};

/**
 * Compress and resize an image file
 * 
 * @param file - The original image file
 * @param options - Compression options
 * @returns Compressed image file
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  try {
    // Merge user options with defaults
    const compressionOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    // Remove empty fileType to keep original
    if (!compressionOptions.fileType) {
      delete compressionOptions.fileType;
    }

    console.log('Compressing image:', {
      originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      originalType: file.type,
      options: compressionOptions,
    });

    // Compress the image
    const compressedFile = await imageCompression(file, compressionOptions);

    console.log('Image compressed:', {
      originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      compressedSize: `${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
      reduction: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`,
      originalType: file.type,
      compressedType: compressedFile.type,
    });

    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    // If compression fails, return original file
    // This ensures uploads still work even if compression has issues
    console.warn('Image compression failed, using original file');
    return file;
  }
}

/**
 * Check if an image needs compression
 * 
 * @param file - The image file to check
 * @param maxSizeMB - Maximum size in MB before compression is needed
 * @returns True if compression is recommended
 */
export function shouldCompressImage(file: File, maxSizeMB: number = 1): boolean {
  const fileSizeMB = file.size / 1024 / 1024;
  return fileSizeMB > maxSizeMB;
}

/**
 * Get image dimensions from a file
 * 
 * @param file - The image file
 * @returns Promise with width and height
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height,
      });
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    img.src = url;
  });
}

