import { NextRequest, NextResponse } from 'next/server';
import { getDb, getStorageInstance } from '@/lib/firebase-server';

/**
 * DELETE /api/progress-images/[id]
 * Delete a progress image
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Image ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Get the image document first
    const imageDoc = await db.collection('progress_images').doc(id).get();
    
    if (!imageDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Image not found'
      }, { status: 404 });
    }

    const imageData = imageDoc.data();
    const imageUrl = imageData?.imageUrl;

    // Delete from Firestore
    await db.collection('progress_images').doc(id).delete();
    console.log(`Deleted progress image ${id} from Firestore`);

    // Try to delete from Firebase Storage if it's a storage URL
    if (imageUrl && imageUrl.startsWith('https://storage.googleapis.com/')) {
      try {
        const storage = getStorageInstance();
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
                          `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'checkinv5'}.appspot.com`;
        const bucket = storage.bucket(bucketName);
        
        // Extract file path from URL
        const urlParts = imageUrl.split('/');
        const filePath = urlParts.slice(4).join('/'); // Remove https://storage.googleapis.com/bucket-name/
        
        const fileRef = bucket.file(filePath);
        const exists = await fileRef.exists();
        
        if (exists[0]) {
          await fileRef.delete();
          console.log(`Deleted image file from Storage: ${filePath}`);
        } else {
          console.warn(`File not found in Storage: ${filePath}`);
        }
      } catch (storageError: any) {
        console.warn('Could not delete from Storage (file may not exist):', storageError.message);
        // Continue even if storage deletion fails - Firestore record is already deleted
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Progress image deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting progress image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Delete error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({
      success: false,
      message: `Failed to delete progress image: ${errorMessage}`,
      error: errorMessage
    }, { status: 500 });
  }
}

