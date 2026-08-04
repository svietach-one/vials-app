/**
 * Standing goal-coverage check (engine4.1 handoff §3): does the saved routine
 * still contain an active that solves the user's stated care goal? Nothing
 * else in the engine asks this — `resolveGoalContext()` (context.ts) only
 * picks a goal-solving active at *generation* time; a manual routine or shelf
 * edit afterward is never re-checked. This module is the first consumer of
 * that standing question. Render-cycle only, called from
 * `GoalCoverageBanner.tsx` — never from a store, nothing persisted here.
 *
 * Deliberately does NOT introduce a `skinGoals[]` field or a hand-authored
 * `GOAL_TAG_MAP` (rejected in the reconciliation pass — see
 * `docs/specs/engine 4.0/engine4.1/ENGINE_4.0_RECONCILIATION_AND_PHASE11_HANDOFF.md`
 * §1). Uses the shipped `primaryGoal`/`secondaryGoal: SkinGoal` model and the
 * goal→class mapping that already exists in `actives.json`'s `goals` block.
 */
import activesRuleset from '@/constants/rulesets/actives.json';
import { ACTIVE_INGREDIENT_LABELS, GOAL_LABELS } from '@/constants/labels';
import type { PregnancyFreezeRule } from '@/utils/routineEngine/context';
import { buildShelfFacts } from '@/utils/routineEngine/productFacts';
import { findMatchingRule } from '@/utils/routineEngine/targeting';
import type { ActiveIngredientKey, Product, SkinGoal } from '@/types';

const GOALS = (activesRuleset as unknown as { goals: Record<SkinGoal, ActiveIngredientKey[]> })
  .goals;

// ─── Copy (US-26 lint applies — see advisoryCopy.test.ts's allTemplates()) ──

function activeLabel(key: ActiveIngredientKey): string {
  return ACTIVE_INGREDIENT_LABELS[key];
}

function joinLabels(keys: ActiveIngredientKey[]): string {
  const labels = keys.map(activeLabel);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;
}

export function buildNotOwnedMessage(goal: SkinGoal, classes: ActiveIngredientKey[]): string {
  return `Nothing on your shelf carries an active that's typically used for ${GOAL_LABELS[
    goal
  ].toLowerCase()}. ${joinLabels(classes)} is a common starting point if you'd like to work toward this goal.`;
}

export function buildOnShelfMessage(goal: SkinGoal, classes: ActiveIngredientKey[]): string {
  return `You already have a product with ${joinLabels(
    classes,
  )} that could help with ${GOAL_LABELS[goal].toLowerCase()} — it's just not in today's routine yet.`;
}

export function buildSafetyRedirectMessage(
  goal: SkinGoal,
  frozenClasses: ActiveIngredientKey[],
  altClasses: ActiveIngredientKey[],
): string {
  const frozenPart = `${joinLabels(frozenClasses)} is usually set aside during pregnancy or while breastfeeding`;
  const altPart =
    altClasses.length > 0
      ? ` ${joinLabels(altClasses)} is a gentler option worth asking about instead.`
      : '';
  return (
    `${frozenPart}, so the ${GOAL_LABELS[goal].toLowerCase()} product on your shelf isn't being ` +
    `counted toward this goal right now.${altPart} As always, consider checking with your doctor ` +
    `or dermatologist before starting anything new.`
  );
}

export const GOAL_COVERAGE_SAFETY_TITLE = 'A gentler option for this goal';
export const GOAL_COVERAGE_ON_SHELF_TITLE = 'Already on your shelf';
export function goalCoverageNotOwnedTitle(goal: SkinGoal): string {
  return `${GOAL_LABELS[goal]}: not covered yet`;
}

// ─── Finding ─────────────────────────────────────────────────────────────────

export type GoalCoverageTone = 'safety_redirect' | 'on_shelf' | 'not_owned';

export interface GoalCoverageFinding {
  goal: SkinGoal;
  /** 'safety_redirect' renders Amber (warning); the other two render Cobalt (info) — never Cabernet/sos. */
  tone: GoalCoverageTone;
  title: string;
  message: string;
  /** Season-independent, per-goal key for settingsStore.dismissedBanners — reappears if the stated goal changes. */
  dismissKey: string;
}

export interface GoalCoverageInput {
  primaryGoal: SkinGoal;
  secondaryGoal: SkinGoal | null;
  /** Heuristically-derived, unconfirmed goals must not be nagged about (engine4.1 handoff §3.3). */
  goalNeedsConfirmation: boolean;
  /** treatmentClassRanking from a single resolveGoalContext() call over the real (primary, secondary) pair — never resolved per goal in isolation (breaks the barrier_repair cross-goal modifier). */
  treatmentClassRanking: ActiveIngredientKey[];
  /** Products currently visible in the routine (not hidden, not frozen) — "covered" means one of these carries a coverage class. */
  scheduledProducts: Product[];
  /** The full shelf, for the owned/not-owned/safety-redirect fallback check. */
  products: Product[];
  /** context.pregnancyRules — already empty unless PREGNANCY_SAFETY_ENABLED and profile.pregnantOrBreastfeeding are both true. */
  pregnancyRules: readonly PregnancyFreezeRule[];
}

/** Which classes solve goal `g`, after every resolveGoalContext() modifier — never re-derived per goal. */
export function coverageClasses(
  goal: SkinGoal,
  treatmentClassRanking: ActiveIngredientKey[],
): ActiveIngredientKey[] {
  const raw = GOALS[goal] ?? [];
  return treatmentClassRanking.filter((key) => raw.includes(key));
}

type ShelfFacts = ReturnType<typeof buildShelfFacts>;

/** Whether product `p` carries at least one of `classes` — the shared "does this product help with the goal" test used for both the scheduled-steps and shelf passes. */
function matchesClasses(p: Product, classes: ActiveIngredientKey[], facts: ShelfFacts): boolean {
  const f = facts.get(p.id);
  return f !== undefined && f.classes.some((c) => classes.includes(c.key));
}

/** Decision logic for one already-confirmed, non-maintenance goal (engine4.1 handoff §3.5). Returns null when the goal is covered or unaddressable. */
function findingForGoal(
  goal: SkinGoal,
  input: GoalCoverageInput,
  facts: ShelfFacts,
): GoalCoverageFinding | null {
  const classes = coverageClasses(goal, input.treatmentClassRanking);
  if (classes.length === 0) return null; // unaddressable by design (e.g. barrier_repair dropped everything) — never nag

  const covered = input.scheduledProducts.some((p) => matchesClasses(p, classes, facts));
  if (covered) return null;

  const ownedMatches = input.products.filter((p) => matchesClasses(p, classes, facts));
  if (ownedMatches.length === 0) {
    return {
      goal,
      tone: 'not_owned',
      title: goalCoverageNotOwnedTitle(goal),
      message: buildNotOwnedMessage(goal, classes),
      dismissKey: `goal_coverage_not_owned_${goal}`,
    };
  }

  const frozenMatches = ownedMatches.filter(
    (p) => findMatchingRule(p.productType, facts.get(p.id)!, input.pregnancyRules) !== undefined,
  );

  if (frozenMatches.length === ownedMatches.length) {
    const frozenClasses = [
      ...new Set(frozenMatches.flatMap((p) => facts.get(p.id)?.classes.map((c) => c.key) ?? [])),
    ].filter((k) => classes.includes(k));
    const altClasses = classes.filter((k) => !frozenClasses.includes(k));

    return {
      goal,
      tone: 'safety_redirect',
      title: GOAL_COVERAGE_SAFETY_TITLE,
      message: buildSafetyRedirectMessage(goal, frozenClasses, altClasses),
      dismissKey: `goal_coverage_safety_${goal}`,
    };
  }

  return {
    goal,
    tone: 'on_shelf',
    title: GOAL_COVERAGE_ON_SHELF_TITLE,
    message: buildOnShelfMessage(goal, classes),
    dismissKey: `goal_coverage_on_shelf_${goal}`,
  };
}

export function getGoalCoverageFindings(input: GoalCoverageInput): GoalCoverageFinding[] {
  if (input.goalNeedsConfirmation) return [];

  const goals = [...new Set([input.primaryGoal, input.secondaryGoal].filter((g): g is SkinGoal => g !== null))]
    .filter((g) => g !== 'maintenance'); // goals['maintenance'] is [] — always an empty intersection, by design

  const facts = buildShelfFacts(input.products);
  const findings: GoalCoverageFinding[] = [];
  for (const goal of goals) {
    const finding = findingForGoal(goal, input, facts);
    if (finding) findings.push(finding);
  }
  return findings;
}
