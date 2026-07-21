import type { Product, RoutineStep } from '@/types';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import type { FrozenItem, PlannedStep } from '@/utils/routineEngine/planTypes';
import type { PlanDiffEntry } from '@/utils/routineEngine/validate';

/**
 * Story 2 (routine-similar-product-priority) one-tap swap over an
 * uncommitted Draft Preview plan: replaces the admitted step in its period
 * with one of its recorded `slotAlternatives` entries. `winnerProductId` is
 * always the entry's ORIGINAL identity key (`SlotAlternative.winnerProductId`,
 * stable for the lifetime of the draft) — never the currently-admitted
 * product — so the same slot stays locatable across repeated swaps; the slot
 * itself is matched by `slotIndex`, not by which product currently occupies
 * it (screen-improvements: Draft Preview "Replace with" select, which lets
 * the user reselect a slot's candidate any number of times).
 *
 * The swap is symmetric: the step being displaced is pushed onto
 * `alternatives` in the same move that removes the chosen one, so every
 * previously-admitted product (including the original engine winner) stays a
 * selectable candidate forever — nothing is lost after the first swap. Pure
 * array splice — candidates are the exact `PlannedStep` snapshots recorded by
 * `resolve.ts` at generation time (tech design Assumption 1), so this never
 * re-runs eligibility/frequency-cap math. Returns `plan` unchanged if the
 * slot or the chosen candidate isn't found (defensive — should not happen
 * given the UI only offers recorded candidates).
 */
export function applySlotAlternativeSwap(
  plan: RoutinePlan,
  winnerProductId: string,
  chosenProductId: string,
): RoutinePlan {
  const slotAlternatives = plan.slotAlternatives ?? [];
  const entryIndex = slotAlternatives.findIndex((a) => a.winnerProductId === winnerProductId);
  if (entryIndex === -1) return plan;
  const entry = slotAlternatives[entryIndex];

  const steps = plan.periods[entry.period];
  const slotPos = steps.findIndex((s) => s.slotIndex === entry.slotIndex);
  if (slotPos === -1) return plan;

  const currentStep = steps[slotPos];
  if (currentStep.productId === chosenProductId) return plan;

  const chosenStep = entry.alternatives.find((alt) => alt.productId === chosenProductId);
  if (!chosenStep) return plan;

  const nextAlternatives = [currentStep, ...entry.alternatives.filter((alt) => alt.productId !== chosenProductId)];

  const nextSteps = [...steps];
  nextSteps[slotPos] = chosenStep;

  const nextSlotAlternatives = [...slotAlternatives];
  nextSlotAlternatives[entryIndex] = { ...entry, alternatives: nextAlternatives };

  return {
    ...plan,
    periods: { ...plan.periods, [entry.period]: nextSteps },
    slotAlternatives: nextSlotAlternatives,
  };
}

/**
 * Pure plan-application logic behind the Draft Preview save path (research
 * §3 "generate mode"). Converts a committed RoutinePlan period into the
 * routine's next steps array, honoring the two preservation rules:
 * - userPinned steps the plan dropped are re-appended (the engine never
 *   removes pinned steps) — EXCEPT under a clinical freeze, which carries an
 *   expiry date (safety beats preference).
 * - hidden steps are user-managed and survive the rewrite untouched.
 * The domain action owns store access; this module owns the shape.
 */

/**
 * Builds the next steps array for one routine from a committed plan period.
 * Planned steps arrive layer-ordered; existing step ids and pin flags are
 * reused when the same product stays, so React lists and pins are stable.
 */
export function buildStepsFromPlan(
  planned: PlannedStep[],
  existing: RoutineStep[],
  frozen: FrozenItem[],
  generateStepId: () => string,
): RoutineStep[] {
  const existingByProduct = new Map(
    existing.flatMap((s) => (s.productId ? [[s.productId, s] as const] : [])),
  );
  const plannedIds = new Set(planned.map((s) => s.productId));
  // Clinical freezes carry an expiry date; only they override a pin
  const clinicallyFrozen = new Set(frozen.filter((f) => f.until).map((f) => f.productId));

  const steps: RoutineStep[] = planned.map((plannedStep) => {
    const prior = existingByProduct.get(plannedStep.productId);
    return {
      id: prior?.id ?? generateStepId(),
      productType: plannedStep.productType,
      productId: plannedStep.productId,
      hidden: false,
      scheduledDays: plannedStep.scheduledDays,
      userPinned: prior?.userPinned ?? false,
      stepNote: plannedStep.stepNote ?? null,
    };
  });

  for (const step of existing) {
    if (step.productId && plannedIds.has(step.productId)) continue;
    const pinnedSurvives =
      step.userPinned === true &&
      (!step.productId || !clinicallyFrozen.has(step.productId));
    if (step.hidden || pinnedSurvives) steps.push(step);
  }

  return steps;
}

/** Short "Jul 17" date for the quiet summary lines. */
function formatShortDate(isoDate: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(isoDate);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * At most three quiet summary lines for the Draft Preview (research §3:
 * "2–3 quiet summary lines", e.g. "Acids and retinol split across nights").
 * Priority: day splits → paused products → moved products → new steps.
 */
export function buildDraftSummaryLines(
  plan: RoutinePlan,
  diff: PlanDiffEntry[],
  products: Product[],
): string[] {
  const nameOf = (productId: string) =>
    products.find((p) => p.id === productId)?.name ?? 'A product';
  const lines: string[] = [];

  const splitIds = [
    ...new Set(
      plan.decisions
        .filter((d) => d.action === 'day_split' && d.productId)
        .map((d) => d.productId as string),
    ),
  ];
  if (splitIds.length >= 2) {
    lines.push(`${nameOf(splitIds[0])} and ${nameOf(splitIds[1])} split across nights`);
  } else if (splitIds.length === 1) {
    lines.push(`${nameOf(splitIds[0])} scheduled on alternate nights`);
  }

  const paused = plan.frozen.filter((f) => f.until);
  if (paused.length > 0) {
    const until = formatShortDate(paused[0].until as string);
    lines.push(
      paused.length === 1
        ? `1 product paused until ${until}`
        : `${paused.length} products paused until ${until}`,
    );
  }

  // Pair-rule freezes carry no expiry — they must still be narrated
  // (research §1.8: nothing disappears silently; 2026-07-05 review warning 3)
  const setAside = plan.frozen.filter((f) => !f.until);
  if (setAside.length > 0 && lines.length < 3) {
    lines.push(
      setAside.length === 1
        ? `${nameOf(setAside[0].productId)} set aside to avoid a conflict`
        : `${setAside.length} products set aside to avoid conflicts`,
    );
  }

  // Skeleton reserve (phase-04): healthy products the routine did not need —
  // narrated so nothing vanishes silently (research §1.8).
  if (plan.reserve.length > 0 && lines.length < 3) {
    lines.push(
      plan.reserve.length === 1
        ? `${nameOf(plan.reserve[0].productId)} kept in reserve`
        : `${plan.reserve.length} products kept in reserve`,
    );
  }

  const moved = diff.filter((d) => d.kind === 'moved');
  if (moved.length > 0 && lines.length < 3) {
    const to = moved[0].to === 'morning' ? 'morning' : 'evening';
    lines.push(`${nameOf(moved[0].productId)} moved to the ${to} routine`);
  }

  const added = diff.filter((d) => d.kind === 'added');
  if (added.length > 0 && lines.length < 3) {
    lines.push(added.length === 1 ? '1 product added' : `${added.length} products added`);
  }

  return lines.slice(0, 3);
}
