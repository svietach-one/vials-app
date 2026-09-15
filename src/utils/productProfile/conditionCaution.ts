/**
 * Explore Composition — Condition-aware caution signal (explore-fit-signals
 * FE-3). Spec: docs/specs/explore-fit-signals.md §4 Story 2
 * Tech design: docs/tech-design/explore-fit-signals.md §3 FE-3
 *
 * Adapts `skinConditionModifiers.ts`'s `getConditionRiskWarnings` algorithm
 * (filter `CONDITION_MODIFIERS` to selected conditions, one finding per
 * matching `advisories[].tags` entry present in the reviewed set, merge by
 * tag taking the highest-severity matching condition's message) to this
 * flow's shape: a single unsaved composition's `resolvedActiveKeys`, not a
 * `Product[]` shelf. Imports only `CONDITION_MODIFIERS`/`ConditionModifier`
 * (already-exported table) — never `applyConditionSeverityModifiers` or
 * `getConditionRiskWarnings` themselves (both `Product[]`-shaped and
 * irrelevant to a single unsaved composition), and never `conflictEngine.ts`
 * (spec §3 Non-Goals).
 *
 * Message text is `CONDITION_MODIFIERS`'s existing strings, used verbatim —
 * no new copy invented here.
 *
 * Pure module: no React, no react-native, no store, no I/O
 * (.claude/rules/architecture-review.md §2).
 */
import { CONDITION_MODIFIERS, type ConditionModifier } from '@/utils/skinConditionModifiers';
import type { ActiveIngredientKey, AdvisorySeverity, SkinConditionType } from '@/types';

export interface ConditionCautionFinding {
  /** Stable de-dupe key — one finding per tag, same convention as `ConditionAdvisory.id`/`.tag`. */
  tag: ActiveIngredientKey;
  /** Every selected condition whose advisory table flagged this tag. */
  conditions: SkinConditionType[];
  /** Plain-language condition labels, for the row title, in the same order as `conditions`. */
  conditionLabels: string[];
  /** Highest severity among the matching conditions. */
  severity: AdvisorySeverity;
  /** Copy from the highest-severity matching condition; ties resolve to `CONDITION_MODIFIERS` order. */
  message: string;
}

const SEVERITY_RANK: Record<AdvisorySeverity, number> = { low: 0, medium: 1, high: 2 };

/** One-line candidate filter — not a business rule, so it stays local rather than requesting a second module export (tech design §4 assumption). */
function modifiersFor(conditions: SkinConditionType[]): ConditionModifier[] {
  return CONDITION_MODIFIERS.filter((modifier) => conditions.includes(modifier.condition));
}

/**
 * Returns `[]` for an empty condition list — with no condition selected this
 * check produces nothing at all, for any input (same no-op guarantee as
 * `getConditionRiskWarnings`, US-27).
 */
export function buildConditionCaution(
  resolvedActiveKeys: ActiveIngredientKey[],
  skinConditions: SkinConditionType[],
): ConditionCautionFinding[] {
  const active = modifiersFor(skinConditions);
  if (active.length === 0) return [];

  // One row per tag, merging every condition that flagged it, built in
  // CONDITION_MODIFIERS order so both the merge and the tie-break are stable
  // — mirrors getConditionRiskWarnings' own byTag map construction.
  const byTag = new Map<ActiveIngredientKey, ConditionCautionFinding>();
  for (const modifier of active) {
    for (const rule of modifier.advisories) {
      for (const tag of rule.tags) {
        if (!resolvedActiveKeys.includes(tag)) continue;

        const existing = byTag.get(tag);
        if (!existing) {
          byTag.set(tag, {
            tag,
            conditions: [modifier.condition],
            conditionLabels: [modifier.label],
            severity: rule.severity,
            message: rule.message,
          });
          continue;
        }

        existing.conditions.push(modifier.condition);
        existing.conditionLabels.push(modifier.label);
        if (SEVERITY_RANK[rule.severity] > SEVERITY_RANK[existing.severity]) {
          existing.severity = rule.severity;
          existing.message = rule.message;
        }
      }
    }
  }

  return [...byTag.values()];
}
