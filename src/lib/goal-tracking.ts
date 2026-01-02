// Goal Tracking Utility Functions
// Matches goals to check-in and measurement data to track progress

import { getDb } from './firebase-server';

export interface GoalProgress {
  goalId: string;
  goal: any;
  currentValue: number;
  targetValue: number;
  progress: number;
  status: 'on_track' | 'at_risk' | 'achieved' | 'stalled' | 'overdue';
  timeRemaining: number; // days
  lastUpdate: Date;
  trend: 'improving' | 'stable' | 'declining';
  expectedProgress: number; // percentage based on time elapsed
}

/**
 * Calculate expected progress percentage based on time elapsed
 */
export function calculateExpectedProgress(createdAt: Date | string, deadline: Date | string): number {
  const start = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const end = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();

  const totalTime = end.getTime() - start.getTime();
  const elapsedTime = now.getTime() - start.getTime();

  if (totalTime <= 0) return 100; // Deadline passed
  if (elapsedTime <= 0) return 0; // Not started yet

  const percentage = (elapsedTime / totalTime) * 100;
  return Math.min(Math.max(percentage, 0), 100);
}

/**
 * Calculate trend based on recent progress updates
 */
export function calculateTrend(goal: any, checkIns: any[], measurements: any[]): 'improving' | 'stable' | 'declining' {
  // For now, return stable - can be enhanced with historical data
  return 'stable';
}

/**
 * Match goal to relevant check-in or measurement data
 */
export async function matchGoalToData(
  goal: any,
  checkIns: any[],
  measurements: any[]
): Promise<number> {
  // Weight goals - match with body weight measurements
  if (goal.category === 'fitness' && goal.unit.toLowerCase().includes('kg')) {
    const weightMeasurements = measurements
      .filter(m => {
        const type = m.type || m.measurementType || '';
        return type.toLowerCase().includes('weight') || type.toLowerCase().includes('body_weight');
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || a.measuredAt).getTime();
        const dateB = new Date(b.date || b.createdAt || b.measuredAt).getTime();
        return dateB - dateA;
      });

    if (weightMeasurements.length > 0) {
      return weightMeasurements[0].value || weightMeasurements[0].bodyWeight || goal.currentValue;
    }
  }

  // Measurement goals - match with body measurements
  if (goal.category === 'fitness' && ['cm', 'inches', 'in'].includes(goal.unit.toLowerCase())) {
    const relevantMeasurements = measurements
      .filter(m => {
        const type = m.type || m.measurementType || '';
        const unit = (m.unit || '').toLowerCase();
        return unit === goal.unit.toLowerCase() || 
               (goal.title.toLowerCase().includes('waist') && type.toLowerCase().includes('waist')) ||
               (goal.title.toLowerCase().includes('chest') && type.toLowerCase().includes('chest')) ||
               (goal.title.toLowerCase().includes('hip') && type.toLowerCase().includes('hip'));
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || a.measuredAt).getTime();
        const dateB = new Date(b.date || b.createdAt || b.measuredAt).getTime();
        return dateB - dateA;
      });

    if (relevantMeasurements.length > 0) {
      return relevantMeasurements[0].value || goal.currentValue;
    }
  }

  // For other goal types, return current value from goal
  return goal.currentValue || 0;
}

/**
 * Calculate goal progress and status
 */
export async function calculateGoalProgress(
  goal: any,
  checkIns: any[],
  measurements: any[]
): Promise<GoalProgress> {
  // Get current value from matched data
  const currentValue = await matchGoalToData(goal, checkIns, measurements);
  const targetValue = goal.targetValue || 1;
  
  // Calculate progress percentage
  const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
  
  // Calculate time remaining
  const deadline = typeof goal.deadline === 'string' ? new Date(goal.deadline) : goal.deadline;
  const createdAt = typeof goal.createdAt === 'string' ? new Date(goal.createdAt) : goal.createdAt;
  const now = new Date();
  const timeRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate expected progress
  const expectedProgress = calculateExpectedProgress(createdAt, deadline);
  
  // Determine status
  let status: GoalProgress['status'];
  
  if (progress >= 100) {
    status = 'achieved';
  } else if (timeRemaining < 0) {
    status = 'overdue';
  } else if (progress >= expectedProgress * 0.9) {
    status = 'on_track';
  } else if (progress >= expectedProgress * 0.7) {
    status = 'at_risk';
  } else {
    status = 'stalled';
  }
  
  // Calculate trend
  const trend = calculateTrend(goal, checkIns, measurements);
  
  return {
    goalId: goal.id,
    goal,
    currentValue,
    targetValue,
    progress: Math.round(progress * 100) / 100,
    status,
    timeRemaining,
    lastUpdate: new Date(),
    trend,
    expectedProgress: Math.round(expectedProgress * 100) / 100
  };
}

/**
 * Check if notification should be sent for goal status change
 */
export function shouldNotifyGoalStatus(
  previousStatus: string | null,
  currentStatus: GoalProgress['status'],
  goal: any
): boolean {
  // Always notify on achievement
  if (currentStatus === 'achieved') return true;
  
  // Notify on status changes (except if already at risk/stalled)
  if (previousStatus && previousStatus !== currentStatus) {
    if (currentStatus === 'at_risk' || currentStatus === 'overdue' || currentStatus === 'stalled') {
      return true;
    }
  }
  
  // Notify if newly at risk or overdue
  if (!previousStatus && (currentStatus === 'at_risk' || currentStatus === 'overdue')) {
    return true;
  }
  
  return false;
}


