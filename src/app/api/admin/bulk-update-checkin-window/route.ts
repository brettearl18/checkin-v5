import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

/**
 * Bulk update check-in window for all clients using a specific form
 * POST /api/admin/bulk-update-checkin-window
 * 
 * Body: {
 *   formTitle?: string,  // e.g., "Vana Health 2026 Check in Form"
 *   formId?: string,     // Optional: direct form ID
 *   checkInWindow: {
 *     enabled: boolean,
 *     startDay: string,   // e.g., "friday"
 *     startTime: string,  // e.g., "09:00"
 *     endDay: string,     // e.g., "tuesday"
 *     endTime: string     // e.g., "12:00"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formTitle, formId, checkInWindow } = body;

    if (!checkInWindow) {
      return NextResponse.json({
        success: false,
        message: 'checkInWindow is required'
      }, { status: 400 });
    }

    // Validate checkInWindow structure
    if (checkInWindow.enabled === undefined || 
        !checkInWindow.startDay || 
        !checkInWindow.startTime || 
        !checkInWindow.endDay || 
        !checkInWindow.endTime) {
      return NextResponse.json({
        success: false,
        message: 'checkInWindow must include: enabled, startDay, startTime, endDay, endTime'
      }, { status: 400 });
    }

    const db = getDb();
    let targetFormId: string | null = null;

    // If formId is provided, use it directly
    if (formId) {
      const formDoc = await db.collection('forms').doc(formId).get();
      if (formDoc.exists) {
        targetFormId = formId;
      } else {
        return NextResponse.json({
          success: false,
          message: `Form with ID ${formId} not found`
        }, { status: 404 });
      }
    }
    // Otherwise, search by title
    else if (formTitle) {
      const formsSnapshot = await db.collection('forms')
        .where('title', '==', formTitle)
        .limit(1)
        .get();
      
      if (formsSnapshot.empty) {
        return NextResponse.json({
          success: false,
          message: `Form "${formTitle}" not found`
        }, { status: 404 });
      }
      
      targetFormId = formsSnapshot.docs[0].id;
    } else {
      return NextResponse.json({
        success: false,
        message: 'Either formTitle or formId must be provided'
      }, { status: 400 });
    }

    // Find all check-in assignments for this form
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('formId', '==', targetFormId)
      .get();

    if (assignmentsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: `No check-in assignments found for form "${formTitle || formId}"`,
        updatedCount: 0
      });
    }

    // Update all assignments in batches (Firestore batch limit is 500)
    const batchSize = 500;
    const docs = assignmentsSnapshot.docs;
    let updatedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = docs.slice(i, i + batchSize);

      batchDocs.forEach(doc => {
        batch.update(doc.ref, {
          checkInWindow: checkInWindow,
          updatedAt: new Date()
        });
      });

      try {
        await batch.commit();
        updatedCount += batchDocs.length;
      } catch (error) {
        console.error(`Error updating batch ${i / batchSize + 1}:`, error);
        errorCount += batchDocs.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated check-in window for ${updatedCount} assignment(s)`,
      updatedCount,
      errorCount,
      formId: targetFormId,
      newWindow: checkInWindow
    });

  } catch (error) {
    console.error('Error bulk updating check-in window:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to bulk update check-in window',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

