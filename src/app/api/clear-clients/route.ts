import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  });
}

const db = getFirestore();

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'clear') {
      console.log('Clearing all clients from Firestore...');
      
      // Get all clients
      const clientsSnapshot = await db.collection('clients').get();
      
      if (clientsSnapshot.empty) {
        return NextResponse.json({
          success: true,
          message: 'No clients found to clear',
          deletedCount: 0
        });
      }
      
      // Delete all clients in batches
      const batch = db.batch();
      let deletedCount = 0;
      
      clientsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      await batch.commit();
      
      console.log(`Successfully deleted ${deletedCount} clients`);
      
      return NextResponse.json({
        success: true,
        message: `Successfully cleared ${deletedCount} clients`,
        deletedCount
      });
      
    } else {
      return NextResponse.json({
        success: false,
        message: 'Invalid action. Use "clear" to remove all clients'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error clearing clients:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to clear clients',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 