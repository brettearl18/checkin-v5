import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

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

    const db = getDb();
    let notifications: any[] = [];
    let unreadCount = 0;

    try {
      // Build query with all where clauses first, then orderBy
      let query = db.collection('notifications')
        .where('userId', '==', userId);

      if (unreadOnly) {
        query = query.where('isRead', '==', false);
      }

      // orderBy must come after all where clauses
      query = query.orderBy('createdAt', 'desc').limit(limit);

      const snapshot = await query.get();
      notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get unread count
      const unreadSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

      unreadCount = unreadSnapshot.size;

    } catch (indexError: any) {
      console.log('Index error, trying without orderBy:', indexError.message);
      
      // Fallback without orderBy
      let query = db.collection('notifications')
        .where('userId', '==', userId)
        .limit(limit);

      if (unreadOnly) {
        query = query.where('isRead', '==', false);
      }

      const snapshot = await query.get();
      notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort client-side
      notifications.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      // Get unread count
      const unreadSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

      unreadCount = unreadSnapshot.size;
    }

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
      totalCount: notifications.length
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch notifications', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
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
