import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET() {
  try {
    console.log('Testing Firebase connection...');
    
    // Check if environment variable is set
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountString) {
      return NextResponse.json({
        success: false,
        error: 'FIREBASE_SERVICE_ACCOUNT environment variable not set'
      });
    }

    // Try to parse the service account
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountString);
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse FIREBASE_SERVICE_ACCOUNT',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Try to get Firestore instance
    const db = getDb();
    
    // Try a simple operation
    const testDoc = db.collection('test').doc('connection-test');
    await testDoc.set({
      timestamp: new Date(),
      message: 'Firebase connection test'
    });

    // Clean up
    await testDoc.delete();

    return NextResponse.json({
      success: true,
      message: 'Firebase connection successful!',
      projectId: serviceAccount.project_id
    });

  } catch (error) {
    console.error('Firebase test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Firebase connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
