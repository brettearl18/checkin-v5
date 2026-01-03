/**
 * Utility functions for calculating measurement task dates
 */

export interface MeasurementSchedule {
  id?: string;
  clientId: string;
  coachId: string;
  firstFridayDate: string; // ISO date string
  frequency: 'fortnightly' | 'weekly' | 'monthly';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Calculate the next measurement task dates based on schedule
 * @param schedule - The measurement schedule
 * @param limit - Maximum number of dates to return (default: 12 for 6 months)
 * @returns Array of ISO date strings for upcoming measurement tasks
 */
export function calculateNextMeasurementDates(
  schedule: MeasurementSchedule,
  limit: number = 12
): string[] {
  if (!schedule.isActive || !schedule.firstFridayDate) {
    return [];
  }

  const dates: string[] = [];
  const firstFriday = new Date(schedule.firstFridayDate);
  
  // Ensure we're working with a Friday (day 5)
  firstFriday.setHours(0, 0, 0, 0);
  const firstFridayDay = firstFriday.getDay();
  
  // If not a Friday, adjust to the next Friday
  if (firstFridayDay !== 5) {
    const daysToAdd = (5 - firstFridayDay + 7) % 7 || 7;
    firstFriday.setDate(firstFriday.getDate() + daysToAdd);
  }

  let currentDate = new Date(firstFriday);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine days to add based on frequency
  let daysToAdd = 0;
  switch (schedule.frequency) {
    case 'weekly':
      daysToAdd = 7;
      break;
    case 'fortnightly':
      daysToAdd = 14;
      break;
    case 'monthly':
      daysToAdd = 28; // Approximately 4 weeks
      break;
    default:
      daysToAdd = 14; // Default to fortnightly
  }

  // Start from first Friday, only include future dates
  while (dates.length < limit) {
    if (currentDate >= today) {
      dates.push(currentDate.toISOString().split('T')[0]);
    }
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + daysToAdd);
  }

  return dates;
}

/**
 * Get the next upcoming measurement task date
 * @param schedule - The measurement schedule
 * @returns ISO date string or null if no upcoming dates
 */
export function getNextMeasurementDate(schedule: MeasurementSchedule): string | null {
  const dates = calculateNextMeasurementDates(schedule, 1);
  return dates.length > 0 ? dates[0] : null;
}

/**
 * Check if a measurement task is due today or overdue
 * @param dueDate - ISO date string
 * @returns Object with status and days overdue/until due
 */
export function getMeasurementTaskStatus(dueDate: string): {
  status: 'upcoming' | 'due' | 'overdue';
  days: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: 'overdue', days: Math.abs(diffDays) };
  } else if (diffDays === 0) {
    return { status: 'due', days: 0 };
  } else {
    return { status: 'upcoming', days: diffDays };
  }
}

/**
 * Calculate the 2nd Friday after a given start date
 * @param startDate - The start date
 * @returns Date object for the 2nd Friday, or null if invalid
 */
export function calculateSecondFriday(startDate: Date): Date | null {
  if (!startDate) return null;
  
  const date = new Date(startDate);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 5 = Friday
  
  // Calculate days until next Friday
  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  if (daysUntilFriday === 0 && dayOfWeek !== 5) {
    daysUntilFriday = 7; // If not Friday, go to next Friday
  } else if (dayOfWeek === 5) {
    daysUntilFriday = 7; // If today is Friday, go to next Friday
  }
  
  // Get first Friday
  const firstFriday = new Date(date);
  firstFriday.setDate(date.getDate() + daysUntilFriday);
  
  // Add 7 more days to get 2nd Friday
  const secondFriday = new Date(firstFriday);
  secondFriday.setDate(firstFriday.getDate() + 7);
  
  return secondFriday;
}




