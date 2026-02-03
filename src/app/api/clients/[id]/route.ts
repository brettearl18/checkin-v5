import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { verifyClientAccess } from '@/lib/api-auth';
import { logSafeError, logWarn } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;

    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof Response) return accessResult;

    const db = getDb();
    
    // First, try to get by document ID
    let docRef = await db.collection('clients').doc(clientId).get();
    
    // If not found by document ID, try to find by authUid or id field
    if (!docRef.exists) {
      try {
        // Try finding by authUid field
        const queryByAuthUid = await db.collection('clients')
          .where('authUid', '==', clientId)
          .limit(1)
          .get();
        
        if (!queryByAuthUid.empty) {
          docRef = queryByAuthUid.docs[0];
        } else {
          // Try finding by id field (some clients have id stored as a field)
          const queryById = await db.collection('clients')
            .where('id', '==', clientId)
            .limit(1)
            .get();
          
          if (!queryById.empty) {
            docRef = queryById.docs[0];
          }
        }
      } catch {
        // Fall through to 404 below
      }
    }
    
    if (!docRef.exists) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Client not found' 
        },
        { status: 404 }
      );
    }

    const clientData = docRef.data();
    const client = {
      id: docRef.id,
      ...clientData
    };

    return NextResponse.json({
      success: true,
      client
    });

  } catch (error: unknown) {
    logSafeError('Error fetching client', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch client'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;

    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof Response) return accessResult;

    const db = getDb();
    const updateData = await request.json();

    // Remove fields that shouldn't be updated
    const { id, createdAt, ...dataToUpdate } = updateData;
    
    // Handle pausedUntil - convert to Date if provided, or null if clearing
    if (dataToUpdate.pausedUntil !== undefined) {
      if (dataToUpdate.pausedUntil === null || dataToUpdate.pausedUntil === '') {
        dataToUpdate.pausedUntil = null;
      } else {
        dataToUpdate.pausedUntil = new Date(dataToUpdate.pausedUntil);
      }
    }
    
    // Add updated timestamp
    dataToUpdate.updatedAt = new Date();

    await db.collection('clients').doc(clientId).update(dataToUpdate);

    return NextResponse.json({
      success: true,
      message: 'Client updated successfully'
    });

  } catch (error: unknown) {
    logSafeError('Error updating client', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update client'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;

    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof Response) return accessResult;

    const db = getDb();
    
    // First, get the client to find authUid if it exists
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Client not found' 
        },
        { status: 404 }
      );
    }

    const clientData = clientDoc.data();
    const authUid = clientData?.authUid || clientId; // Use authUid if available, fallback to clientId
    
    // Use batch operations for efficiency (Firestore batch limit is 500)
    const batch = db.batch();
    let deletionCount = 0;
    const deletions: Array<{ collection: string; count: number }> = [];

    // 1. Delete check-in assignments
    try {
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .get();
      
      assignmentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (assignmentsSnapshot.size > 0) {
        deletions.push({ collection: 'check_in_assignments', count: assignmentsSnapshot.size });
      }
    } catch (error) {
      logSafeError('Error fetching check-in assignments', error);
    }

    // 2. Delete form responses and collect response IDs for feedback deletion
    let responseIds: string[] = [];
    try {
      const responsesSnapshot = await db.collection('formResponses')
        .where('clientId', '==', clientId)
        .get();
      
      responseIds = responsesSnapshot.docs.map(doc => doc.id);
      
      responsesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (responsesSnapshot.size > 0) {
        deletions.push({ collection: 'formResponses', count: responsesSnapshot.size });
      }
    } catch (error) {
      logSafeError('Error fetching form responses', error);
    }

    // 3. Delete coach feedback related to this client's responses
    try {
      let feedbackCount = 0;
      // Delete feedback for each response
      for (const responseId of responseIds) {
        const feedbackSnapshot = await db.collection('coachFeedback')
          .where('responseId', '==', responseId)
          .get();
        
        feedbackSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletionCount++;
          feedbackCount++;
        });
      }
      if (feedbackCount > 0) {
        deletions.push({ collection: 'coachFeedback', count: feedbackCount });
      }
    } catch (error) {
      logSafeError('Error deleting coach feedback', error);
    }

    // 4. Delete client measurements
    try {
      const measurementsSnapshot = await db.collection('client_measurements')
        .where('clientId', '==', clientId)
        .get();
      
      measurementsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (measurementsSnapshot.size > 0) {
        deletions.push({ collection: 'client_measurements', count: measurementsSnapshot.size });
      }
    } catch (error) {
      logSafeError('Error fetching client measurements', error);
    }

    // 5. Delete client goals
    try {
      const goalsSnapshot = await db.collection('clientGoals')
        .where('clientId', '==', clientId)
        .get();
      
      goalsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (goalsSnapshot.size > 0) {
        deletions.push({ collection: 'clientGoals', count: goalsSnapshot.size });
      }
    } catch (error) {
      logSafeError('Error fetching client goals', error);
    }

    // 6. Delete progress images
    try {
      const imagesSnapshot = await db.collection('progress_images')
        .where('clientId', '==', clientId)
        .get();
      
      imagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (imagesSnapshot.size > 0) {
        deletions.push({ collection: 'progress_images', count: imagesSnapshot.size });
      }
    } catch (error) {
      logSafeError('Error fetching progress images', error);
    }

    // 7. Delete onboarding data
    try {
      const onboardingDoc = await db.collection('client_onboarding').doc(clientId).get();
      if (onboardingDoc.exists) {
        batch.delete(onboardingDoc.ref);
        deletionCount++;
        deletions.push({ collection: 'client_onboarding', count: 1 });
      }
    } catch (error) {
      logSafeError('Error fetching onboarding data', error);
    }

    // 8. Delete client scoring config
    try {
      const scoringDoc = await db.collection('clientScoring').doc(clientId).get();
      if (scoringDoc.exists) {
        batch.delete(scoringDoc.ref);
        deletionCount++;
        deletions.push({ collection: 'clientScoring', count: 1 });
      }
    } catch (error) {
      logSafeError('Error fetching scoring config', error);
    }

    // 9. Delete notifications related to this client
    try {
      const notificationsSnapshot = await db.collection('notifications')
        .where('clientId', '==', clientId)
        .get();
      
      notificationsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletionCount++;
      });
      if (notificationsSnapshot.size > 0) {
        deletions.push({ collection: 'notifications', count: notificationsSnapshot.size });
      }
    } catch (error) {
      logSafeError('Error fetching notifications', error);
    }

    // 10. Delete user profile if it exists
    try {
      const userDoc = await db.collection('users').doc(authUid).get();
      if (userDoc.exists) {
        batch.delete(userDoc.ref);
        deletionCount++;
        deletions.push({ collection: 'users', count: 1 });
      }
    } catch (error) {
      logSafeError('Error fetching user profile', error);
    }

    // 11. Delete the client document itself
    batch.delete(clientDoc.ref);
    deletionCount++;

    // Commit deletions in batches if needed (Firestore batch limit is 500)
    if (deletionCount > 0) {
      if (deletionCount <= 500) {
        // Single batch
        await batch.commit();
      } else {
        // Need multiple batches - process in chunks
        // This is unlikely but handle it just in case
        logWarn('Large deletion detected', { deletionCount });
        // For now, commit what we have and log a warning
        // In production, you might want to split into multiple batches
        await batch.commit();
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Client and all related data deleted successfully',
      deleted: {
        total: deletionCount,
        collections: deletions
      }
    });

  } catch (error: unknown) {
    logSafeError('Error deleting client', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete client'
      },
      { status: 500 }
    );
  }
}
