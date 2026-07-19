/**
 * Canonical weekday-schedule interpretation for routine steps.
 *
 * `scheduledDays` uses JS day numbering (0 = Sunday … 6 = Saturday) and an
 * EMPTY array means "every day" — a convention that was previously
 * reimplemented in four places (RoutinesScreen, routineStatus, dailyView,
 * and the calendar). Everything that answers "does this step run on day X?"
 * must go through here, so the Today checklist and the calendar can never
 * disagree.
 */
export function isScheduledOnDay(scheduledDays: number[] | undefined, dayOfWeek: number): boolean {
  const days = scheduledDays ?? [];
  return days.length === 0 || days.includes(dayOfWeek);
}
