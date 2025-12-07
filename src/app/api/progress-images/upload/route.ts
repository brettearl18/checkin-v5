import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { getDb } from '@/lib/firebase-server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountString) {
      try {
        const serviceAccount = JSON.parse(serviceAccountString);
        const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
                             `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'checkinv5'}.appspot.com`;
        
        initializeApp({
          credential: cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'checkinv5',
          storageBucket: storageBucket
        });
        console.log('Firebase Admin initialized with storage bucket:', storageBucket);
      } catch (error) {
        console.error('Error initializing Firebase Admin:', error);
        throw error;
      }
    } else {
      throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
    }
  }
}

/**
 * POST /api/progress-images/upload
 * Upload image file to Firebase Storage and create progress image record
 * Form data:
 * - file: Image file
 * - clientId: Client ID
 * - coachId: Coach ID
 * - imageType: 'profile' | 'before' | 'after' | 'progress'
 * - caption?: Optional caption
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    initializeFirebaseAdmin();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('clientId') as string;
    const coachId = formData.get('coachId') as string;
    const imageType = formData.get('imageType') as string;
    const orientation = formData.get('orientation') as string;
    const caption = formData.get('caption') as string || '';

    console.log('Upload request received:', { clientId, coachId, imageType, fileName: file?.name });

    if (!file || !clientId || !coachId || !imageType || !orientation) {
      return NextResponse.json({
        success: false,
        message: 'file, clientId, coachId, imageType, and orientation are required',
        received: { hasFile: !!file, clientId, coachId, imageType, orientation }
      }, { status: 400 });
    }

    if (!['front', 'back', 'side'].includes(orientation)) {
      return NextResponse.json({
        success: false,
        message: 'orientation must be one of: front, back, side'
      }, { status: 400 });
    }

    if (!['profile', 'before', 'after', 'progress'].includes(imageType)) {
      return NextResponse.json({
        success: false,
        message: 'imageType must be one of: profile, before, after, progress'
      }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log('File converted to buffer, size:', buffer.length);

    // Upload to Firebase Storage
    let imageUrl: string;
    
    try {
      const storage = getStorage();
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 
                        `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'checkinv5'}.appspot.com`;
      
      console.log('Attempting to get storage bucket:', bucketName);
      
      const bucket = storage.bucket(bucketName);
      
      if (!bucket) {
        throw new Error(`Storage bucket ${bucketName} not found`);
      }

      // Sanitize filename
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `progress-images/${clientId}/${Date.now()}-${sanitizedFileName}`;
      const fileRef = bucket.file(fileName);

      console.log('Uploading to:', fileName);

      // Upload file
      const stream = fileRef.createWriteStream({
        metadata: {
          contentType: file.type || 'image/jpeg',
          metadata: {
            clientId,
            coachId,
            imageType,
            orientation,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('error', (error) => {
          console.error('Stream error:', error);
          reject(error);
        });
        stream.on('finish', () => {
          console.log('File upload stream finished');
          resolve();
        });
        stream.end(buffer);
      });

      console.log('File saved to storage');

      // Make file publicly accessible
      try {
        await fileRef.makePublic();
        console.log('File made public');
      } catch (publicError: any) {
        console.warn('Could not make file public (may already be public):', publicError.message);
      }

      // Get public URL
      imageUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      console.log('Image URL:', imageUrl);
    } catch (storageError: any) {
      console.error('Firebase Storage error details:', {
        message: storageError.message,
        code: storageError.code,
        stack: storageError.stack
      });
      
      // For now, throw the error with more details instead of using fallback
      // This will help us debug the actual issue
      throw new Error(`Storage upload failed: ${storageError.message}. Please ensure Firebase Storage is properly configured.`);
    }

    // Create progress image record in Firestore
    const db = getDb();
    
    // Get client name for display
    let clientName = 'Client';
    try {
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        clientName = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'Client';
      }
    } catch (error) {
      console.warn('Could not fetch client name:', error);
    }

    const imageData = {
      clientId,
      coachId,
      clientName,
      imageUrl,
      imageType,
      orientation,
      caption,
      uploadedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('progress_images').add(imageData);

    console.log('Progress image saved to Firestore:', {
      id: docRef.id,
      clientId: imageData.clientId,
      coachId: imageData.coachId,
      imageUrl: imageData.imageUrl.substring(0, 50) + '...',
      orientation: imageData.orientation
    });

    return NextResponse.json({
      success: true,
      message: 'Progress image uploaded successfully',
      data: {
        id: docRef.id,
        ...imageData,
        uploadedAt: imageData.uploadedAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error uploading progress image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    } : {};
    
    return NextResponse.json({
      success: false,
      message: `Failed to upload progress image: ${errorMessage}`,
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { details: errorDetails })
    }, { status: 500 });
  }
}

