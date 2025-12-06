/**
 * Timezone utility functions for the application
 */

export interface TimezoneInfo {
  value: string;
  label: string;
  offset: string;
}

export const timezones: TimezoneInfo[] = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: 'UTC-9' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: 'UTC-10' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)', offset: 'UTC+0' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)', offset: 'UTC+1' },
  { value: 'Europe/Berlin', label: 'Central European Time (CET)', offset: 'UTC+1' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)', offset: 'UTC+9' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)', offset: 'UTC+8' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)', offset: 'UTC+5:30' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)', offset: 'UTC+10' },
  { value: 'Australia/Perth', label: 'Australian Western Time (AWT)', offset: 'UTC+8' },
  { value: 'Pacific/Auckland', label: 'New Zealand Standard Time (NZST)', offset: 'UTC+12' }
];

/**
 * Get the current time in a specific timezone
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  try {
    return new Date().toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (error) {
    return 'Invalid timezone';
  }
}

/**
 * Convert a date to a specific timezone
 */
export function convertDateToTimezone(date: Date | string, timezone: string): Date {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const utc = dateObj.getTime() + (dateObj.getTimezoneOffset() * 60000);
    const targetTime = new Date(utc + (getTimezoneOffset(timezone) * 60000));
    return targetTime;
  } catch (error) {
    console.error('Error converting date to timezone:', error);
    return new Date(date);
  }
}

/**
 * Format a date for display in a specific timezone
 */
export function formatDateForTimezone(
  date: Date | string, 
  timezone: string, 
  options: Intl.DateTimeFormatOptions = {}
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    };
    
    return dateObj.toLocaleString('en-US', {
      ...defaultOptions,
      timeZone: timezone
    });
  } catch (error) {
    console.error('Error formatting date for timezone:', error);
    return typeof date === 'string' ? date : date.toLocaleString();
  }
}

/**
 * Get the timezone offset in minutes for a given timezone
 */
function getTimezoneOffset(timezone: string): number {
  try {
    const date = new Date();
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const targetTime = new Date(utc + (new Date().toLocaleString('en-US', { timeZone: timezone })));
    return (targetTime.getTime() - utc) / 60000;
  } catch (error) {
    return 0;
  }
}

/**
 * Get the user's current timezone
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Check if a timezone is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get timezone options for select dropdown
 */
export function getTimezoneOptions(): { value: string; label: string }[] {
  return timezones.map(tz => ({
    value: tz.value,
    label: `${tz.label} (${tz.offset})`
  }));
}

/**
 * Convert a date to the user's local timezone for display
 */
export function formatDateForUser(date: Date | string, userTimezone?: string): string {
  const timezone = userTimezone || getUserTimezone();
  return formatDateForTimezone(date, timezone, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get the start and end of the current week in a specific timezone
 */
export function getWeekBounds(timezone: string = getUserTimezone()): { start: Date; end: Date } {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // End of current week (Saturday)
  endOfWeek.setHours(23, 59, 59, 999);

  return { start: startOfWeek, end: endOfWeek };
}

/**
 * Check if a date falls within the current week in a specific timezone
 */
export function isDateInCurrentWeek(date: Date | string, timezone: string = getUserTimezone()): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const { start, end } = getWeekBounds(timezone);
  
  return dateObj >= start && dateObj <= end;
} 