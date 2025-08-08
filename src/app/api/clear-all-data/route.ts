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
      console.log('Clearing all test data from Firestore...');
      
      const collections = [
        'clients',
        'check_in_assignments', 
        'formResponses'
      ];
      
      const results: any = {};
      
      for (const collectionName of collections) {
        try {
          const snapshot = await db.collection(collectionName).get();
          
          if (snapshot.empty) {
            results[collectionName] = { deletedCount: 0, status: 'empty' };
            continue;
          }
          
          // Delete all documents in batches
          const batch = db.batch();
          let deletedCount = 0;
          
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            deletedCount++;
          });
          
          await batch.commit();
          
          results[collectionName] = { deletedCount, status: 'success' };
          console.log(`Cleared ${deletedCount} documents from ${collectionName}`);
          
        } catch (error) {
          console.error(`Error clearing ${collectionName}:`, error);
          results[collectionName] = { 
            deletedCount: 0, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      }
      
      const totalDeleted = Object.values(results).reduce((sum: any, result: any) => sum + result.deletedCount, 0);
      
      return NextResponse.json({
        success: true,
        message: `Successfully cleared ${totalDeleted} documents across all collections`,
        results,
        totalDeleted
      });
      
    } else {
      return NextResponse.json({
        success: false,
        message: 'Invalid action. Use "clear" to remove all test data'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error clearing all data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to clear all data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 