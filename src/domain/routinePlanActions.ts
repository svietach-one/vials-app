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

/**
 * Draft Preview save path (research §3): the ONLY write path from a generated
 * plan into routinesStore. Generation itself never mutates live data — a
 * draft exists only in component state until the user commits a scope here.
 */

/** Which routines a Draft Preview commit writes (research §3 commit scopes). */
export type PlanCommitScope = 'both' | 'am' | 'pm';

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
    },
    seasonMask: getActiveSeasonMask(now),
    tracking: {
      cycleType: useSettingsStore.getState().routineCycleType,
      applicationStats: tracking.applicationStats,
    },
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
export function applyRoutinePlan(plan: RoutinePlan, scope: PlanCommitScope): void {
  const { routines, updateRoutine } = useRoutinesStore.getState();

  for (const routine of routines) {
    const period = routine.timeOfDay === 'morning' ? 'am' : 'pm';
    if (scope !== 'both' && scope !== period) continue;

    const planned = period === 'am' ? plan.periods.morning : plan.periods.evening;
    updateRoutine(routine.id, {
      steps: buildStepsFromPlan(planned, routine.steps, plan.frozen, generateId),
    });
  }
}
