import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { getStorageInstance } from '@/lib/firebase-server';
import { requireAuth } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/client-portal/profile-image
 * Upload profile image for a client
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Already an error response
    }

    const { user } = authResult;

    // Verify user is a client
    if (!user.isClient) {
      return NextResponse.json(
        { success: false, message: 'Only clients can upload profile images' },
        { status: 403 }
      );
    }

    const db = getDb();
    const storage = getStorageInstance();
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientIdFromForm = formData.get('clientId') as string;

    if (!file) {
      return NextResponse.json({
        success: false,
        message: 'File is required'
      }, { status: 400 });
    }

    // File size validation (5MB max for images)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      }, { status: 400 });
    }

    // MIME type validation (allow only image types)
    const ALLOWED_MIME_TYPES = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    
    if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json({
        success: false,
        message: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      }, { status: 400 });
    }

    // Get client document - try multiple methods
    let clientDoc = await db.collection('clients').doc(user.uid).get();
    let clientId = user.uid;
    
    if (!clientDoc.exists) {
      // Try by authUid
      const clientQuery = await db.collection('clients').where('authUid', '==', user.uid).limit(1).get();
      if (!clientQuery.empty) {
        clientDoc = clientQuery.docs[0];
        clientId = clientDoc.id;
      }
    }

    // If clientId was provided in form and matches, use it; otherwise use what we found
    if (clientIdFromForm && clientIdFromForm !== clientId) {
      // Verify the provided clientId belongs to this user
      const providedClientDoc = await db.collection('clients').doc(clientIdFromForm).get();
      if (providedClientDoc.exists) {
        const providedClientData = providedClientDoc.data();
        if (providedClientData?.authUid === user.uid) {
          clientDoc = providedClientDoc;
          clientId = clientIdFromForm;
        }
      }
    }

    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        message: 'File must be an image'
      }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Firebase Storage
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '';
    const fileName = `profile-images/${clientId}/${Date.now()}_${file.name}`;
    
    const bucket = storage.bucket(bucketName);
    const fileRef = bucket.file(fileName);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
      },
      public: true,
    });

    // Get public URL
    const imageUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

    // Update client document with profile image URL
    const { Timestamp } = await import('firebase-admin/firestore');
    await db.collection('clients').doc(clientId).update({
      profileImage: imageUrl,
      avatar: imageUrl, // Also store as avatar for compatibility
      updatedAt: Timestamp.now()
    });

    // Also update in users collection if it exists
    const clientData = clientDoc.data();
    if (clientData?.authUid) {
      await db.collection('users').doc(clientData.authUid).set({
        avatar: imageUrl,
        'profile.avatar': imageUrl,
        updatedAt: Timestamp.now()
      }, { merge: true });
    }

    logInfo('Profile image uploaded successfully', { userId: user.uid, clientId });

    return NextResponse.json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        imageUrl
      }
    });

  } catch (error: any) {
    logSafeError('Error uploading profile image', error, { userId: 'unknown' });
    return NextResponse.json({
      success: false,
      message: 'Failed to upload profile image',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}








