import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { optionalAuth } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client-portal/platform-updates
 * Fetch all platform updates for clients
 * Public endpoint - no authentication required (changelog is public info)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    // Fetch all platform updates, ordered by date (newest first)
    const updatesSnapshot = await db.collection('platform_updates')
      .orderBy('date', 'desc')
      .get();

    const updates = updatesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date?.toDate?.()?.toISOString() || data.date || new Date().toISOString(),
        category: data.category || 'other',
        title: data.title || '',
        description: data.description || '',
        details: data.details || undefined,
        status: data.status || 'completed',
        impact: data.impact || undefined,
      };
    });

    logInfo('Platform updates fetched', { count: updates.length, userId: user.uid });

    return NextResponse.json({
      success: true,
      updates,
    });

  } catch (error: any) {
    logSafeError('Error fetching platform updates', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch platform updates',
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

