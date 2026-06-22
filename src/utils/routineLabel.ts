import type { Routine } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductSchedule {
  morning: boolean;
  evening: boolean;
  /** 0=Sun … 6=Sat. Empty array means every day. */
  scheduledDays: number[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Display order: Mo Tu We Th Fr Sa Su */
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const DOW_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  0: 'Sun',
};

// ─── Pure utilities ───────────────────────────────────────────────────────────

/**
 * Derives the current ProductSchedule for a product from the live routines list.
 * Returns `{ morning: false, evening: false, scheduledDays: [] }` when the
 * product is not scheduled in either routine.
 */
export function deriveProductSchedule(
  routines: Routine[],
  productId: string,
): ProductSchedule {
  const morningRoutine = routines.find((r) => r.timeOfDay === 'morning');
  const eveningRoutine = routines.find((r) => r.timeOfDay === 'evening');

  const morningStep = morningRoutine?.steps.find((s) => s.productId === productId);
  const eveningStep = eveningRoutine?.steps.find((s) => s.productId === productId);

  // Prefer morning step's days; fall back to evening's; empty means every day
  const scheduledDays = (morningStep ?? eveningStep)?.scheduledDays ?? [];

  return {
    morning: morningStep !== undefined,
    evening: eveningStep !== undefined,
    scheduledDays,
  };
}

/**
 * Formats the "In Routine" button label from a ProductSchedule.
 * Returns null when the product is not in any routine — callers should
 * display "Add to Routine" in that case.
 *
 * Examples:
 *   { morning: true,  evening: false, scheduledDays: [] }       → "In Routine (Everyday • Morning)"
 *   { morning: true,  evening: true,  scheduledDays: [1,3,5] }  → "In Routine (Mon, Wed, Fri • Morning, Evening)"
 *   { morning: false, evening: true,  scheduledDays: [0,6] }    → "In Routine (Sat, Sun • Evening)"
 */
export function formatRoutineLabel(schedule: ProductSchedule): string | null {
  const { morning, evening, scheduledDays } = schedule;

  if (!morning && !evening) return null;

  const dayPart =
    scheduledDays.length === 0
      ? 'Everyday'
      : DOW_ORDER.filter((dow) => scheduledDays.includes(dow))
          .map((dow) => DOW_LABELS[dow])
          .join(', ');

  const timeParts: string[] = [];
  if (morning) timeParts.push('Morning');
  if (evening) timeParts.push('Evening');

  return `In Routine (${dayPart} • ${timeParts.join(', ')})`;
}
