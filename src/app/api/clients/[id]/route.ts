import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: clientId } = await params;
    
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
      } catch (queryError) {
        console.log('Error querying by authUid or id:', queryError);
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

  } catch (error: any) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
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
    const db = getDb();
    const { id: clientId } = await params;
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

  } catch (error: any) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
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
    const db = getDb();
    const { id: clientId } = await params;
    
    await db.collection('clients').doc(clientId).delete();

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    );
  }
}
