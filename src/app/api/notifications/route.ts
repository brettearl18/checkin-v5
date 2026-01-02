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
  // Wrap entire function in try-catch to prevent any unhandled errors
  // This ensures we NEVER return a 500 error - always return 200 with error details
  try {
    console.log('[Notifications API] GET request started');
    
    let searchParams;
    let userId;
    let limit;
    let unreadOnly;
    
    try {
      const url = new URL(request.url);
      searchParams = url.searchParams;
      console.log('[Notifications API] Parsed search params');
      userId = searchParams.get('userId');
      limit = parseInt(searchParams.get('limit') || '50');
      unreadOnly = searchParams.get('unreadOnly') === 'true';
    } catch (urlError: any) {
      console.error('[Notifications API] Error parsing URL:', urlError);
      return NextResponse.json({
        success: false,
        message: 'Invalid request URL',
        error: urlError instanceof Error ? urlError.message : 'Unknown error',
        notifications: [],
        unreadCount: 0,
        totalCount: 0
      }, { status: 200 });
    }

    if (!userId) {
      console.log('[Notifications API] No userId provided');
      return NextResponse.json({
        success: false,
        message: 'User ID is required',
        notifications: [],
        unreadCount: 0,
        totalCount: 0
      }, { status: 200 });
    }

    console.log('[Notifications API] Fetching for userId:', userId);
    let db;
    try {
      db = getDb();
      console.log('[Notifications API] Database initialized');
      // Validate db is properly initialized
      if (!db || typeof db.collection !== 'function') {
        console.error('Database instance is invalid:', typeof db);
        // Return 200 instead of throwing to prevent 500
        return NextResponse.json({
          success: false,
          message: 'Database instance is not properly initialized',
          notifications: [],
          unreadCount: 0,
          totalCount: 0
        }, { status: 200 });
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
          // Convert Firestore Timestamps and other non-serializable objects
          // Serialize metadata to ensure it's JSON-safe
          let serializedMetadata = null;
          if (data.metadata) {
            try {
              // Deep clone and serialize metadata, converting any Timestamps
              serializedMetadata = JSON.parse(JSON.stringify(data.metadata, (key, value) => {
                // Convert Firestore Timestamps in metadata
                if (value && typeof value === 'object') {
                  if (value.toDate && typeof value.toDate === 'function') {
                    return value.toDate().toISOString();
                  }
                  if (value._seconds) {
                    return new Date(value._seconds * 1000).toISOString();
                  }
                }
                return value;
              }));
            } catch (metadataError) {
              console.error('Error serializing metadata:', metadataError);
              // If metadata can't be serialized, return a safe version
              serializedMetadata = {
                error: 'Metadata could not be serialized',
                rawKeys: Object.keys(data.metadata || {})
              };
            }
          }

          const serializedData: any = {
            id: doc.id,
            userId: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            isRead: data.isRead || false,
            actionUrl: data.actionUrl || null,
            metadata: serializedMetadata
          };
          
          // Convert createdAt Timestamp to ISO string
          if (data.createdAt) {
            if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
              serializedData.createdAt = data.createdAt.toDate().toISOString();
            } else if (data.createdAt._seconds) {
              serializedData.createdAt = new Date(data.createdAt._seconds * 1000).toISOString();
            } else if (data.createdAt instanceof Date) {
              serializedData.createdAt = data.createdAt.toISOString();
            } else if (typeof data.createdAt === 'string') {
              serializedData.createdAt = data.createdAt;
            } else {
              serializedData.createdAt = new Date().toISOString();
            }
          } else {
            serializedData.createdAt = new Date().toISOString();
          }
          
          // Convert updatedAt if it exists
          if (data.updatedAt) {
            if (data.updatedAt.toDate && typeof data.updatedAt.toDate === 'function') {
              serializedData.updatedAt = data.updatedAt.toDate().toISOString();
            } else if (data.updatedAt._seconds) {
              serializedData.updatedAt = new Date(data.updatedAt._seconds * 1000).toISOString();
            } else if (data.updatedAt instanceof Date) {
              serializedData.updatedAt = data.updatedAt.toISOString();
            } else if (typeof data.updatedAt === 'string') {
              serializedData.updatedAt = data.updatedAt;
            }
          }
          
          return serializedData;
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
          // Convert Firestore Timestamps and other non-serializable objects
          // Serialize metadata to ensure it's JSON-safe
          let serializedMetadata = null;
          if (data.metadata) {
            try {
              // Deep clone and serialize metadata, converting any Timestamps
              serializedMetadata = JSON.parse(JSON.stringify(data.metadata, (key, value) => {
                // Convert Firestore Timestamps in metadata
                if (value && typeof value === 'object') {
                  if (value.toDate && typeof value.toDate === 'function') {
                    return value.toDate().toISOString();
                  }
                  if (value._seconds) {
                    return new Date(value._seconds * 1000).toISOString();
                  }
                }
                return value;
              }));
            } catch (metadataError) {
              console.error('Error serializing metadata:', metadataError);
              // If metadata can't be serialized, return a safe version
              serializedMetadata = {
                error: 'Metadata could not be serialized',
                rawKeys: Object.keys(data.metadata || {})
              };
            }
          }

          const serializedData: any = {
            id: doc.id,
            userId: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            isRead: data.isRead || false,
            actionUrl: data.actionUrl || null,
            metadata: serializedMetadata
          };
          
          // Convert createdAt Timestamp to ISO string
          if (data.createdAt) {
            if (data.createdAt.toDate && typeof data.createdAt.toDate === 'function') {
              serializedData.createdAt = data.createdAt.toDate().toISOString();
            } else if (data.createdAt._seconds) {
              serializedData.createdAt = new Date(data.createdAt._seconds * 1000).toISOString();
            } else if (data.createdAt instanceof Date) {
              serializedData.createdAt = data.createdAt.toISOString();
            } else if (typeof data.createdAt === 'string') {
              serializedData.createdAt = data.createdAt;
            } else {
              serializedData.createdAt = new Date().toISOString();
            }
          } else {
            serializedData.createdAt = new Date().toISOString();
          }
          
          // Convert updatedAt if it exists
          if (data.updatedAt) {
            if (data.updatedAt.toDate && typeof data.updatedAt.toDate === 'function') {
              serializedData.updatedAt = data.updatedAt.toDate().toISOString();
            } else if (data.updatedAt._seconds) {
              serializedData.updatedAt = new Date(data.updatedAt._seconds * 1000).toISOString();
            } else if (data.updatedAt instanceof Date) {
              serializedData.updatedAt = data.updatedAt.toISOString();
            } else if (typeof data.updatedAt === 'string') {
              serializedData.updatedAt = data.updatedAt;
            }
          }
          
          return serializedData;
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
      console.error('Query error stack:', queryError?.stack);
      console.error('Query error code:', queryError?.code);
      // Return empty array instead of failing completely
      notifications = [];
      unreadCount = 0;
    }

    // Initialize safeNotifications early to ensure it's always defined
    let safeNotifications: any[] = [];

    // Final safety check: ensure all notifications are fully serializable
    try {
      safeNotifications = (notifications || []).map((notification: any) => {
      try {
        // Test serialization
        JSON.stringify(notification);
        return notification;
      } catch (serializationError) {
        console.error('Notification failed serialization test:', serializationError);
        // Return a minimal safe version
        return {
          id: notification.id || '',
          userId: notification.userId || '',
          type: notification.type || 'system_alert',
          title: notification.title || 'Notification',
          message: notification.message || '',
          isRead: notification.isRead || false,
          createdAt: notification.createdAt || new Date().toISOString(),
          actionUrl: notification.actionUrl || null,
          metadata: null // Remove problematic metadata
        };
      }
    });
    } catch (safetyCheckError: any) {
      console.error('Error in safety check for notifications:', safetyCheckError);
      // If safety check itself fails, just use empty array
      safeNotifications = [];
    }

    // Ensure we always return a valid response
    try {
      return NextResponse.json({
        success: true,
        notifications: safeNotifications,
        unreadCount: unreadCount || 0,
        totalCount: safeNotifications.length
      });
    } catch (jsonError: any) {
      console.error('Error serializing response:', jsonError);
      console.error('Attempted to serialize:', {
        notificationCount: safeNotifications.length,
        firstNotification: safeNotifications[0]
      });
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
    if (error?.message) {
      console.error('Error message:', error.message);
    }
    
    // Return 200 with error details instead of 500, since we're handling it gracefully
    // This ensures the UI doesn't break even if notifications fail to load
    try {
      const errorMessage = error instanceof Error 
        ? error.message 
        : (typeof error === 'string' 
          ? error 
          : (error?.toString ? error.toString() : 'Unknown error'));
      
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to fetch notifications', 
          error: errorMessage,
          notifications: [],
          unreadCount: 0,
          totalCount: 0
        },
        { status: 200 }
      );
    } catch (jsonError: any) {
      // If even JSON serialization fails, return a plain text error with 200 status
      // to prevent the client from seeing a 500
      console.error('Critical: Failed to serialize error response:', jsonError);
      try {
        return new NextResponse(
          JSON.stringify({ 
            success: false, 
            message: 'Internal Server Error',
            notifications: [],
            unreadCount: 0,
            totalCount: 0
          }),
          { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (finalError) {
        // Last resort: return minimal response
        return new NextResponse('{"success":false,"notifications":[],"unreadCount":0,"totalCount":0}', { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
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
