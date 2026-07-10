import type { RuleTargets } from '@/constants/rulesets/rulesetTypes';
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
