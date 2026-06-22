import type { Routine } from '@/types';

export type RoutineStatusResult = 'morning' | 'evening' | 'both' | 'none';

export function getProductRoutineStatus(
  productId: string,
  routines: Routine[],
): RoutineStatusResult {
  const inMorning = routines.some(
    (r) =>
      r.timeOfDay === 'morning' &&
      r.steps.some((s) => s.productId === productId && !s.hidden),
  );
  const inEvening = routines.some(
    (r) =>
      r.timeOfDay === 'evening' &&
      r.steps.some((s) => s.productId === productId && !s.hidden),
  );

  if (inMorning && inEvening) return 'both';
  if (inMorning) return 'morning';
  if (inEvening) return 'evening';
  return 'none';
}
