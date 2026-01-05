import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/platform-updates
 * Fetch all platform updates (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const db = getDb();

    const updatesSnapshot = await db.collection('platform_updates')
      .orderBy('date', 'desc')
      .get();

    const updates = updatesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date?.toDate?.()?.toISOString() || data.date || new Date().toISOString(),
        category: data.category || 'bug-fix',
        title: data.title || '',
        description: data.description || '',
        details: data.details || undefined,
        status: data.status || 'completed',
        impact: data.impact || undefined,
      };
    });

    return NextResponse.json({
      success: true,
      updates,
    });

  } catch (error: any) {
    logSafeError('Error fetching platform updates (admin)', error);
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

/**
 * POST /api/admin/platform-updates
 * Create a new platform update (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();

    const {
      date,
      category,
      title,
      description,
      details,
      status,
      impact,
    } = body;

    // Validate required fields
    if (!date || !category || !title || !description || !status) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Convert date string to Firestore Timestamp
    const updateDate = Timestamp.fromDate(new Date(date));

    const updateData = {
      date: updateDate,
      category,
      title,
      description,
      details: details || null,
      status,
      impact: impact || null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: user.email || user.uid,
    };

    const docRef = await db.collection('platform_updates').add(updateData);

    logInfo('Platform update created', {
      id: docRef.id,
      title: title.substring(0, 50),
      createdBy: user.email || user.uid,
    });

    return NextResponse.json({
      success: true,
      message: 'Update created successfully',
      id: docRef.id,
    });

  } catch (error: any) {
    logSafeError('Error creating platform update', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create platform update',
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

