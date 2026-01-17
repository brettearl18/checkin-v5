import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/api-auth';
import { Timestamp } from 'firebase-admin/firestore';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/coach/missed-emails
 * Get list of emails that should have been sent but weren't (mailgunSent: false)
 * Also includes upcoming emails that should be sent soon
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCoach(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const db = getDb();

    // Get all clients for this coach
    const coachId = user.coachId || user.uid;
    const clientsSnapshot = await db.collection('clients')
      .where('coachId', '==', coachId)
      .get();

    const clientIds = new Set<string>();
    const clientEmails = new Map<string, { email: string; name: string }>();
    
    clientsSnapshot.docs.forEach(doc => {
      const clientData = doc.data();
      clientIds.add(doc.id);
      clientEmails.set(doc.id, {
        email: clientData.email || '',
        name: `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'Unknown Client'
      });
    });

    if (clientIds.size === 0) {
      return NextResponse.json({
        success: true,
        data: {
          missedEmails: [],
          upcomingEmails: []
        }
      });
    }

    // Get all email audit logs for these clients (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const emailLogsSnapshot = await db.collection('email_audit_log')
      .where('sentAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
      .limit(1000)
      .get();

    const missedEmails: any[] = [];
    const clientEmailAddresses = Array.from(clientEmails.values()).map(c => c.email.toLowerCase());

    // Filter for emails that weren't sent via Mailgun
    emailLogsSnapshot.docs.forEach(doc => {
      const logData = doc.data();
      const recipients = [
        ...(logData.originalRecipients || []),
        ...(logData.actualRecipients || [])
      ];

      // Check if any recipient is one of the coach's clients
      const isCoachClient = recipients.some((email: string) => 
        clientEmailAddresses.includes(email.toLowerCase())
      );

      if (isCoachClient) {
        // Check if email wasn't sent via Mailgun or delivery status is unknown
        const mailgunSent = logData.mailgunSent !== false; // Default to true if undefined
        const delivered = logData.delivered === true;
        const failed = logData.failed === true;

        // Missed if: mailgunSent is false, or not delivered and not explicitly failed
        if (logData.mailgunSent === false || (!delivered && !failed && mailgunSent)) {
          const clientEmail = recipients.find((email: string) => 
            clientEmailAddresses.includes(email.toLowerCase())
          );
          const clientId = Object.keys(clientEmails).find(id => 
            clientEmails.get(id)?.email.toLowerCase() === clientEmail?.toLowerCase()
          );
          const clientInfo = clientId ? clientEmails.get(clientId) : null;

          missedEmails.push({
            id: doc.id,
            emailType: logData.emailType || 'unknown',
            subject: logData.subject || '',
            recipient: clientEmail || recipients[0],
            clientName: clientInfo?.name || 'Unknown Client',
            clientId: clientId || null,
            sentAt: logData.sentAt?.toDate?.()?.toISOString() || logData.sentAt,
            mailgunSent: logData.mailgunSent !== false,
            delivered: logData.delivered === true,
            failed: logData.failed === true,
            metadata: logData.metadata || {}
          });
        }
      }
    });

    // Get upcoming emails that should be sent (check-in assignments)
    // Get assignments for this coach's clients
    const assignmentPromises = Array.from(clientIds).map(clientId => 
      db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .where('status', 'in', ['active', 'pending'])
        .limit(50)
        .get()
    );
    
    const assignmentSnapshots = await Promise.all(assignmentPromises);
    const assignmentsSnapshot = {
      docs: assignmentSnapshots.flatMap(snap => snap.docs)
    };

    const upcomingEmails: any[] = [];
    const now = new Date();

    for (const assignmentDoc of assignmentsSnapshot.docs) {
      const assignmentData = assignmentDoc.data();
      const clientId = assignmentData.clientId;
      const clientInfo = clientEmails.get(clientId);

      if (!clientInfo) continue;

      // Check window open emails
      if (assignmentData.dueDate) {
        const dueDate = assignmentData.dueDate?.toDate ? assignmentData.dueDate.toDate() : new Date(assignmentData.dueDate);
        const checkInWindow = assignmentData.checkInWindow || {
          enabled: true,
          startDay: 'friday',
          startTime: '10:00',
          endDay: 'monday',
          endTime: '22:00'
        };

        // Calculate window open time (Friday 10am before due date's Monday)
        const dayOfWeek = dueDate.getDay();
        const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
        const weekMonday = new Date(dueDate);
        weekMonday.setDate(dueDate.getDate() - daysToMonday);
        weekMonday.setHours(0, 0, 0, 0);

        const windowOpen = new Date(weekMonday);
        windowOpen.setDate(weekMonday.getDate() - 3); // Friday
        windowOpen.setHours(10, 0, 0, 0);

        // If window opens in next 7 days and email hasn't been sent
        const daysUntilOpen = (windowOpen.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntilOpen >= 0 && daysUntilOpen <= 7 && !assignmentData.windowOpenEmailSentDate) {
          upcomingEmails.push({
            type: 'check-in-window-open',
            assignmentId: assignmentDoc.id,
            clientId,
            clientName: clientInfo.name,
            clientEmail: clientInfo.email,
            formTitle: assignmentData.formTitle || 'Check-in',
            dueDate: dueDate.toISOString(),
            windowOpensAt: windowOpen.toISOString(),
            shouldSendAt: windowOpen.toISOString()
          });
        }

        // Check 24-hour due reminders
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilDue >= 24 && hoursUntilDue <= 48 && !assignmentData.reminder24hSent) {
          upcomingEmails.push({
            type: 'check-in-due-reminder',
            assignmentId: assignmentDoc.id,
            clientId,
            clientName: clientInfo.name,
            clientEmail: clientInfo.email,
            formTitle: assignmentData.formTitle || 'Check-in',
            dueDate: dueDate.toISOString(),
            shouldSendAt: new Date(dueDate.getTime() - 24 * 60 * 60 * 1000).toISOString()
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        missedEmails: missedEmails.sort((a, b) => 
          new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
        ),
        upcomingEmails: upcomingEmails.sort((a, b) => 
          new Date(a.shouldSendAt).getTime() - new Date(b.shouldSendAt).getTime()
        )
      }
    });

  } catch (error) {
    logSafeError('[Missed Emails API] Error fetching missed emails', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch missed emails', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

