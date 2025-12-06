import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/lib/notification-service';

export async function POST(request: NextRequest) {
  try {
    const { userId, type } = await request.json();

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'User ID is required'
      }, { status: 400 });
    }

    let result;
    const timestamp = new Date();

    switch (type) {
      case 'check_in_due':
        result = await notificationService.createCheckInDueNotification(
          userId,
          'test-assignment-id',
          'Test Check-in',
          timestamp
        );
        break;
      case 'message_received':
        result = await notificationService.createMessageReceivedNotification(
          userId,
          'Test Coach',
          'test-message-id'
        );
        break;
      case 'goal_achieved':
        result = await notificationService.createGoalAchievedNotification(
          userId,
          'Test Goal'
        );
        break;
      case 'check_in_completed':
        result = await notificationService.createCheckInCompletedNotification(
          userId,
          'Test Client',
          'Test Form',
          85
        );
        break;
      case 'form_assigned':
        result = await notificationService.createFormAssignedNotification(
          userId,
          'Test Form',
          'test-assignment-id'
        );
        break;
      case 'coach_message':
        result = await notificationService.createCoachMessageNotification(
          userId,
          'Test Coach'
        );
        break;
      case 'system_alert':
        result = await notificationService.createSystemAlertNotification(
          userId,
          'Test Alert',
          'This is a test system alert notification.',
          '/test'
        );
        break;
      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid notification type'
        }, { status: 400 });
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test notification created successfully',
        notificationId: result.notificationId
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to create test notification',
        error: result.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error creating test notification:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create test notification', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 