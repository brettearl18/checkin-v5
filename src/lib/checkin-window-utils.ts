/**
 * Check-in window utility functions
 * Default window: Friday 10:00 AM to Monday 10:00 PM
 */

export interface CheckInWindow {
  enabled: boolean;
  startDay: string; // 'friday'
  startTime: string; // '10:00'
  endDay: string; // 'monday'
  endTime: string; // '22:00'
}

export const DEFAULT_CHECK_IN_WINDOW: CheckInWindow = {
  enabled: true,
  startDay: 'friday',
  startTime: '10:00',
  endDay: 'monday',
  endTime: '22:00'
};

/**
 * Get day of week as number (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
function getDayOfWeek(dayName: string): number {
  const days: { [key: string]: number } = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };
  return days[dayName.toLowerCase()] ?? 0;
}

/**
 * Convert time string (HH:MM) to hours and minutes
 */
function parseTime(timeString: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeString.split(':').map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Check if the current time is within the check-in window
 */
export function isWithinCheckInWindow(
  window?: CheckInWindow,
  timezone?: string
): { isOpen: boolean; message: string; nextOpenTime?: Date } {
  // If window is not enabled, always allow check-ins
  if (!window || !window.enabled) {
    return { isOpen: true, message: 'Check-ins are always available' };
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const startDay = getDayOfWeek(window.startDay);
  const endDay = getDayOfWeek(window.endDay);
  const { hours: startHours, minutes: startMinutes } = parseTime(window.startTime);
  const { hours: endHours, minutes: endMinutes } = parseTime(window.endTime);

  // Convert current time to minutes for easier comparison
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const startTimeInMinutes = startHours * 60 + startMinutes;
  const endTimeInMinutes = endHours * 60 + endMinutes;

  // Handle the case where window spans across multiple days (Friday to Monday)
  // This means: Friday 10:00 AM -> Saturday -> Sunday -> Monday 10:00 PM
  
  // Check if we're in the window period
  let isOpen = false;
  let message = '';
  let nextOpenTime: Date | undefined;

  // Case 1: We're on Friday, check if time is after start time
  if (currentDay === startDay) {
    if (currentTimeInMinutes >= startTimeInMinutes) {
      isOpen = true;
      message = 'Check-in window is open';
    } else {
      isOpen = false;
      const nextOpen = new Date(now);
      nextOpen.setHours(startHours, startMinutes, 0, 0);
      nextOpenTime = nextOpen;
      message = `Check-in window opens Friday at ${formatTime(window.startTime)}`;
    }
  }
  // Case 2: We're on Saturday or Sunday (always open)
  else if (currentDay === 6 || currentDay === 0) { // Saturday or Sunday
    isOpen = true;
    message = 'Check-in window is open';
  }
  // Case 3: We're on Monday, check if time is before end time
  else if (currentDay === endDay) {
    if (currentTimeInMinutes <= endTimeInMinutes) {
      isOpen = true;
      message = 'Check-in window is open';
    } else {
      isOpen = false;
      // Next open time is next Friday
      const daysUntilFriday = (5 - currentDay + 7) % 7 || 7; // Friday is day 5
      const nextOpen = new Date(now);
      nextOpen.setDate(now.getDate() + daysUntilFriday);
      nextOpen.setHours(startHours, startMinutes, 0, 0);
      nextOpenTime = nextOpen;
      message = `Check-in window closed. Opens again Friday at ${formatTime(window.startTime)}`;
    }
  }
  // Case 4: We're on Tuesday, Wednesday, or Thursday (closed)
  else {
    isOpen = false;
    // Calculate days until Friday
    const daysUntilFriday = (5 - currentDay + 7) % 7 || 7;
    const nextOpen = new Date(now);
    nextOpen.setDate(now.getDate() + daysUntilFriday);
    nextOpen.setHours(startHours, startMinutes, 0, 0);
    nextOpenTime = nextOpen;
    
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextOpen.getDay()];
    message = `Check-in window closed. Opens again ${dayName} at ${formatTime(window.startTime)}`;
  }

  return { isOpen, message, nextOpenTime };
}

/**
 * Format time string for display (HH:MM -> HH:MM AM/PM)
 */
function formatTime(timeString: string): string {
  const { hours, minutes } = parseTime(timeString);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Get a human-readable description of the check-in window
 */
export function getCheckInWindowDescription(window?: CheckInWindow): string {
  if (!window || !window.enabled) {
    return 'Check-ins available anytime';
  }

  const startDay = window.startDay.charAt(0).toUpperCase() + window.startDay.slice(1);
  const endDay = window.endDay.charAt(0).toUpperCase() + window.endDay.slice(1);
  const startTime = formatTime(window.startTime);
  const endTime = formatTime(window.endTime);

  return `${startDay} ${startTime} - ${endDay} ${endTime}`;
}

/**
 * Get the next available check-in window time
 */
export function getNextCheckInWindowTime(window?: CheckInWindow): Date | null {
  if (!window || !window.enabled) {
    return null;
  }

  const result = isWithinCheckInWindow(window);
  if (result.isOpen) {
    return new Date(); // Currently open
  }

  return result.nextOpenTime || null;
}


