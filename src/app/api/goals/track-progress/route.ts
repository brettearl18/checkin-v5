import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { calculateGoalProgress, shouldNotifyGoalStatus } from '@/lib/goal-tracking';
import { notificationService } from '@/lib/notification-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/goals/track-progress
 * Calculate progress for all goals for a client and send notifications if needed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch client data
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const coachId = clientData?.coachId;

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Client has no assigned coach'
      }, { status: 400 });
    }

    // Fetch all active goals for client
    const goalsSnapshot = await db.collection('clientGoals')
      .where('clientId', '==', clientId)
      .where('status', 'in', ['active', 'in_progress'])
      .get();

    if (goalsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No active goals to track',
        goalProgress: []
      });
    }

    // Fetch recent check-ins (last 12 weeks)
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const checkInsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('status', '==', 'completed')
      .get();

    const checkIns = checkInsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        completedAt: data.completedAt?.toDate?.() || new Date(data.completedAt),
        score: data.score || 0
      };
    }).filter(ci => ci.completedAt >= twelveWeeksAgo);

    // Fetch recent measurements (last 12 weeks)
    const measurementsSnapshot = await db.collection('client_measurements')
      .where('clientId', '==', clientId)
      .get();

    const measurements = measurementsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate?.() || data.measuredAt?.toDate?.() || data.createdAt?.toDate?.() || new Date(data.date || data.createdAt),
        value: data.bodyWeight || data.value || data.measurementValue
      };
    }).filter(m => m.date >= twelveWeeksAgo);

    // Calculate progress for each goal
    const goalProgress: any[] = [];
    const notifications: any[] = [];

    for (const goalDoc of goalsSnapshot.docs) {
      const goal = {
        id: goalDoc.id,
        ...goalDoc.data(),
        deadline: goalDoc.data().deadline?.toDate?.() || new Date(goalDoc.data().deadline),
        createdAt: goalDoc.data().createdAt?.toDate?.() || new Date(goalDoc.data().createdAt)
      };

      // Calculate progress
      const progress = await calculateGoalProgress(goal, checkIns, measurements);

      // Get previous status from goal
      const previousStatus = goal.status || null;

      // Update goal in Firestore with new progress
      await goalDoc.ref.update({
        currentValue: progress.currentValue,
        progress: progress.progress,
        status: progress.status,
        lastProgressUpdate: new Date(),
        expectedProgress: progress.expectedProgress
      });

      goalProgress.push(progress);

      // Check if notification needed
      if (shouldNotifyGoalStatus(previousStatus, progress.status, goal)) {
        let title: string;
        let message: string;
        let type: string;

        switch (progress.status) {
          case 'achieved':
            title = '🎉 Goal Achieved!';
            message = `${clientData?.displayName || clientData?.firstName || 'Client'} has achieved their goal: "${goal.title}"`;
            type = 'goal_achieved';
            break;
          case 'at_risk':
            title = '⚠️ Goal At Risk';
            message = `${clientData?.displayName || clientData?.firstName || 'Client'}'s goal "${goal.title}" is falling behind. Progress: ${progress.progress.toFixed(0)}% (Expected: ${progress.expectedProgress.toFixed(0)}%)`;
            type = 'goal_at_risk';
            break;
          case 'overdue':
            title = '⏰ Goal Overdue';
            message = `${clientData?.displayName || clientData?.firstName || 'Client'}'s goal "${goal.title}" is overdue. Progress: ${progress.progress.toFixed(0)}%`;
            type = 'goal_overdue';
            break;
          case 'stalled':
            title = '📉 Goal Progress Stalled';
            message = `${clientData?.displayName || clientData?.firstName || 'Client'}'s goal "${goal.title}" has stalled. Progress: ${progress.progress.toFixed(0)}% (Expected: ${progress.expectedProgress.toFixed(0)}%)`;
            type = 'goal_stalled';
            break;
          default:
            continue; // Skip notification for other statuses
        }

        // Create notification
        try {
          await notificationService.create({
            userId: coachId,
            type: type,
            title: title,
            message: message,
            actionUrl: `/clients/${clientId}?tab=goals`,
            metadata: {
              clientId,
              goalId: goal.id,
              goalTitle: goal.title,
              progress: progress.progress,
              status: progress.status,
              currentValue: progress.currentValue,
              targetValue: progress.targetValue
            }
          });

          notifications.push({ goalId: goal.id, type, title });
        } catch (notifError) {
          console.error(`Error creating notification for goal ${goal.id}:`, notifError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Tracked ${goalProgress.length} goal(s). Sent ${notifications.length} notification(s).`,
      goalProgress,
      notifications
    });

  } catch (error) {
    console.error('Error tracking goal progress:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to track goal progress',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}




