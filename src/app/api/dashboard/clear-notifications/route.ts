import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function POST(request: NextRequest) {
  try {
    const { coachId } = await request.json();
    
    if (!coachId) {
      return NextResponse.json(
        { error: 'Coach ID is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // For now, we'll clear the recent activity by marking them as "cleared"
    // In a real implementation, you might want to store this in a separate collection
    // or add a "cleared" field to existing activities
    
    // Get all recent activities for this coach
    const activitiesQuery = db.collection('recent_activities')
      .where('coachId', '==', coachId)
      .where('cleared', '==', false);
    
    const activitiesSnapshot = await activitiesQuery.get();
    
    // Mark all activities as cleared
    const batch = db.batch();
    activitiesSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { cleared: true, clearedAt: new Date() });
    });
    
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'All notifications cleared successfully',
      clearedCount: activitiesSnapshot.size
    });

  } catch (error) {
    console.error('Error clearing notifications:', error);
    return NextResponse.json(
      { error: 'Failed to clear notifications' },
      { status: 500 }
    );
  }
}
