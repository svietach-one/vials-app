import type { Product, Routine } from '@/types';
import { schedulesFullyCover } from '@/utils/routineEngine/generate';
import { structuralSlotFor } from '@/utils/routineEngine/slotting';
import { isScheduledOnDay } from '@/utils/routineSchedule';

/**
 * Live check against the CURRENTLY SAVED evening routine — distinct from the
 * generation-time `RoutineStep.stepNote`/`pre_cleanse_requires_followup`
 * placeholder mechanism in generate.ts, which only recomputes when the user
 * runs Generate/Regenerate. A manual add/remove/hide of a step never touches
 * `stepNote` (it's just carried over as-is), so that field can go stale the
 * moment someone edits their routine by hand. This recomputes fresh on every
 * render from the live `steps` array instead.
 */
export interface PreCleanseReminder {
  routineId: string;
  stepId: string;
  productName: string;
}

/**
 * Finds the first visible pre_cleanse step (micellar water / makeup remover)
 * in the evening routine that has no visible cleanser step(s) whose scheduled
 * days (together) fully cover it — i.e. the double-cleanse sequence is incomplete.
 * Returns null once a covering cleanser is in place, or when there's no
 * pre_cleanse step at all.
 */
export function findPreCleanseReminder(
  routines: Routine[],
  products: Product[],
  dow?: number,
): PreCleanseReminder | null {
  const evening = routines.find((r) => r.timeOfDay === 'evening');
  if (!evening) return null;

  // Evaluated for the weekday being VIEWED, matching the step list the screen
  // renders. Judging the whole week instead told someone looking at a night
  // where the cleanser IS scheduled that nothing follows their micellar water,
  // because some OTHER night was uncovered (field report 2026-10-14).
  const visibleSteps = evening.steps.filter(
    (s) => !s.hidden && (dow === undefined || isScheduledOnDay(s.scheduledDays, dow)),
  );
  const preCleanse = visibleSteps.find((s) => structuralSlotFor(s.productType) === 'pre_cleanse');
  if (!preCleanse) return null;

  const cleansers = visibleSteps.filter((s) => structuralSlotFor(s.productType) === 'cleanser');
  // Scoped to one weekday, "covered" is simply whether a cleanser runs that
  // night — both lists are already filtered to it, so re-running the week-wide
  // coverage maths here would read an unrestricted `[]` pre_cleanse step as
  // needing all seven days and report a gap on a night that has none.
  const covered =
    dow === undefined
      ? schedulesFullyCover(
          cleansers.map((c) => c.scheduledDays),
          preCleanse.scheduledDays,
        )
      : cleansers.length > 0;
  if (covered) return null;

  const product = preCleanse.productId ? products.find((p) => p.id === preCleanse.productId) : null;

  return {
    routineId: evening.id,
    stepId: preCleanse.id,
    productName: product?.name ?? 'Your makeup remover',
  };
}
