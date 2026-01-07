import { getDb } from './firebase-server';

export interface NotificationData {
  userId: string;
  type: 'check_in_due' | 'message_received' | 'goal_achieved' | 'check_in_completed' | 'form_assigned' | 'coach_message' | 'system_alert' | 'coach_feedback_ready' | 'coach_feedback_available' | 'onboarding_submitted' | 'client_approved_feedback';
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: {
    clientId?: string;
    coachId?: string;
    formId?: string;
    assignmentId?: string;
    messageId?: string;
    responseId?: string;
    onboardingId?: string;
  };
}

class NotificationService {
  private db = getDb();

  // Create a check-in due notification for clients
  async createCheckInDueNotification(clientId: string, assignmentId: string, formTitle: string, dueDate: Date) {
    const notification: Omit<NotificationData, 'userId'> = {
      type: 'check_in_due',
      title: 'Check-in Due',
      message: `Your ${formTitle} check-in is due ${this.formatDueDate(dueDate)}. Please complete it to track your progress.`,
      actionUrl: `/client-portal/check-in/${assignmentId}`,
      metadata: {
        clientId,
        assignmentId
      }
    };

    return this.createNotification(clientId, notification);
  }

  // Create a message received notification
  async createMessageReceivedNotification(recipientId: string, senderName: string, messageId: string) {
    const notification: Omit<NotificationData, 'userId'> = {
      type: 'message_received',
      title: 'New Message',
      message: `You have a new message from ${senderName}.`,
      actionUrl: '/messages',
      metadata: {
        messageId
      }
    };

    return this.createNotification(recipientId, notification);
  }

  // Create a goal achieved notification
  async createGoalAchievedNotification(clientId: string, goalTitle: string) {
    const notification: Omit<NotificationData, 'userId'> = {
      type: 'goal_achieved',
      title: 'Goal Achieved! 🎉',
      message: `Congratulations! You've achieved your goal: "${goalTitle}". Keep up the great work!`,
      actionUrl: '/client-portal/progress',
      metadata: {
        clientId
      }
    };

    return this.createNotification(clientId, notification);
  }

  // Create a check-in completed notification for coaches
  async createCheckInCompletedNotification(coachId: string, clientName: string, formTitle: string, score: number, responseId?: string, clientId?: string, formId?: string) {
    const notification: Omit<NotificationData, 'userId'> = {
      type: 'check_in_completed',
      title: 'Check-in Completed',
      message: `${clientName} completed their ${formTitle} check-in with a score of ${score}%.`,
      actionUrl: responseId ? `/responses/${responseId}` : '/clients',
      metadata: {
        coachId,
        responseId,
        clientId,
        formId,
        score: score.toString(),
        formTitle
      }
    };

    return this.createNotification(coachId, notification);
  }

  // Create a form assigned notification for clients
  async createFormAssignedNotification(clientId: string, formTitle: string, assignmentId: string) {
    const notification: Omit<NotificationData, 'userId'> = {
      type: 'form_assigned',
      title: 'New Check-in Assigned',
      message: `Your coach has assigned you a new check-in: "${formTitle}". You can complete it when you're ready.`,
      actionUrl: `/client-portal/check-in/${assignmentId}`,
      metadata: {
        clientId,
        assignmentId
      }
    };

    return this.createNotification(clientId, notification);
  }

  // Create a coach message notification
  async createCoachMessageNotification(clientId: string, coachName: string) {
    const notification: Omit<NotificationData, 'userId'> = {
      type: 'coach_message',
      title: 'Message from Coach',
      message: `Your coach ${coachName} has sent you a message.`,
      actionUrl: '/client-portal/messages',
      metadata: {
        clientId
      }
    };

    return this.createNotification(clientId, notification);
  }

  // Create a system alert notification
  async createSystemAlertNotification(userId: string, title: string, message: string, actionUrl?: string) {
    const notification: Omit<NotificationData, 'userId'> = {
      type: 'system_alert',
      title,
      message,
      actionUrl
    };

    return this.createNotification(userId, notification);
  }

  // Create a client onboarding notification
  async createClientOnboardingNotification(clientId: string, coachName: string) {
    const notification: Omit<NotificationData, 'userId'> = {
      type: 'system_alert',
      title: 'Welcome to CheckinV5!',
      message: `Welcome! Your coach ${coachName} has set up your account. Complete your first check-in to get started.`,
      actionUrl: '/client-portal',
      metadata: {
        clientId
      }
    };

    return this.createNotification(clientId, notification);
  }

  // Create a client at risk notification for coaches
  async createClientAtRiskNotification(coachId: string, clientName: string, riskFactors: string[]) {
    const notification: Omit<NotificationData, 'userId'> = {
      type: 'system_alert',
      title: 'Client Needs Attention',
      message: `${clientName} may need additional support. Risk factors: ${riskFactors.join(', ')}.`,
      actionUrl: '/clients',
      metadata: {
        coachId
      }
    };

    return this.createNotification(coachId, notification);
  }

  // Private method to create notification in database
  private async createNotification(userId: string, notificationData: Omit<NotificationData, 'userId'>) {
    try {
      const notification = {
        userId,
        ...notificationData,
        isRead: false,
        createdAt: new Date()
      };

      const docRef = await this.db.collection('notifications').add(notification);
      
      console.log(`📧 Notification created: ${notificationData.type} for user ${userId}`);
      
      // Send push notification if user has subscription and preferences allow it
      try {
        await this.sendPushNotificationIfAllowed(userId, notificationData, notificationData.actionUrl);
      } catch (pushError) {
        // Don't fail notification creation if push fails
        console.error('Error sending push notification:', pushError);
      }
      
      return {
        success: true,
        notificationId: docRef.id
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Private method to send push notification if user preferences allow it
  private async sendPushNotificationIfAllowed(
    userId: string,
    notificationData: Omit<NotificationData, 'userId'>,
    actionUrl?: string
  ) {
    try {
      // Get client preferences
      const clientDoc = await this.db.collection('clients').doc(userId).get();
      if (!clientDoc.exists) {
        // Not a client, skip push notifications
        return;
      }

      const clientData = clientDoc.data();
      const pushPreferences = clientData?.pushNotificationPreferences || {};

      // Check if push notifications are enabled for this notification type
      const notificationType = notificationData.type;
      const preferenceKey = this.getPreferenceKeyForNotificationType(notificationType);
      
      // Default to enabled if preference not set (opt-in by default)
      const isEnabled = pushPreferences[preferenceKey] !== false;

      if (!isEnabled) {
        console.log(`Push notification skipped for ${userId}: ${preferenceKey} disabled`);
        return;
      }

      // Import push notification service dynamically to avoid loading if not needed
      const { sendPushNotification } = await import('./push-notification-service');
      
      await sendPushNotification(userId, {
        title: notificationData.title,
        body: notificationData.message,
        url: actionUrl || notificationData.actionUrl || '/client-portal',
        tag: notificationType,
        icon: '/icon-192.png',
        badge: '/icon-192.png'
      });
    } catch (error) {
      // Silently fail - we don't want to break notification creation
      console.error('Error in sendPushNotificationIfAllowed:', error);
    }
  }

  // Map notification types to preference keys
  private getPreferenceKeyForNotificationType(type: string): string {
    const typeMap: Record<string, string> = {
      'message_received': 'newMessageFromCoach',
      'check_in_assigned': 'newCheckInOpen',
      'check_in_due': 'newCheckInOpen',
      'check_in_completed': 'checkInCompleted',
      'coach_feedback': 'newCheckInReplyFromCoach',
      'goal_achieved': 'goalAchieved',
      'system_alert': 'systemAlerts',
      'client_onboarding': 'systemAlerts'
    };

    return typeMap[type] || 'other';
  }

  // Helper method to format due date
  private formatDueDate(dueDate: Date): string {
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'overdue';
    } else if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'tomorrow';
    } else {
      return `in ${diffDays} days`;
    }
  }

  // Get notification count for a user
  async getNotificationCount(userId: string): Promise<{ unread: number; total: number }> {
    try {
      const [unreadSnapshot, totalSnapshot] = await Promise.all([
        this.db.collection('notifications')
          .where('userId', '==', userId)
          .where('isRead', '==', false)
          .get(),
        this.db.collection('notifications')
          .where('userId', '==', userId)
          .get()
      ]);

      return {
        unread: unreadSnapshot.size,
        total: totalSnapshot.size
      };
    } catch (error) {
      console.error('Error getting notification count:', error);
      return { unread: 0, total: 0 };
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      await this.db.collection('notifications').doc(notificationId).update({
        isRead: true,
        updatedAt: new Date()
      });
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const snapshot = await this.db.collection('notifications')
        .where('userId', '==', userId)
        .where('isRead', '==', false)
        .get();

      const batch = this.db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          isRead: true,
          updatedAt: new Date()
        });
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }
}

export const notificationService = new NotificationService(); 