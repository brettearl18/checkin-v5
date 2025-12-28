import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    
    // Fetch all active coaches
    const coachesSnapshot = await db.collection('coaches').get();
    
    const coaches = coachesSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email || 'No email',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          status: data.status || 'unknown',
          specialization: data.specialization || ''
        };
      })
      .filter(coach => coach.status === 'active' || coach.status === 'unknown'); // Filter active coaches
    
    // Sort by name (last name, then first name)
    coaches.sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.trim().toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
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
