/**
 * Ensures check-in links use the correct assignment id so the form opens the right week.
 * For recurring check-ins, the link must use the synthetic id (baseId_week_N); otherwise
 * the form loads the base document and can show the wrong week (e.g. Week 9 instead of Week 8).
 */
export function getCheckInLinkId(checkin: {
  id: string;
  isRecurring?: boolean;
  recurringWeek?: number | null;
}): string {
  if (
    checkin.isRecurring &&
    checkin.recurringWeek != null &&
    !String(checkin.id).includes('_week_')
  ) {
    return `${checkin.id}_week_${checkin.recurringWeek}`;
  }
  return checkin.id;
}
