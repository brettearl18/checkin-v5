import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

export async function GET() {
  try {
    // Test accessing a client document
    const clientDoc = await getDoc(doc(db, 'clients', 'client-mockup-001'));
    
    if (clientDoc.exists()) {
      return NextResponse.json({
        success: true,
        message: 'Client data access successful',
        client: { id: clientDoc.id, ...clientDoc.data() }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Client document not found',
        clientId: 'client-mockup-001'
      });
    }
  } catch (error) {
    console.error('Error accessing client data:', error);
    return NextResponse.json({
      success: false,
      message: 'Error accessing client data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 