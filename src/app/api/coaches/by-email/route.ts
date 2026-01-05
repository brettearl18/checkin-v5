import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({
        success: false,
        message: 'Email parameter is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Find coach by email
    const coachesSnapshot = await db.collection('coaches')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (coachesSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'Coach not found with this email'
      }, { status: 404 });
    }

    const coachDoc = coachesSnapshot.docs[0];
    const coachData = coachDoc.data();

    return NextResponse.json({
      success: true,
      coach: {
        id: coachDoc.id,
        email: coachData.email,
        firstName: coachData.firstName || '',
        lastName: coachData.lastName || '',
        shortUID: coachData.shortUID || null,
        status: coachData.status || 'unknown',
        specialization: coachData.specialization || ''
      }
    });

  } catch (error) {
    console.error('Error fetching coach by email:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch coach',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}








