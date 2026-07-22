import type { Product, Routine } from '@/types';
import { scheduleFullyCovers } from '@/utils/routineEngine/generate';
import { structuralSlotFor } from '@/utils/routineEngine/slotting';

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
 * in the evening routine that has no visible cleanser step whose scheduled
 * days fully cover it — i.e. the double-cleanse sequence is incomplete.
 * Returns null once a covering cleanser is in place, or when there's no
 * pre_cleanse step at all.
 */
export function findPreCleanseReminder(
  routines: Routine[],
  products: Product[],
): PreCleanseReminder | null {
  const evening = routines.find((r) => r.timeOfDay === 'evening');
  if (!evening) return null;

  const visibleSteps = evening.steps.filter((s) => !s.hidden);
  const preCleanse = visibleSteps.find((s) => structuralSlotFor(s.productType) === 'pre_cleanse');
  if (!preCleanse) return null;

  const cleanser = visibleSteps.find((s) => structuralSlotFor(s.productType) === 'cleanser');
  const covered = cleanser ? scheduleFullyCovers(cleanser.scheduledDays, preCleanse.scheduledDays) : false;
  if (covered) return null;

  const product = preCleanse.productId ? products.find((p) => p.id === preCleanse.productId) : null;

  return {
    routineId: evening.id,
    stepId: preCleanse.id,
    productName: product?.name ?? 'Your makeup remover',
  };
}
