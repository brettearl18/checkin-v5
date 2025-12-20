import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
export const dynamic = 'force-dynamic';

// Helper function to remove undefined values
function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined).filter(item => item !== null);
  }
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = removeUndefined(value);
    }
  }
  return cleaned;
}

// GET - Fetch scoring configuration for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientId = await params.id;
    const db = getDb();
    const scoringDoc = await db.collection('clientScoring').doc(clientId).get();
    
    if (!scoringDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Scoring configuration not found' },
        { status: 404 }
      );
    }
    
    const config = {
      id: scoringDoc.id,
      ...scoringDoc.data()
    };
    
    return NextResponse.json({
      success: true,
      config
    });
    
  } catch (error) {
    console.error('Error fetching scoring config:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch scoring configuration' },
      { status: 500 }
    );
  }
}

// POST - Create or update scoring configuration for a client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const clientId = await params.id;
    const formData = await request.json();
    
    // Clean the data
    const cleanedData = removeUndefined(formData);
    
    // Add timestamps
    const configData = {
      ...cleanedData,
      clientId,
      updatedAt: new Date()
    };
    
    // If this is a new config, add createdAt
    if (!cleanedData.createdAt) {
      configData.createdAt = new Date();
    }
    
    // Save to Firestore
    await db.collection('clientScoring').doc(clientId).set(configData, { merge: true });
    
    return NextResponse.json({
      success: true,
      message: 'Scoring configuration saved successfully',
      clientId
    });
    
  } catch (error) {
    console.error('Error saving scoring config:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save scoring configuration' },
      { status: 500 }
    );
  }
}
