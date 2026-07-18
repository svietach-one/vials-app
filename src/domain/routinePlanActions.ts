import { getActiveSeasonMask } from '@/domain/seasonActions';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrackingStore } from '@/store/trackingStore';
import { generateId } from '@/utils/generateId';
import { generatePlan, type EngineInput, type RoutinePlan } from '@/utils/routineEngine/generate';
import { buildStepsFromPlan } from '@/utils/routineEngine/planApply';
import { validateRoutines, type ValidationResult } from '@/utils/routineEngine/validate';
import { getSkincareDateString } from '@/utils/timeHelpers';

/**
 * Draft Preview save path (research §3): the ONLY write path from a generated
 * plan into routinesStore. Generation itself never mutates live data — a
 * draft exists only in component state until the user commits a scope here.
 */

/** Which routines a Draft Preview commit writes (research §3 commit scopes). */
export type PlanCommitScope = 'both' | 'am' | 'pm';

/**
 * Deterministic key for override validity (V2.1 phase-07): an override applies
 * only while the shelf composition and goals are unchanged. Sorted product ids
 * make it order-independent; the goals bound the treatment ranking.
 */
export function computeOverrideHash(
  productIds: string[],
  primaryGoal: string,
  secondaryGoal: string | null,
): string {
  return `${[...productIds].sort().join(',')}|${primaryGoal}|${secondaryGoal ?? ''}`;
}

/** Current shelf/goal override hash from the live stores. */
export function currentOverrideHash(): string {
  const profile = useProfileStore.getState().profile;
  return computeOverrideHash(
    useProductsStore.getState().products.map((p) => p.id),
    profile?.primaryGoal ?? 'maintenance',
    profile?.secondaryGoal ?? null,
  );
}

/**
 * The override ids still valid for the current shelf/goal — [] when the stored
 * hash no longer matches (invalidation on a shelf or goal change).
 */
export function activeOverrides(): string[] {
  const tracking = useTrackingStore.getState();
  return tracking.overrideHash === currentOverrideHash() ? tracking.overrides : [];
}

/** Assembles the engine input from the hydrated stores. */
export function buildEngineInputFromStores(now: Date = new Date()): EngineInput {
  const profile = useProfileStore.getState().profile;
  const tracking = useTrackingStore.getState();
  return {
    products: useProductsStore.getState().products,
    procedures: useProceduresStore.getState().procedures,
    profile: {
      fitzpatrick: profile?.fitzpatrick ?? null,
      concerns: profile?.concerns ?? [],
      // Goals drive Step-0 treatment selection (phase-03/04). Without these the
      // engine would treat every user as maintenance and reserve all actives.
      primaryGoal: profile?.primaryGoal ?? 'maintenance',
      secondaryGoal: profile?.secondaryGoal ?? null,
    },
    seasonMask: getActiveSeasonMask(now),
    tracking: {
      cycleType: useSettingsStore.getState().routineCycleType,
      applicationStats: tracking.applicationStats,
      firstScheduledDates: tracking.firstScheduledDates,
    },
    // Only overrides still valid for the current shelf/goal reach the engine.
    userOverrides: activeOverrides(),
    now,
  };
}

/** Generates a fresh draft over the whole shelf. Pure read — writes nothing. */
export function generateDraftPlan(now: Date = new Date()): RoutinePlan {
  return generatePlan(buildEngineInputFromStores(now));
}

/** Validates the saved routines against the engine. Pure read — writes nothing. */
export function validateCurrentRoutines(now: Date = new Date()): ValidationResult {
  return validateRoutines(useRoutinesStore.getState().routines, buildEngineInputFromStores(now));
}

/**
 * Commits a draft into the saved routines for the chosen scope. A partial
 * scope (AM only / PM only) leaves the other routine untouched — the caller
 * re-validates afterwards, and any scope-induced conflict lights the bottom
 * Optimize strip (never a modal). Pinned and hidden steps survive per
 * buildStepsFromPlan.
 */
export function applyRoutinePlan(
  plan: RoutinePlan,
  scope: PlanCommitScope,
  now: Date = new Date(),
): void {
  const { routines, updateRoutine } = useRoutinesStore.getState();
  const committedProductIds: string[] = [];

  for (const routine of routines) {
    const period = routine.timeOfDay === 'morning' ? 'am' : 'pm';
    if (scope !== 'both' && scope !== period) continue;

    const planned = period === 'am' ? plan.periods.morning : plan.periods.evening;
    committedProductIds.push(...planned.map((s) => s.productId));
    updateRoutine(routine.id, {
      steps: buildStepsFromPlan(planned, routine.steps, plan.frozen, generateId),
    });
  }

  // Usage anchor (phase-05): a product's first appearance in a SAVED plan
  // starts its adaptation clock. Idempotent — an existing anchor is never
  // moved, so re-saving never resets a product's phase.
  useTrackingStore
    .getState()
    .recordFirstScheduled(committedProductIds, getSkincareDateString(now));
}
