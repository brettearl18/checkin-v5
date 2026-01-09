import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

/**
 * GET /api/admin/bulk-update-checkin-window?formId=<formId>
 * Get list of clients using a specific form
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formId = searchParams.get('formId');
    const action = searchParams.get('action'); // 'forms' or 'clients'

    const db = getDb();

    // Get all forms
    if (action === 'forms') {
      let formsSnapshot;
      try {
        formsSnapshot = await db.collection('forms')
          .orderBy('title', 'asc')
          .get();
      } catch (error: any) {
        // If orderBy fails (no index), fallback to simple query
        console.log('orderBy failed, using simple query:', error.message);
        formsSnapshot = await db.collection('forms').get();
      }

      const forms = formsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'Untitled Form',
          category: data.category || 'general',
          description: data.description || ''
        };
      });

      // Sort forms by title if orderBy didn't work
      forms.sort((a, b) => a.title.localeCompare(b.title));

      return NextResponse.json({
        success: true,
        forms
      });
    }

    // Get clients using a specific form
    if (formId) {
      // Find all check-in assignments for this form
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('formId', '==', formId)
        .get();

      const clientIds = new Set<string>();
      assignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.clientId) {
          clientIds.add(data.clientId);
        }
      });

      // Fetch client details
      const clients: Array<{
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        status: string;
        assignmentCount: number;
      }> = [];

      for (const clientId of clientIds) {
        try {
          const clientDoc = await db.collection('clients').doc(clientId).get();
          if (clientDoc.exists) {
            const clientData = clientDoc.data();
            // Count assignments for this client
            const clientAssignments = assignmentsSnapshot.docs.filter(
              doc => doc.data().clientId === clientId
            );

            clients.push({
              id: clientId,
              firstName: clientData?.firstName || '',
              lastName: clientData?.lastName || '',
              email: clientData?.email || '',
              status: clientData?.status || 'unknown',
              assignmentCount: clientAssignments.length
            });
          }
        } catch (error) {
          console.error(`Error fetching client ${clientId}:`, error);
        }
      }

      // Sort by name
      clients.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      return NextResponse.json({
        success: true,
        clients,
        totalAssignments: assignmentsSnapshot.size
      });
    }

    return NextResponse.json({
      success: false,
      message: 'formId or action=forms required'
    }, { status: 400 });

  } catch (error) {
    console.error('Error fetching forms/clients:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Bulk update check-in window for all clients using a specific form
 * POST /api/admin/bulk-update-checkin-window
 * 
 * Body: {
 *   formId: string,      // Required: form ID
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
    const { formId, checkInWindow } = body;

    if (!formId) {
      return NextResponse.json({
        success: false,
        message: 'formId is required'
      }, { status: 400 });
    }

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

    // Verify form exists
    const formDoc = await db.collection('forms').doc(formId).get();
    if (!formDoc.exists) {
      return NextResponse.json({
        success: false,
        message: `Form with ID ${formId} not found`
      }, { status: 404 });
    }

    const formData = formDoc.data();
    const formTitle = formData?.title || 'Unknown Form';

    // Find all check-in assignments for this form
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('formId', '==', formId)
      .get();

    if (assignmentsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: `No check-in assignments found for form "${formTitle}"`,
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
      formId,
      formTitle,
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

