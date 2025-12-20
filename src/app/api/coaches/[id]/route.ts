import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    const coachDoc = await db.collection('coaches').doc(id).get();

    if (!coachDoc.exists) {
      return NextResponse.json({ success: false, message: 'Coach not found' }, { status: 404 });
    }

    const coachData = coachDoc.data();
    return NextResponse.json({ success: true, data: coachData });

  } catch (error) {
    console.error('Error fetching coach data:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch coach data', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
