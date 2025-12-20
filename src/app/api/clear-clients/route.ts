import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// Initialize Firebase Admin if not already initialized



export async function POST(request: NextRequest) {
  const db = getDb();
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
