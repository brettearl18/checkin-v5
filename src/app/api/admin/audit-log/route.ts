import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { logInfo, logSafeError } from '@/lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit-log
 * Fetch audit logs with filtering and pagination
 * Query params:
 *   - startDate (YYYY-MM-DD)
 *   - endDate (YYYY-MM-DD)
 *   - action (filter by action type)
 *   - userId (filter by user ID)
 *   - userEmail (filter by user email)
 *   - userRole (filter by user role)
 *   - resourceType (filter by resource type)
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
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('userEmail');
    const userRole = searchParams.get('userRole');
    const resourceType = searchParams.get('resourceType');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = getDb();

    // Build query
    let query: any = db.collection('audit_logs');

    // Apply filters
    if (startDateParam) {
      const startDate = new Date(startDateParam);
      startDate.setHours(0, 0, 0, 0);
      query = query.where('timestamp', '>=', Timestamp.fromDate(startDate));
    }

    if (endDateParam) {
      const endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
      query = query.where('timestamp', '<=', Timestamp.fromDate(endDate));
    }

    if (action) {
      query = query.where('action', '==', action);
    }

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    if (userRole) {
      query = query.where('userRole', '==', userRole);
    }

    if (resourceType) {
      query = query.where('resourceType', '==', resourceType);
    }

    // Order by timestamp descending (newest first)
    try {
      query = query.orderBy('timestamp', 'desc');
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
        userId: data.userId || '',
        userEmail: data.userEmail || '',
        userName: data.userName || '',
        userRole: data.userRole || '',
        action: data.action || '',
        resourceType: data.resourceType || '',
        resourceId: data.resourceId || '',
        description: data.description || '',
        metadata: data.metadata || {},
        ipAddress: data.ipAddress || '',
        userAgent: data.userAgent || '',
        timestamp: data.timestamp?.toDate?.()?.toISOString() || (data.timestamp instanceof Date ? data.timestamp.toISOString() : data.timestamp),
      };
    });

    // Filter by userEmail if specified (client-side since it might not be indexed)
    if (userEmail) {
      logs = logs.filter(log =>
        log.userEmail.toLowerCase().includes(userEmail.toLowerCase())
      );
    }

    // Sort by timestamp descending if orderBy wasn't used
    logs.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA;
    });

    // Apply pagination
    const total = logs.length;
    const paginatedLogs = logs.slice(offset, offset + limit);

    // Calculate summary statistics
    const stats = {
      total: logs.length,
      byAction: {} as Record<string, number>,
      byRole: {} as Record<string, number>,
      byResourceType: {} as Record<string, number>,
      last7Days: logs.filter(log => {
        const logDate = new Date(log.timestamp);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return logDate >= sevenDaysAgo;
      }).length,
      last30Days: logs.filter(log => {
        const logDate = new Date(log.timestamp);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return logDate >= thirtyDaysAgo;
      }).length,
    };

    // Count by action
    logs.forEach(log => {
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
    });

    // Count by role
    logs.forEach(log => {
      stats.byRole[log.userRole] = (stats.byRole[log.userRole] || 0) + 1;
    });

    // Count by resource type
    logs.forEach(log => {
      if (log.resourceType) {
        stats.byResourceType[log.resourceType] = (stats.byResourceType[log.resourceType] || 0) + 1;
      }
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
    logSafeError('Error fetching audit log', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch audit log',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

