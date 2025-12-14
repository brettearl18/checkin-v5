import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    
    // Fetch all coaches
    const coachesSnapshot = await db.collection('coaches').get();
    
    const coaches = coachesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email || 'No email',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        status: data.status || 'unknown',
        specialization: data.specialization || ''
      };
    });
    
    // Sort by email
    coaches.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    
    return NextResponse.json({
      success: true,
      count: coaches.length,
      coaches: coaches
    });

  } catch (error) {
    console.error('Error fetching coaches:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch coaches',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

