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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    
    const docRef = await db.collection('clients').doc(clientId).get();
    
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
    const { id: clientId } = await params;
    const updateData = await request.json();

    // Remove fields that shouldn't be updated
    const { id, createdAt, ...dataToUpdate } = updateData;
    
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