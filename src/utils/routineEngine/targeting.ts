import type { RuleTargets } from '@/constants/rulesets/rulesetTypes';
import type { DecisionReasonCode } from '@/constants/decisionReasons';
import type { ProductType } from '@/types';
import { matchesComparator } from '@/utils/routineEngine/context';
import type { ProductFacts } from '@/utils/routineEngine/productFacts';

/**
 * Evaluates a ruleset target selector against a product's facts. Selectors in
 * one object AND together; `anyOf` unions nested selectors. An empty selector
 * matches nothing (a rule with no targets is a data bug, not a match-all).
 * Shared by eligibility (clinical freezes), resolve (limits/prioritize), and
 * mandates (require).
 */
export function matchesRuleTargets(
  productType: ProductType,
  facts: ProductFacts,
  targets: RuleTargets,
): boolean {
  const checks: boolean[] = [];

  if (targets.properties) {
    const props = facts.properties as unknown as Record<string, boolean | number | undefined>;
    checks.push(
      Object.entries(targets.properties).every(([key, expected]) =>
        matchesComparator(props[key], expected),
      ),
    );
  }
  if (targets.classes) {
    checks.push(targets.classes.some((key) => facts.classes.some((c) => c.key === key)));
  }
  if (targets.productTypes) {
    checks.push(targets.productTypes.includes(productType));
  }
  if (targets.anyOf) {
    checks.push(targets.anyOf.some((nested) => matchesRuleTargets(productType, facts, nested)));
  }

  return checks.length > 0 && checks.every(Boolean);
}

/**
 * A freeze-shaped rule: a target selector, its reason code, and (for
 * day-windowed sources like clinical procedure freezes) the date it expires.
 * Pregnancy freezes (pregnancy-safety-handling) are persistent — `untilDate`
 * stays undefined for them — so every consumer reads `.untilDate` the same
 * way regardless of source.
 */
export interface TargetedRule {
  targets: RuleTargets;
  reasonCode: DecisionReasonCode;
  untilDate?: string;
}

/** First rule in `rules` whose targets match the product, or undefined. */
export function findMatchingRule(
  productType: ProductType,
  facts: ProductFacts,
  rules: readonly TargetedRule[],
): TargetedRule | undefined {
  return rules.find((rule) => matchesRuleTargets(productType, facts, rule.targets));
}

/**
 * "Is this product frozen by any source" (tech design FE-6,
 * pregnancy-safety-handling): unions procedure freezes (day-windowed) and
 * pregnancy freezes (persistent) into one check, shared by eligibility.ts's
 * gates and both of dailyView.ts's freeze-mask call sites instead of each
 * re-deriving the union. Procedure freezes are checked first — a product
 * targeted by both sources reports the day-windowed one, which is more
 * informative (carries `until`).
 */
export function findFrozenByAnySource(
  productType: ProductType,
  facts: ProductFacts,
  procedureFreezeRules: readonly TargetedRule[],
  pregnancyRules: readonly TargetedRule[],
): TargetedRule | undefined {
  return (
    findMatchingRule(productType, facts, procedureFreezeRules) ??
    findMatchingRule(productType, facts, pregnancyRules)
  );
}
