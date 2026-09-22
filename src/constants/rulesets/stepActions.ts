import type { ProductType, StepAction } from '@/types';

/**
 * ProductType -> StepAction static map (routine-step-grouping PRD_Spec.md
 * §3.2). All 18 `ProductType` values map; typed as `Record<ProductType, ...>`
 * so a missing key is a compile error, not a runtime fallback branch.
 *
 * Deliberately no `STEP_ACTION_ORDER` / `stepActionPosition` constant here —
 * a group's rendered position is read off the persisted `Routine.steps`
 * array at grouping time (`src/utils/routineGrouping.ts`), never computed
 * from a hand-written order table (IMPLEMENTATION_PLAN.md Phase 1).
 */
export const STEP_ACTION_FOR_TYPE: Record<ProductType, StepAction> = {
  makeup_remover: 'cleanse',
  cleanser: 'cleanse',
  peeling: 'exfoliate',
  toner: 'tone',
  essence: 'tone',
  ampoule: 'treat',
  serum: 'treat',
  gel: 'treat',
  spot_treatment: 'treat',
  other: 'treat',
  eye_cream: 'moisturize',
  mask: 'mask',
  lotion: 'moisturize',
  cream: 'moisturize',
  moisturizer: 'moisturize',
  oil: 'seal',
  balm: 'seal',
  spf: 'protect',
};

/** Title-Case, one-word imperative-verb label per action (PRD_Spec.md §3.1). */
export const STEP_ACTION_LABELS: Record<StepAction, string> = {
  cleanse: 'Cleanse',
  exfoliate: 'Exfoliate',
  tone: 'Tone',
  treat: 'Treat',
  moisturize: 'Moisturize',
  mask: 'Mask',
  seal: 'Seal',
  protect: 'Protect',
};
