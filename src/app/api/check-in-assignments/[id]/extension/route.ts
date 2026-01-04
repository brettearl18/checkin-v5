import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAuth } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/check-in-assignments/[id]/extension
 * Request an extension for a check-in assignment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Assignment ID is required'
      }, { status: 400 });
    }

    const requestData = await request.json();
    const { reason } = requestData;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Reason is required'
      }, { status: 400 });
    }

    if (reason.trim().length < 10) {
      return NextResponse.json({
        success: false,
        message: 'Please provide a more detailed reason (at least 10 characters)'
      }, { status: 400 });
    }

    const db = getDb();

    // Get the assignment - try as document ID first, then query by 'id' field
    let assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    let assignmentData = assignmentDoc.exists ? assignmentDoc.data() : null;
    let assignmentDocId = assignmentDoc.exists ? assignmentDoc.id : null;

    // If not found by document ID, try querying by 'id' field
    if (!assignmentDoc.exists) {
      const assignmentsQuery = await db.collection('check_in_assignments')
        .where('id', '==', id)
        .where('clientId', '==', user.uid)
        .limit(1)
        .get();
      
      if (!assignmentsQuery.empty) {
        assignmentDoc = assignmentsQuery.docs[0];
        assignmentData = assignmentDoc.data();
        assignmentDocId = assignmentDoc.id;
      }
    }

    if (!assignmentData || !assignmentDocId) {
      return NextResponse.json({
        success: false,
        message: 'Assignment not found'
      }, { status: 404 });
    }

    // Verify the assignment belongs to this client
    if (assignmentData.clientId !== user.uid) {
      // Also check by authUid if clientId is different
      const clientDoc = await db.collection('clients').doc(assignmentData.clientId).get();
      const clientData = clientDoc.exists ? clientDoc.data() : null;
      
      if (!clientData || clientData.authUid !== user.uid) {
        return NextResponse.json({
          success: false,
          message: 'Unauthorized: This assignment does not belong to you'
        }, { status: 403 });
      }
    }

    // Check if assignment is already completed
    if (assignmentData.status === 'completed' || assignmentData.completedAt) {
      return NextResponse.json({
        success: false,
        message: 'Cannot request extension for a completed check-in'
      }, { status: 400 });
    }

    // Check if extension already exists and is granted
    const existingExtensionsQuery = await db.collection('check_in_extensions')
      .where('assignmentId', '==', assignmentDocId)
      .where('status', '==', 'granted')
      .limit(1)
      .get();

    if (!existingExtensionsQuery.empty) {
      return NextResponse.json({
        success: true,
        message: 'Extension already granted for this check-in',
        extensionGranted: true
      });
    }

    // Create extension request
    const extensionData = {
      assignmentId: assignmentDocId,
      assignmentClientId: assignmentData.clientId,
      assignmentCoachId: assignmentData.coachId,
      clientId: user.uid,
      reason: reason.trim(),
      status: 'granted', // Auto-grant extensions (can be changed to 'pending' if coach approval needed)
      requestedAt: new Date(),
      grantedAt: new Date(),
      grantedBy: 'system', // 'system' for auto-grant, or coach ID if manual approval
      expiresAt: null // Can add expiration logic later if needed
    };

    const extensionRef = await db.collection('check_in_extensions').add(extensionData);

    // Update assignment to mark extension as granted
    await db.collection('check_in_assignments').doc(assignmentDocId).update({
      extensionGranted: true,
      extensionRequestedAt: new Date(),
      extensionReason: reason.trim()
    });

    logInfo('Extension granted for check-in', {
      assignmentId: assignmentDocId,
      clientId: user.uid,
      extensionId: extensionRef.id
    });

    return NextResponse.json({
      success: true,
      message: 'Extension granted. You can now submit your check-in.',
      extensionId: extensionRef.id,
      extensionGranted: true
    });

  } catch (error: any) {
    logSafeError('Error requesting extension', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to request extension',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
    }, { status: 500 });
  }
}

/**
 * GET /api/check-in-assignments/[id]/extension
 * Check if an extension exists for this assignment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;

    if (!id) {
      return NextResponse.json({
        success: false,
        message: 'Assignment ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Get the assignment
    let assignmentDoc = await db.collection('check_in_assignments').doc(id).get();
    let assignmentDocId = assignmentDoc.exists ? assignmentDoc.id : null;

    if (!assignmentDoc.exists) {
      const assignmentsQuery = await db.collection('check_in_assignments')
        .where('id', '==', id)
        .where('clientId', '==', user.uid)
        .limit(1)
        .get();
      
      if (!assignmentsQuery.empty) {
        assignmentDoc = assignmentsQuery.docs[0];
        assignmentDocId = assignmentDoc.id;
      }
    }

    if (!assignmentDocId) {
      return NextResponse.json({
        success: false,
        message: 'Assignment not found'
      }, { status: 404 });
    }

    // Check for granted extension
    const extensionsQuery = await db.collection('check_in_extensions')
      .where('assignmentId', '==', assignmentDocId)
      .where('status', '==', 'granted')
      .limit(1)
      .get();

    if (extensionsQuery.empty) {
      return NextResponse.json({
        success: true,
        extensionGranted: false
      });
    }

    const extensionData = extensionsQuery.docs[0].data();

    return NextResponse.json({
      success: true,
      extensionGranted: true,
      extension: {
        id: extensionsQuery.docs[0].id,
        reason: extensionData.reason,
        grantedAt: extensionData.grantedAt?.toDate?.() || extensionData.grantedAt,
        requestedAt: extensionData.requestedAt?.toDate?.() || extensionData.requestedAt
      }
    });

  } catch (error: any) {
    logSafeError('Error checking extension', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to check extension status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred.'
    }, { status: 500 });
  }
}

