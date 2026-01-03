import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/coach/email-audit-log
 * Fetch email audit logs for coach's clients with filtering and pagination
 * Query params: 
 *   - startDate (YYYY-MM-DD)
 *   - endDate (YYYY-MM-DD)
 *   - emailType (filter by type)
 *   - recipient (filter by recipient email)
 *   - limit (default: 100)
 *   - offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate coach
    const authResult = await requireCoach(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const db = getDb();

    // Get all clients for this coach
    // Coaches have coachId in their user object, but we use their uid to match clients
    const coachId = user.coachId || user.uid;
    const clientsSnapshot = await db.collection('clients')
      .where('coachId', '==', coachId)
      .get();

    const clientEmails = new Set<string>();
    clientsSnapshot.docs.forEach(doc => {
      const clientData = doc.data();
      if (clientData.email) {
        clientEmails.add(clientData.email.toLowerCase());
      }
    });

    // If coach has no clients, return empty result
    if (clientEmails.size === 0) {
      return NextResponse.json({
        success: true,
        data: {
          logs: [],
          stats: {
            total: 0,
            emailsByType: {},
            topRecipients: [],
            testModeCount: 0,
            last7DaysCount: 0,
            last30DaysCount: 0,
          },
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const emailType = searchParams.get('emailType');
    const recipient = searchParams.get('recipient');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query: any = db.collection('email_audit_log');

    // Apply filters
    if (startDateParam) {
      const startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      query = query.where('sentAt', '>=', Timestamp.fromDate(startDate));
    }

    if (endDateParam) {
      const endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
      query = query.where('sentAt', '<=', Timestamp.fromDate(endDate));
    }

    if (emailType) {
      query = query.where('emailType', '==', emailType);
    }

    // Order by sentAt descending (newest first)
    try {
      query = query.orderBy('sentAt', 'desc');
    } catch (error: any) {
      // If composite index is missing, we'll sort client-side
      logSafeError('OrderBy query failed, will sort client-side', error);
    }

    // Get all results (we'll filter by client emails and paginate client-side)
    const snapshot = await query.limit(1000).get();

    let logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        originalRecipients: data.originalRecipients || [],
        actualRecipients: data.actualRecipients || [],
        subject: data.subject || '',
        emailType: data.emailType || 'unknown',
        metadata: data.metadata || {},
        testMode: data.testMode || false,
        sentAt: data.sentAt?.toDate?.()?.toISOString() || (data.sentAt instanceof Date ? data.sentAt.toISOString() : data.sentAt),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt),
      };
    });

    // Filter to only include emails sent to coach's clients
    logs = logs.filter(log => {
      const allRecipients = [
        ...(log.originalRecipients || []),
        ...(log.actualRecipients || [])
      ];
      return allRecipients.some(email => clientEmails.has(email.toLowerCase()));
    });

    // Filter by recipient if specified (additional filter on top of coach's clients)
    if (recipient) {
      logs = logs.filter(log => 
        log.originalRecipients.some((email: string) => email.toLowerCase().includes(recipient.toLowerCase())) ||
        log.actualRecipients.some((email: string) => email.toLowerCase().includes(recipient.toLowerCase()))
      );
    }

    // Sort by sentAt descending if orderBy wasn't used
    logs.sort((a, b) => {
      const dateA = new Date(a.sentAt).getTime();
      const dateB = new Date(b.sentAt).getTime();
      return dateB - dateA;
    });

    // Apply pagination
    const total = logs.length;
    const paginatedLogs = logs.slice(offset, offset + limit);

    // Calculate summary statistics
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const emailsByType: Record<string, number> = {};
    const recipientCounts: Record<string, number> = {};
    let testModeCount = 0;
    let last7DaysCount = 0;
    let last30DaysCount = 0;

    logs.forEach(log => {
      // Count by type
      const type = log.emailType || 'unknown';
      emailsByType[type] = (emailsByType[type] || 0) + 1;

      // Count recipients
      const allRecipients = [...(log.originalRecipients || []), ...(log.actualRecipients || [])];
      allRecipients.forEach(email => {
        if (clientEmails.has(email.toLowerCase())) {
          recipientCounts[email] = (recipientCounts[email] || 0) + 1;
        }
      });

      // Count test mode
      if (log.testMode) {
        testModeCount++;
      }

      // Count recent emails
      const sentAt = new Date(log.sentAt);
      if (sentAt >= sevenDaysAgo) {
        last7DaysCount++;
      }
      if (sentAt >= thirtyDaysAgo) {
        last30DaysCount++;
      }
    });

    // Get top recipients
    const topRecipients = Object.entries(recipientCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([email, count]) => ({ email, count }));

    const stats = {
      total: logs.length,
      emailsByType,
      topRecipients,
      testModeCount,
      last7DaysCount,
      last30DaysCount,
    };

    logInfo(`Coach email audit log fetched: ${paginatedLogs.length} logs (total: ${total})`);

    return NextResponse.json({
      success: true,
      data: {
        logs: paginatedLogs,
        stats,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });

  } catch (error: any) {
    logSafeError('Error fetching coach email audit log', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch email logs',
        error: error.message,
      },
      { status: 500 }
    );
  }
}

