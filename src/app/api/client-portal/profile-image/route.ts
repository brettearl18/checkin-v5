import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { getStorageInstance } from '@/lib/firebase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/client-portal/profile-image
 * Upload profile image for a client
 */
export async function POST(request: NextRequest) {
  const db = getDb();
  const storage = getStorageInstance();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('clientId') as string;

    if (!file || !clientId) {
      return NextResponse.json({
        success: false,
        message: 'file and clientId are required'
      }, { status: 400 });
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
    await db.collection('clients').doc(clientId).update({
      profileImage: imageUrl,
      updatedAt: new Date()
    });

    // Also update in users collection if it exists
    const clientDoc = await db.collection('clients').doc(clientId).get();
    const clientData = clientDoc.data();
    if (clientData?.authUid) {
      await db.collection('users').doc(clientData.authUid).set({
        avatar: imageUrl,
        'profile.avatar': imageUrl,
        updatedAt: new Date()
      }, { merge: true });
    }

    return NextResponse.json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        imageUrl
      }
    });

  } catch (error) {
    console.error('Error uploading profile image:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to upload profile image',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}



