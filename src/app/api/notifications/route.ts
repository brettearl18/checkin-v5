import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

interface Notification {
  id: string;
  userId: string;
  type: 'check_in_due' | 'message_received' | 'goal_achieved' | 'check_in_completed' | 'form_assigned' | 'coach_message' | 'system_alert' | 'coach_feedback_ready';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: any;
  actionUrl?: string;
  metadata?: {
    clientId?: string;
    coachId?: string;
    formId?: string;
    assignmentId?: string;
    messageId?: string;
  };
}

// GET - Fetch notifications for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'User ID is required'
      }, { status: 400 });
    }

    let db;
    try {
      db = getDb();
      // Validate db is properly initialized
      if (!db || typeof db.collection !== 'function') {
        console.error('Database instance is invalid:', typeof db);
        throw new Error('Database instance is not properly initialized');
      }
    } catch (dbError: any) {
      console.error('Error getting database instance:', dbError);
      return NextResponse.json({
        success: false,
        message: 'Database connection failed',
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        notifications: [],
        unreadCount: 0,
        totalCount: 0
      }, { status: 200 });
    }

    let notifications: any[] = [];
    let unreadCount = 0;

    try {
      // Build query - start with base query
      let query: any = db.collection('notifications').where('userId', '==', userId);

      // Add unread filter if needed
      if (unreadOnly) {
        query = query.where('isRead', '==', false);
      }

      // Try with orderBy first (requires composite index)
      try {
        query = query.orderBy('createdAt', 'desc').limit(limit);
        const snapshot = await query.get();
        notifications = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Convert Firestore Timestamp to ISO string for proper serialization
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : 
                       (data.createdAt?._seconds ? new Date(data.createdAt._seconds * 1000).toISOString() : 
                       (data.createdAt instanceof Date ? data.createdAt.toISOString() : 
                       (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString())))
          };
        });
      } catch (orderByError: any) {
        // If orderBy fails (missing index), fetch without orderBy and sort client-side
        console.log('OrderBy failed, fetching without orderBy:', orderByError.message);
        
        // Rebuild query without orderBy
        query = db.collection('notifications').where('userId', '==', userId);
        if (unreadOnly) {
          query = query.where('isRead', '==', false);
        }
        query = query.limit(limit * 2); // Get more to account for client-side sorting
        
        const snapshot = await query.get();
        notifications = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Convert Firestore Timestamp to ISO string for proper serialization
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : 
                       (data.createdAt?._seconds ? new Date(data.createdAt._seconds * 1000).toISOString() : 
                       (data.createdAt instanceof Date ? data.createdAt.toISOString() : 
                       (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString())))
          };
        });

        // Sort client-side by createdAt
        notifications.sort((a, b) => {
          try {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return dateB.getTime() - dateA.getTime();
          } catch (dateError) {
            return 0;
          }
        });
        
        // Limit after sorting
        notifications = notifications.slice(0, limit);
      }

      // Get unread count separately (this query should always work)
      try {
        const unreadSnapshot = await db.collection('notifications')
          .where('userId', '==', userId)
          .where('isRead', '==', false)
          .get();
        unreadCount = unreadSnapshot.size;
      } catch (unreadError) {
        console.log('Error getting unread count, defaulting to 0:', unreadError);
        unreadCount = notifications.filter(n => !n.isRead).length;
      }

    } catch (queryError: any) {
      console.error('Query error in notifications API:', queryError);
      // Return empty array instead of failing completely
      notifications = [];
      unreadCount = 0;
    }

    // Ensure we always return a valid response
    try {
      return NextResponse.json({
        success: true,
        notifications: notifications || [],
        unreadCount: unreadCount || 0,
        totalCount: notifications?.length || 0
      });
    } catch (jsonError: any) {
      console.error('Error serializing response:', jsonError);
      // Fallback to a basic response if JSON serialization fails
      return NextResponse.json(
        { 
          success: false, 
          message: 'Error serializing response',
          notifications: [],
          unreadCount: 0,
          totalCount: 0
        },
        { status: 200 }
      );
    }

  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    // Log the full error for debugging
    if (error?.stack) {
      console.error('Error stack:', error.stack);
    }
    if (error?.code) {
      console.error('Error code:', error.code);
    }
    // Return 200 with error details instead of 500, since we're handling it gracefully
    // This ensures the UI doesn't break even if notifications fail to load
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch notifications', 
        error: error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Unknown error'),
        notifications: [],
        unreadCount: 0,
        totalCount: 0
      },
      { status: 200 }
    );
  }
}

// POST - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const notificationData = await request.json();
    const { userId, type, title, message, actionUrl, metadata } = notificationData;

    if (!userId || !type || !title || !message) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: userId, type, title, message'
      }, { status: 400 });
    }

    const db = getDb();
    const notification: Omit<Notification, 'id'> = {
      userId,
      type,
      title,
      message,
      isRead: false,
      createdAt: new Date(),
      actionUrl,
      metadata
    };

    const docRef = await db.collection('notifications').add(notification);

    return NextResponse.json({
      success: true,
      message: 'Notification created successfully',
      notificationId: docRef.id
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create notification', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Mark notification as read or mark all as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, isRead, markAllAsRead, userId } = body;

    const db = getDb();

    // Handle "mark all as read" operation
    if (markAllAsRead && userId) {
      // Get all unread notifications for the user
      const unreadSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

      if (!unreadSnapshot.empty) {
        // Update all unread notifications in a batch
        const batch = db.batch();
        unreadSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            isRead: true,
            updatedAt: new Date()
          });
        });
        await batch.commit();
      }

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
        updatedCount: unreadSnapshot.size
      });
    }

    // Handle individual notification update
    if (!notificationId) {
      return NextResponse.json({
        success: false,
        message: 'Notification ID is required for individual updates'
      }, { status: 400 });
    }

    await db.collection('notifications').doc(notificationId).update({
      isRead: isRead !== undefined ? isRead : true,
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Notification updated successfully'
    });

  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update notification', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a notification
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json({
        success: false,
        message: 'Notification ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    await db.collection('notifications').doc(notificationId).delete();

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete notification', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
