import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/platform-updates/[id]
 * Update an existing platform update (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;
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

    // Check if update exists
    const docRef = db.collection('platform_updates').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Update not found' },
        { status: 404 }
      );
    }

    // Convert date string to Firestore Timestamp
    const updateDate = Timestamp.fromDate(new Date(date));

    await docRef.update({
      date: updateDate,
      category,
      title,
      description,
      details: details || null,
      status,
      impact: impact || null,
      updatedAt: Timestamp.now(),
      updatedBy: user.email || user.uid,
    });

    logInfo('Platform update updated', {
      id,
      title: title.substring(0, 50),
      updatedBy: user.email || user.uid,
    });

    return NextResponse.json({
      success: true,
      message: 'Update updated successfully',
    });

  } catch (error: any) {
    logSafeError('Error updating platform update', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update platform update',
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/platform-updates/[id]
 * Delete a platform update (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;

    const db = getDb();

    const docRef = db.collection('platform_updates').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: 'Update not found' },
        { status: 404 }
      );
    }

    await docRef.delete();

    logInfo('Platform update deleted', {
      id,
      deletedBy: user.email || user.uid,
    });

    return NextResponse.json({
      success: true,
      message: 'Update deleted successfully',
    });

  } catch (error: any) {
    logSafeError('Error deleting platform update', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete platform update',
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

