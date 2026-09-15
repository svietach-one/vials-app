/**
 * Explore Composition — Goal-fit signal (explore-fit-signals FE-1).
 * Spec: docs/specs/explore-fit-signals.md §4 Story 1
 * Tech design: docs/tech-design/explore-fit-signals.md §3 FE-1
 *
 * Answers a single factual question per stated care goal: does this
 * (unsaved) composition carry an active typically used for that goal, and if
 * so, which one(s)? Reuses `goalCoverage.ts`'s already-exported
 * `coverageClasses` (a plain, non-order-sensitive filter against
 * `actives.json`'s `goals` block) directly — no re-derivation of the
 * goal->class map, no new rule data.
 *
 * Deliberately NOT the same question `goalCoverage.ts`'s
 * `getGoalCoverageFindings` answers: that module asks "is the SAVED ROUTINE
 * covering this goal" (shelf/routine/pregnancy-aware, three tones). This
 * module asks the much narrower "does THIS composition's detected actives
 * overlap the goal" — two tones only (match / honest miss), no shelf, no
 * routine, no safety-redirect tier. Spec §3 Non-Goals: no score, no
 * percentage, no confidence value.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import { ACTIVE_INGREDIENT_LABELS, GOAL_LABELS } from '@/constants/labels';
import type { ActiveIngredientKey, SkinGoal } from '@/types';
import { coverageClasses } from '@/utils/goalCoverage';

export interface GoalFitFinding {
  goal: SkinGoal;
  /** Detected actives that overlap this goal's coverage classes. Empty = the honest miss case. */
  matchedKeys: ActiveIngredientKey[];
}

/**
 * Builds the goal-fit findings for every real (non-`maintenance`) goal the
 * user has set, at most two (primary + secondary), de-duplicated when both
 * are set to the same goal. Same goal-list construction
 * `getGoalCoverageFindings` already uses.
 */
export function buildGoalFit(
  resolvedActiveKeys: ActiveIngredientKey[],
  primaryGoal: SkinGoal,
  secondaryGoal: SkinGoal | null,
): GoalFitFinding[] {
  const goals = [...new Set([primaryGoal, secondaryGoal])].filter(
    (goal): goal is SkinGoal => goal !== null && goal !== 'maintenance',
  );

  return goals.map((goal) => ({
    goal,
    matchedKeys: coverageClasses(goal, resolvedActiveKeys),
  }));
}

// ─── Copy (PLACEHOLDER — spec §10 Open Question 4, owner: design) ────────────

function activeLabel(key: ActiveIngredientKey): string {
  return ACTIVE_INGREDIENT_LABELS[key];
}

function joinLabels(keys: ActiveIngredientKey[]): string {
  const labels = keys.map(activeLabel);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

/** PLACEHOLDER copy — illustrative wording pending design sign-off (spec §10 Open Question 4). */
export function buildGoalFitMatchMessage(goal: SkinGoal, matchedKeys: ActiveIngredientKey[]): string {
  const verb = matchedKeys.length === 1 ? 'is' : 'are';
  return `${joinLabels(matchedKeys)} ${verb} typically used for ${GOAL_LABELS[goal].toLowerCase()}.`;
}

/**
 * PLACEHOLDER copy — matches `goalCoverage.ts`'s "not_owned" tone (a factual
 * statement that nothing detected currently addresses the goal), pending
 * design sign-off (spec §10 Open Question 4).
 */
export function buildGoalFitMissMessage(goal: SkinGoal): string {
  return `Nothing detected in this composition is typically used for ${GOAL_LABELS[
    goal
  ].toLowerCase()}.`;
}
