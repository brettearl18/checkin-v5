import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shortUID = searchParams.get('shortUID');

    if (!shortUID) {
      return NextResponse.json({
        success: false,
        message: 'Short UID is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Find coach by shortUID
    const coachesSnapshot = await db.collection('coaches')
      .where('shortUID', '==', shortUID)
      .limit(1)
      .get();

    if (coachesSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'Coach not found with this short UID'
      }, { status: 404 });
    }

    const coachDoc = coachesSnapshot.docs[0];
    const coachData = coachDoc.data();

    return NextResponse.json({
      success: true,
      coach: {
        id: coachDoc.id,
        shortUID: coachData.shortUID,
        firstName: coachData.firstName,
        lastName: coachData.lastName,
        email: coachData.email,
        specialization: coachData.specialization,
        bio: coachData.bio
      }
    });

  } catch (error) {
    console.error('Error looking up coach:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to look up coach',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
