import type { Routine } from '@/types';
import { isScheduledOnDay } from '@/utils/routineSchedule';

export type RoutineStatusResult = 'morning' | 'evening' | 'both' | 'none';

function isActiveStep(productId: string, step: { productId: string | null; hidden?: boolean; scheduledDays: number[] }, dayOfWeek: number): boolean {
  return (
    step.productId !== null &&
    step.productId !== undefined &&
    step.productId === productId &&
    !step.hidden &&
    isScheduledOnDay(step.scheduledDays, dayOfWeek)
  );
}

export function getProductRoutineStatus(
  productId: string,
  routines: Routine[],
  dayOfWeek: number = new Date().getDay(),
): RoutineStatusResult {
  const inMorning = routines.some(
    (r) => r.timeOfDay === 'morning' && r.steps.some((s) => isActiveStep(productId, s, dayOfWeek)),
  );
  const inEvening = routines.some(
    (r) => r.timeOfDay === 'evening' && r.steps.some((s) => isActiveStep(productId, s, dayOfWeek)),
  );

  if (inMorning && inEvening) return 'both';
  if (inMorning) return 'morning';
  if (inEvening) return 'evening';
  return 'none';
}
