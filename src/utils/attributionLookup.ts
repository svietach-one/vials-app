import aliasOverrides from '@/constants/rulesets/aliasOverrides.json';
import type { ActiveIngredientKey } from '@/types';
import { parseActiveIngredientDetails, type MatchedToken } from '@/utils/ingredientParser';

const ALIAS_OVERRIDES = aliasOverrides as Record<string, { microCopy: string }>;

/** Matched substrings for one active-ingredient class, recomputed on demand from the product's INCI text. */
export function getMatchesForKey(
  fullIngredientText: string | null,
  key: ActiveIngredientKey,
): MatchedToken[] {
  const details = parseActiveIngredientDetails(fullIngredientText ?? '');
  return details.find((detail) => detail.key === key)?.matches ?? [];
}

/** True when at least one matched substring is a registered regional/alias term. */
export function hasAliasOverride(matches: MatchedToken[]): boolean {
  return matches.some((match) => Boolean(ALIAS_OVERRIDES[match.matcherPattern]));
}

/** Override micro-copy for a matcher, or null when it matched via the canonical/expected term. */
export function getAliasMicroCopy(match: MatchedToken): string | null {
  return ALIAS_OVERRIDES[match.matcherPattern]?.microCopy ?? null;
}
