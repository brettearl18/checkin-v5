import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { sendEmail } from '@/lib/email-service';
import { getMealPlanAssignedEmailTemplate } from '@/lib/email-templates';
import { verifyClientAccess } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;

    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof Response) return accessResult;
    const { mealPlanName, mealPlanUrl, sendEmail: shouldSendEmail = false } = await request.json();

    if (!mealPlanName || !mealPlanUrl) {
      return NextResponse.json(
        { success: false, error: 'Meal plan name and URL are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(mealPlanUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // Get client information for email
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    const clientData = clientDoc.data();
    const clientEmail = clientData?.email;
    const clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'there';
    const emailNotificationsEnabled = clientData?.emailNotifications ?? true;

    // Get coach information
    let coachName: string | undefined;
    const coachId = clientData?.coachId;
    if (coachId) {
      try {
        const coachDoc = await db.collection('coaches').doc(coachId).get();
        if (coachDoc.exists) {
          const coachData = coachDoc.data();
          coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || undefined;
        }
      } catch (coachError) {
        logInfo('Could not fetch coach information for email');
      }
    }
    
    // Update the client's meal plan
    await db.collection('clients').doc(clientId).update({
      mealPlanName,
      mealPlanUrl,
      mealPlanUpdatedAt: new Date(),
      updatedAt: new Date()
    });

    // Send email notification to client (if requested and email notifications are enabled)
    if (shouldSendEmail && clientEmail && emailNotificationsEnabled) {
      try {
        const { subject, html } = getMealPlanAssignedEmailTemplate(
          clientName,
          mealPlanName,
          mealPlanUrl,
          coachName
        );

        await sendEmail({
          to: clientEmail,
          subject,
          html,
          emailType: 'meal-plan-assigned',
          metadata: {
            clientId: clientId,
            coachId: coachId
          }
        });

        logInfo('Meal plan assignment email sent', { clientEmail });
      } catch (emailError) {
        logSafeError('Error sending meal plan email', emailError);
        // Don't fail the meal plan update if email fails
      }
    } else if (clientEmail && !emailNotificationsEnabled) {
      logInfo('Skipping email: notifications disabled', { clientEmail });
    }

    return NextResponse.json({
      success: true,
      message: 'Meal plan updated successfully'
    });

  } catch (error: unknown) {
    logSafeError('Error updating meal plan', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update meal plan'
      },
      { status: 500 }
    );
  }
}
