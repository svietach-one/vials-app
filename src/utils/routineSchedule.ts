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

/**
 * Monday of the week containing `d` (Mon-start week, matching the Mo…Su day
 * strip order in `PlannerBlock`). Relocated here from `PlannerBlock.tsx` so
 * `RoutinesScreen` can resolve the SAME calendar `Date` for a selected
 * day-of-week that the strip already renders — computing it twice would risk
 * the two silently drifting apart.
 */
export function getWeekStart(d: Date): Date {
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return monday;
}

/**
 * The calendar `Date` for `dow` (0 = Sun … 6 = Sat) within the week
 * containing `now` — the same week the Mo…Su strip currently displays.
 * Preserves `now`'s time-of-day (not normalized to midnight), so a plain
 * `Date` comparison against `now` elsewhere answers "is this selection in
 * the future" without a separate calendar-day truncation step.
 */
export function dateForDow(dow: number, now: Date = new Date()): Date {
  const weekStart = getWeekStart(now);
  // Mo=1..Sa=6 sit at offsets 0..5 from Monday; Su=0 wraps to offset 6.
  const offset = dow === 0 ? 6 : dow - 1;
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + offset);
  return date;
}
