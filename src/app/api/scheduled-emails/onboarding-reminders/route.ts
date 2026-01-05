import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { sendEmail } from '@/lib/email-service';
import { getOnboardingReminderEmailTemplate } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled-emails/onboarding-reminders
 * 
 * Sends onboarding reminder emails to clients who:
 * - Were created more than 24 hours ago
 * - Have not completed onboarding (onboardingStatus !== 'completed')
 * - Have not already received a reminder in the last 23 hours
 */
export async function POST(request: NextRequest) {
  try {
    // Check for test email override
    let testEmail: string | null = null;
    try {
      const body = await request.json();
      testEmail = body?.testEmail || null;
      if (testEmail) {
        console.log(`[TEST MODE] Using test email override: ${testEmail}`);
      }
    } catch (error) {
      // No body or invalid JSON, continue without test email
      console.log('No request body or invalid JSON, continuing without test email override');
    }

    const db = getDb();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Find clients who were created more than 24 hours ago
    const clientsSnapshot = await db.collection('clients')
      .where('createdAt', '<=', twentyFourHoursAgo)
      .get();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app';
    const results = {
      checked: 0,
      sent: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const doc of clientsSnapshot.docs) {
      results.checked++;
      const clientData = doc.data();
      const clientId = doc.id;

      // Get client email and name (needed for test mode even if skipped)
      const clientEmail = clientData.email;
      const clientName = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'there';

      // Check if this client should be skipped
      const isCompleted = clientData.onboardingStatus === 'completed' || clientData.canStartCheckIns === true;
      const hasNoEmail = !clientEmail;
      const emailNotificationsDisabled = (clientData.emailNotifications ?? true) === false && !testEmail;
      const lastReminderSent = clientData.lastOnboardingReminderSent;
      let recentlyReminded = false;
      if (lastReminderSent) {
        const lastReminderDate = lastReminderSent.toDate ? lastReminderSent.toDate() : new Date(lastReminderSent);
        const hoursSinceReminder = (now.getTime() - lastReminderDate.getTime()) / (1000 * 60 * 60);
        recentlyReminded = hoursSinceReminder < 23;
      }
      
      const shouldSkip = isCompleted || hasNoEmail || emailNotificationsDisabled || recentlyReminded;

      // If in test mode, send email even if client would normally be skipped
      if (shouldSkip && !testEmail) {
        results.skipped++;
        continue;
      }

      // If client would be skipped but we have test email, still process it for testing
      if (shouldSkip && testEmail) {
        // Use a default client name if not available
        const testClientName = clientName !== 'there' ? clientName : 'Test Client';
        const testClientEmail = clientEmail || 'test@example.com';

        // Get coach information
        let coachName: string | undefined;
        if (clientData.coachId) {
          try {
            const coachDoc = await db.collection('coaches').doc(clientData.coachId).get();
            if (coachDoc.exists) {
              const coachData = coachDoc.data();
              coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || undefined;
            }
          } catch (error) {
            console.log(`Could not fetch coach information for client ${clientId}`);
          }
        }

        // Generate onboarding URL (check if token exists, otherwise create one)
        let onboardingToken = clientData.onboardingToken;
        if (!onboardingToken) {
          // Generate token if it doesn't exist
          const crypto = await import('crypto');
          onboardingToken = crypto.randomBytes(32).toString('hex');
        }

        const onboardingUrl = `${baseUrl}/client-onboarding?token=${onboardingToken}&email=${encodeURIComponent(testClientEmail)}`;

        // Send test email
        try {
          const { subject, html } = getOnboardingReminderEmailTemplate(
            testClientName,
            onboardingUrl,
            coachName
          );

          console.log(`[ONBOARDING REMINDER TEST] Sending test email to ${testEmail} for client ${testClientEmail}`);

          await sendEmail({
            to: testEmail,
            subject: `[TEST - Would skip: ${testClientEmail}] ${subject}`,
            html,
          });

          results.sent++;
        } catch (error) {
          console.error(`Error sending test onboarding reminder:`, error);
          results.errors.push(`Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        continue;
      }

      // Normal flow for clients that meet criteria
      // Get coach information
      let coachName: string | undefined;
      if (clientData.coachId) {
        try {
          const coachDoc = await db.collection('coaches').doc(clientData.coachId).get();
          if (coachDoc.exists) {
            const coachData = coachDoc.data();
            coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || undefined;
          }
        } catch (error) {
          console.log(`Could not fetch coach information for client ${clientId}`);
        }
      }

      // Generate onboarding URL (check if token exists, otherwise create one)
      let onboardingToken = clientData.onboardingToken;
      if (!onboardingToken) {
        // Generate token if it doesn't exist
        const crypto = await import('crypto');
        onboardingToken = crypto.randomBytes(32).toString('hex');
        await db.collection('clients').doc(clientId).update({
          onboardingToken,
          tokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
      }

      const onboardingUrl = `${baseUrl}/client-onboarding?token=${onboardingToken}&email=${encodeURIComponent(clientEmail)}`;

      // Send email
      try {
        const { subject, html } = getOnboardingReminderEmailTemplate(
          clientName,
          onboardingUrl,
          coachName
        );

        // Use test email if provided, otherwise use client email
        const recipientEmail = testEmail || clientEmail;
        
        console.log(`[ONBOARDING REMINDER] Sending email - Test mode: ${!!testEmail}, Recipient: ${recipientEmail}, Original: ${clientEmail}`);

        await sendEmail({
          to: recipientEmail,
          subject: testEmail ? `[TEST - Original: ${clientEmail}] ${subject}` : subject,
          html,
        });

        // Update client record to track that we sent the reminder (only if not in test mode)
        if (!testEmail) {
          await db.collection('clients').doc(clientId).update({
            lastOnboardingReminderSent: new Date(),
          });
        }

        results.sent++;
      } catch (error) {
        console.error(`Error sending onboarding reminder to ${clientEmail}:`, error);
        results.errors.push(`Failed to send to ${clientEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.checked} clients. Sent ${results.sent} reminders, skipped ${results.skipped}`,
      results,
      debug: {
        testEmailUsed: testEmail || null,
        testModeActive: !!testEmail,
      },
    });

  } catch (error) {
    console.error('Error processing onboarding reminders:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process onboarding reminders',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


import { sendEmail } from '@/lib/email-service';
import { getOnboardingReminderEmailTemplate } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled-emails/onboarding-reminders
 * 
 * Sends onboarding reminder emails to clients who:
 * - Were created more than 24 hours ago
 * - Have not completed onboarding (onboardingStatus !== 'completed')
 * - Have not already received a reminder in the last 23 hours
 */
export async function POST(request: NextRequest) {
  try {
    // Check for test email override
    let testEmail: string | null = null;
    try {
      const body = await request.json();
      testEmail = body?.testEmail || null;
      if (testEmail) {
        console.log(`[TEST MODE] Using test email override: ${testEmail}`);
      }
    } catch (error) {
      // No body or invalid JSON, continue without test email
      console.log('No request body or invalid JSON, continuing without test email override');
    }

    const db = getDb();
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Find clients who were created more than 24 hours ago
    const clientsSnapshot = await db.collection('clients')
      .where('createdAt', '<=', twentyFourHoursAgo)
      .get();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app';
    const results = {
      checked: 0,
      sent: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const doc of clientsSnapshot.docs) {
      results.checked++;
      const clientData = doc.data();
      const clientId = doc.id;

      // Get client email and name (needed for test mode even if skipped)
      const clientEmail = clientData.email;
      const clientName = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'there';

      // Check if this client should be skipped
      const isCompleted = clientData.onboardingStatus === 'completed' || clientData.canStartCheckIns === true;
      const hasNoEmail = !clientEmail;
      const emailNotificationsDisabled = (clientData.emailNotifications ?? true) === false && !testEmail;
      const lastReminderSent = clientData.lastOnboardingReminderSent;
      let recentlyReminded = false;
      if (lastReminderSent) {
        const lastReminderDate = lastReminderSent.toDate ? lastReminderSent.toDate() : new Date(lastReminderSent);
        const hoursSinceReminder = (now.getTime() - lastReminderDate.getTime()) / (1000 * 60 * 60);
        recentlyReminded = hoursSinceReminder < 23;
      }
      
      const shouldSkip = isCompleted || hasNoEmail || emailNotificationsDisabled || recentlyReminded;

      // If in test mode, send email even if client would normally be skipped
      if (shouldSkip && !testEmail) {
        results.skipped++;
        continue;
      }

      // If client would be skipped but we have test email, still process it for testing
      if (shouldSkip && testEmail) {
        // Use a default client name if not available
        const testClientName = clientName !== 'there' ? clientName : 'Test Client';
        const testClientEmail = clientEmail || 'test@example.com';

        // Get coach information
        let coachName: string | undefined;
        if (clientData.coachId) {
          try {
            const coachDoc = await db.collection('coaches').doc(clientData.coachId).get();
            if (coachDoc.exists) {
              const coachData = coachDoc.data();
              coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || undefined;
            }
          } catch (error) {
            console.log(`Could not fetch coach information for client ${clientId}`);
          }
        }

        // Generate onboarding URL (check if token exists, otherwise create one)
        let onboardingToken = clientData.onboardingToken;
        if (!onboardingToken) {
          // Generate token if it doesn't exist
          const crypto = await import('crypto');
          onboardingToken = crypto.randomBytes(32).toString('hex');
        }

        const onboardingUrl = `${baseUrl}/client-onboarding?token=${onboardingToken}&email=${encodeURIComponent(testClientEmail)}`;

        // Send test email
        try {
          const { subject, html } = getOnboardingReminderEmailTemplate(
            testClientName,
            onboardingUrl,
            coachName
          );

          console.log(`[ONBOARDING REMINDER TEST] Sending test email to ${testEmail} for client ${testClientEmail}`);

          await sendEmail({
            to: testEmail,
            subject: `[TEST - Would skip: ${testClientEmail}] ${subject}`,
            html,
          });

          results.sent++;
        } catch (error) {
          console.error(`Error sending test onboarding reminder:`, error);
          results.errors.push(`Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        continue;
      }

      // Normal flow for clients that meet criteria
      // Get coach information
      let coachName: string | undefined;
      if (clientData.coachId) {
        try {
          const coachDoc = await db.collection('coaches').doc(clientData.coachId).get();
          if (coachDoc.exists) {
            const coachData = coachDoc.data();
            coachName = `${coachData?.firstName || ''} ${coachData?.lastName || ''}`.trim() || undefined;
          }
        } catch (error) {
          console.log(`Could not fetch coach information for client ${clientId}`);
        }
      }

      // Generate onboarding URL (check if token exists, otherwise create one)
      let onboardingToken = clientData.onboardingToken;
      if (!onboardingToken) {
        // Generate token if it doesn't exist
        const crypto = await import('crypto');
        onboardingToken = crypto.randomBytes(32).toString('hex');
        await db.collection('clients').doc(clientId).update({
          onboardingToken,
          tokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
      }

      const onboardingUrl = `${baseUrl}/client-onboarding?token=${onboardingToken}&email=${encodeURIComponent(clientEmail)}`;

      // Send email
      try {
        const { subject, html } = getOnboardingReminderEmailTemplate(
          clientName,
          onboardingUrl,
          coachName
        );

        // Use test email if provided, otherwise use client email
        const recipientEmail = testEmail || clientEmail;
        
        console.log(`[ONBOARDING REMINDER] Sending email - Test mode: ${!!testEmail}, Recipient: ${recipientEmail}, Original: ${clientEmail}`);

        await sendEmail({
          to: recipientEmail,
          subject: testEmail ? `[TEST - Original: ${clientEmail}] ${subject}` : subject,
          html,
        });

        // Update client record to track that we sent the reminder (only if not in test mode)
        if (!testEmail) {
          await db.collection('clients').doc(clientId).update({
            lastOnboardingReminderSent: new Date(),
          });
        }

        results.sent++;
      } catch (error) {
        console.error(`Error sending onboarding reminder to ${clientEmail}:`, error);
        results.errors.push(`Failed to send to ${clientEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.checked} clients. Sent ${results.sent} reminders, skipped ${results.skipped}`,
      results,
      debug: {
        testEmailUsed: testEmail || null,
        testModeActive: !!testEmail,
      },
    });

  } catch (error) {
    console.error('Error processing onboarding reminders:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process onboarding reminders',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

