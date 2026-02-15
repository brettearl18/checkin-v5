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
 * Get the Monday that starts a week for a given date
 * For check-ins: Each week starts on Monday, so we find the Monday of that week.
 * If the date is already a Monday, return it. 
 * If the date is before Monday in the week, return that week's Monday.
 * If the date is after Monday in the week, return the same week's Monday.
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate days to subtract to get to Monday of the week containing this date
  // If it's Sunday (0), go back 6 days. If it's Monday (1), go back 0 days. etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  d.setDate(d.getDate() - daysToMonday);
  d.setHours(0, 0, 0, 0);
  
  return d;
}

/**
 * Check if the current time is within the check-in window
 * @param window - The check-in window configuration
 * @param dueDate - Optional: If provided, calculate window relative to this week's Monday
 */
export function isWithinCheckInWindow(
  window?: CheckInWindow,
  dueDate?: Date | string
): { isOpen: boolean; message: string; nextOpenTime?: Date } {
  // If window is not enabled, always allow check-ins
  if (!window || !window.enabled) {
    return { isOpen: true, message: 'Check-ins are always available' };
  }

  const now = new Date();
  
  // If dueDate is provided, calculate window relative to that week's Monday
  if (dueDate) {
    const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
    const weekStart = getWeekStart(due); // Monday of that week
    
    // Window opens: Friday BEFORE that Monday (3 days before)
    const windowStart = new Date(weekStart);
    windowStart.setDate(weekStart.getDate() - 3); // Friday before
    
    // Window closes: Tuesday OF that week (1 day after Monday)
    const windowEnd = new Date(weekStart);
    windowEnd.setDate(weekStart.getDate() + 1); // Tuesday
    
    // Set times
    const { hours: startHours, minutes: startMinutes } = parseTime(window.startTime);
    const { hours: endHours, minutes: endMinutes } = parseTime(window.endTime);
    
    windowStart.setHours(startHours, startMinutes, 0, 0);
    windowEnd.setHours(endHours, endMinutes, 0, 0);
    
    // Check if now is within this specific week's window
    const isOpen = now >= windowStart && now <= windowEnd;
    
    if (isOpen) {
      return {
        isOpen: true,
        message: 'Check-in window is open',
        nextOpenTime: undefined
      };
    } else if (now < windowStart) {
      return {
        isOpen: false,
        message: `Check-in window opens ${windowStart.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${formatTime(window.startTime)}`,
        nextOpenTime: windowStart
      };
    } else {
      // Window has passed for this week - calculate next week's window
      const nextWeekStart = new Date(weekStart);
      nextWeekStart.setDate(weekStart.getDate() + 7);
      const nextWindowStart = new Date(nextWeekStart);
      nextWindowStart.setDate(nextWeekStart.getDate() - 3);
      nextWindowStart.setHours(startHours, startMinutes, 0, 0);
      
      return {
        isOpen: false,
        message: `Check-in window closed. Next window opens ${nextWindowStart.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${formatTime(window.startTime)}`,
        nextOpenTime: nextWindowStart
      };
    }
  }

  // Fallback: Global window check (for backwards compatibility)
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
  // Case 2: We're on Saturday or Sunday (always open if window spans these days)
  else if (currentDay === 6 || currentDay === 0) { // Saturday or Sunday
    // Check if window actually spans these days (startDay is Friday and endDay is after Sunday)
    const startDayNum = getDayOfWeek(window.startDay);
    const endDayNum = getDayOfWeek(window.endDay);
    // If start is Friday (5) and end is Tuesday (2), then Saturday and Sunday are in the window
    // If start is Friday (5) and end is Monday (1), then Saturday and Sunday are in the window
    if (startDayNum < endDayNum || (startDayNum === 5 && endDayNum <= 2)) {
      isOpen = true;
      message = 'Check-in window is open';
    } else {
      isOpen = false;
      // Calculate days until start day
      const daysUntilStart = (startDayNum - currentDay + 7) % 7 || 7;
      const nextOpen = new Date(now);
      nextOpen.setDate(now.getDate() + daysUntilStart);
      nextOpen.setHours(startHours, startMinutes, 0, 0);
      nextOpenTime = nextOpen;
      const startDayName = window.startDay.charAt(0).toUpperCase() + window.startDay.slice(1);
      message = `Check-in window closed. Opens again ${startDayName} at ${formatTime(window.startTime)}`;
    }
  }
  // Case 3: We're on the end day, check if time is before end time
  else if (currentDay === endDay) {
    if (currentTimeInMinutes <= endTimeInMinutes) {
      isOpen = true;
      message = 'Check-in window is open';
    } else {
      isOpen = false;
      // Next open time is next start day
      const daysUntilStart = (startDay - currentDay + 7) % 7 || 7;
      const nextOpen = new Date(now);
      nextOpen.setDate(now.getDate() + daysUntilStart);
      nextOpen.setHours(startHours, startMinutes, 0, 0);
      nextOpenTime = nextOpen;
      const startDayName = window.startDay.charAt(0).toUpperCase() + window.startDay.slice(1);
      message = `Check-in window closed. Opens again ${startDayName} at ${formatTime(window.startTime)}`;
    }
  }
  // Case 4: Days between start and end (shouldn't happen for Friday->Tuesday, but handle for other configs)
  // For Friday->Tuesday: This would catch Monday (which is between Friday and Tuesday)
  else {
    const startDayNum = getDayOfWeek(window.startDay);
    const endDayNum = getDayOfWeek(window.endDay);
    
    // Check if current day is between start and end
    let isBetweenStartAndEnd = false;
    if (startDayNum < endDayNum) {
      // Normal case: start < end (e.g., Monday to Friday)
      isBetweenStartAndEnd = currentDay > startDayNum && currentDay < endDayNum;
    } else {
      // Wrapped case: start > end (e.g., Friday to Tuesday)
      isBetweenStartAndEnd = currentDay > startDayNum || currentDay < endDayNum;
    }
    
    if (isBetweenStartAndEnd) {
      isOpen = true;
      message = 'Check-in window is open';
    } else {
      isOpen = false;
      // Calculate days until start day
      const daysUntilStart = (startDayNum - currentDay + 7) % 7 || 7;
      const nextOpen = new Date(now);
      nextOpen.setDate(now.getDate() + daysUntilStart);
      nextOpen.setHours(startHours, startMinutes, 0, 0);
      nextOpenTime = nextOpen;
      const startDayName = window.startDay.charAt(0).toUpperCase() + window.startDay.slice(1);
      message = `Check-in window closed. Opens again ${startDayName} at ${formatTime(window.startTime)}`;
    }
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
  const startTime = formatTime(window.startTime);
  const endDay = window.endDay.charAt(0).toUpperCase() + window.endDay.slice(1);
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

/**
 * Returns true when the check-in window for the *following* week has opened.
 * Used to auto-mark the previous week's check-in as missed when it's still incomplete.
 * Window: opens Friday 10:00 before the week's Monday, closes Tuesday 12:00 after that Monday.
 * So "next week's window opens" = (this week's Monday + 7 days) - 3 days at 10:00 = this week's Monday + 4 days at 10:00.
 */
export function isNextWeeksWindowOpen(dueDate: Date | string, now: Date = new Date()): boolean {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const dayOfWeek = due.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekMonday = new Date(due);
  weekMonday.setDate(due.getDate() - daysToMonday);
  weekMonday.setHours(0, 0, 0, 0);
  const nextWeekWindowOpen = new Date(weekMonday);
  nextWeekWindowOpen.setDate(weekMonday.getDate() + 4);
  nextWeekWindowOpen.setHours(10, 0, 0, 0);
  return now >= nextWeekWindowOpen;
}

/**
 * Calculate the window close time based on due date and window configuration
 * The window closes on the endDay at endTime of the week containing the due date
 */
export function calculateWindowCloseTime(
  dueDate: Date,
  window: CheckInWindow
): Date {
  if (!window || !window.enabled) {
    // If no window, assume it closes at the due date
    return new Date(dueDate);
  }

  const endDay = getDayOfWeek(window.endDay);
  const { hours: endHours, minutes: endMinutes } = parseTime(window.endTime);

  // Start from the due date and find the endDay in that week
  const dueDayOfWeek = dueDate.getDay();
  
  // Calculate days to add/subtract to get to the endDay
  let daysToAdd = endDay - dueDayOfWeek;
  
  // If endDay is before dueDayOfWeek in the week (e.g., Monday is endDay but dueDate is Friday),
  // we need to go to the previous occurrence, which means subtracting days
  // But since windows typically span forward (Friday to Monday), we want the endDay after the due date
  // So if endDay < dueDayOfWeek, we go forward to next week's endDay
  if (endDay < dueDayOfWeek) {
    daysToAdd = (7 - dueDayOfWeek) + endDay; // Go to next week
  }

  const closeTime = new Date(dueDate);
  closeTime.setDate(dueDate.getDate() + daysToAdd);
  closeTime.setHours(endHours, endMinutes, 0, 0);
  
  return closeTime;
}
