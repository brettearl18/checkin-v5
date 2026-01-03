import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/email-audit-log
 * Fetch email audit logs with filtering and pagination
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
    // Authenticate admin
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const emailType = searchParams.get('emailType');
    const recipient = searchParams.get('recipient');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = getDb();

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

    // Get all results (we'll filter and paginate client-side if needed)
    const snapshot = await query.limit(1000).get(); // Get up to 1000 for client-side filtering

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

    // Filter by recipient if specified (client-side since it's an array field)
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
    const stats = {
      total: logs.length,
      byType: {} as Record<string, number>,
      byRecipient: {} as Record<string, number>,
      testModeCount: logs.filter(log => log.testMode).length,
      last7Days: logs.filter(log => {
        const sentDate = new Date(log.sentAt);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return sentDate >= sevenDaysAgo;
      }).length,
      last30Days: logs.filter(log => {
        const sentDate = new Date(log.sentAt);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return sentDate >= thirtyDaysAgo;
      }).length,
    };

    // Count by type
    logs.forEach(log => {
      stats.byType[log.emailType] = (stats.byType[log.emailType] || 0) + 1;
    });

    // Count by recipient (top 10)
    const recipientCounts: Record<string, number> = {};
    logs.forEach(log => {
      log.originalRecipients.forEach((email: string) => {
        recipientCounts[email] = (recipientCounts[email] || 0) + 1;
      });
    });
    const sortedRecipients = Object.entries(recipientCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    sortedRecipients.forEach(([email, count]) => {
      stats.byRecipient[email] = count;
    });

    return NextResponse.json({
      success: true,
      data: {
        logs: paginatedLogs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        stats,
      },
    });

  } catch (error) {
    logSafeError('Error fetching email audit log', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch email audit log',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

