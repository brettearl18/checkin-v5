import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { Timestamp } from 'firebase-admin/firestore';
import { logInfo, logSafeError } from '@/lib/logger';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Verify Mailgun webhook signature
 */
function verifyMailgunSignature(
  token: string,
  timestamp: string,
  signature: string
): boolean {
  const apiKey = process.env.MAILGUN_API_KEY;
  if (!apiKey) {
    return false;
  }

  // Mailgun signature verification
  const encodedToken = Buffer.from(token).toString('hex');
  const payload = `${timestamp}${encodedToken}`;
  const hmac = crypto.createHmac('sha256', apiKey);
  hmac.update(payload);
  const computedSignature = hmac.digest('hex');

  return computedSignature === signature;
}

/**
 * POST /api/webhooks/mailgun
 * Handle Mailgun webhook events (opens, clicks, bounces, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Get signature for verification
    const token = formData.get('token') as string;
    const timestamp = formData.get('timestamp') as string;
    const signature = formData.get('signature') as string;

    // Verify webhook signature (optional but recommended for security)
    if (token && timestamp && signature) {
      if (!verifyMailgunSignature(token, timestamp, signature)) {
        logSafeError('Invalid Mailgun webhook signature', new Error('Signature verification failed'));
        return NextResponse.json({
          success: false,
          message: 'Invalid signature'
        }, { status: 401 });
      }
    }

    // Get event data
    const eventData = formData.get('event-data');
    let event: any;

    if (eventData) {
      try {
        event = typeof eventData === 'string' ? JSON.parse(eventData) : eventData;
      } catch (e) {
        // Fallback to reading individual fields if event-data is not JSON
        event = {
          event: formData.get('event') as string,
          'message-id': formData.get('message-id') || formData.get('Message-Id') as string,
          recipient: formData.get('recipient') as string,
          timestamp: formData.get('timestamp') as string || new Date().getTime(),
        };
      }
    } else {
      // Fallback: read individual form fields (Mailgun sometimes sends form-encoded)
      event = {
        event: formData.get('event') as string,
        'message-id': formData.get('message-id') || formData.get('Message-Id') as string,
        recipient: formData.get('recipient') as string,
        timestamp: formData.get('timestamp') as string || Date.now().toString(),
      };
    }

    const eventType = event.event || formData.get('event');
    const messageId = event['message-id'] || formData.get('message-id') || formData.get('Message-Id');
    const recipient = event.recipient || formData.get('recipient');
    const eventTimestamp = event.timestamp ? new Date(parseInt(event.timestamp) * 1000) : new Date();

    if (!eventType || !messageId) {
      logSafeError('Invalid Mailgun webhook data', new Error('Missing event or message-id'));
      return NextResponse.json({
        success: false,
        message: 'Missing required fields'
      }, { status: 400 });
    }

    logInfo('Mailgun webhook received', { eventType, messageId, recipient });

    const db = getDb();

    // Find the email in audit log by Mailgun message ID
    // Mailgun message IDs are in format: <message-id@domain>
    // We need to extract the message ID part
    const messageIdMatch = String(messageId).match(/<(.+)>/);
    const cleanMessageId = messageIdMatch ? messageIdMatch[1] : String(messageId);
    
    // Try to find by mailgunMessageId field
    let auditLogQuery = await db.collection('email_audit_log')
      .where('mailgunMessageId', '==', cleanMessageId)
      .limit(1)
      .get();

    // If not found, try searching by recipient and recent timestamp (within last 7 days)
    if (auditLogQuery.empty && recipient) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      auditLogQuery = await db.collection('email_audit_log')
        .where('actualRecipients', 'array-contains', recipient)
        .where('sentAt', '>=', Timestamp.fromDate(sevenDaysAgo))
        .orderBy('sentAt', 'desc')
        .limit(5)
        .get();
    }

    if (auditLogQuery.empty) {
      logInfo('Email audit log entry not found for webhook', { messageId, recipient, eventType });
      // Return success anyway - webhook should return 200 even if we can't process it
      return NextResponse.json({
        success: true,
        message: 'Event received but no matching email found'
      });
    }

    // Update all matching entries (should usually be just one)
    const updatePromises = auditLogQuery.docs.map(async (doc) => {
      const updateData: any = {};

      switch (eventType) {
        case 'opened':
          updateData.opened = true;
          updateData.openedCount = (doc.data().openedCount || 0) + 1;
          if (!doc.data().openedAt) {
            updateData.openedAt = Timestamp.fromDate(eventTimestamp);
          }
          break;

        case 'clicked':
          updateData.clicked = true;
          updateData.clickedCount = (doc.data().clickedCount || 0) + 1;
          if (!doc.data().clickedAt) {
            updateData.clickedAt = Timestamp.fromDate(eventTimestamp);
          }
          // Store clicked URL if available
          if (event['url'] || formData.get('url')) {
            updateData.lastClickedUrl = event['url'] || formData.get('url');
          }
          break;

        case 'delivered':
          updateData.delivered = true;
          if (!doc.data().deliveredAt) {
            updateData.deliveredAt = Timestamp.fromDate(eventTimestamp);
          }
          break;

        case 'failed':
        case 'bounced':
        case 'rejected':
          updateData.failed = true;
          updateData.bounced = eventType === 'bounced';
          if (!doc.data().failedAt) {
            updateData.failedAt = Timestamp.fromDate(eventTimestamp);
          }
          // Store failure reason if available
          if (event['delivery-status']?.message || formData.get('delivery-status')) {
            updateData.failureReason = event['delivery-status']?.message || formData.get('delivery-status');
          }
          break;

        default:
          logInfo('Unhandled Mailgun event type', { eventType, messageId });
          return null;
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = Timestamp.now();
        await doc.ref.update(updateData);
        logInfo('Updated email audit log', { eventType, messageId, docId: doc.id });
      }

      return doc.id;
    });

    await Promise.all(updatePromises.filter(p => p !== null));

    return NextResponse.json({
      success: true,
      message: 'Event processed'
    });

  } catch (error: any) {
    logSafeError('Error processing Mailgun webhook', error);
    // Return 200 to Mailgun even on error (they'll retry if we return error codes)
    return NextResponse.json({
      success: false,
      message: 'Error processing webhook',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 200 });
  }
}

