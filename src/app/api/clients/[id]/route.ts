import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase-server';

// GET - Fetch a specific client by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;
    const db = getDb();
    const clientRef = doc(db, 'clients', clientId);
    const clientDoc = await getDoc(clientRef);
    
    if (!clientDoc.exists()) {
      return NextResponse.json(
        { success: false, message: 'Client not found' },
        { status: 404 }
      );
    }
    
    const client = {
      id: clientDoc.id,
      ...clientDoc.data()
    };
    
    return NextResponse.json({
      success: true,
      client
    });
    
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch client' },
      { status: 500 }
    );
  }
} 