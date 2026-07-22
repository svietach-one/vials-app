import type { ActiveIngredientKey, ConflictRule } from '../../types';
import { matchPairRule } from '../conflictEngine';
import { normalizeActiveKey } from '../ingredientParser';

/**
 * Finds conflict rules whose BOTH sides appear within a single product's
 * active keys. Informational preview only — the real same-day check happens
 * later in Routine Hub against actual scheduled days (US-09); this just
 * tells the user the product carries interacting actives so they schedule
 * thoughtfully.
 *
 * Matching is delegated to ConflictEngine's matchPairRule so this preview and
 * the real check can never disagree about what conflicts.
 */
export function findIntraProductConflicts(keys: ActiveIngredientKey[]): ConflictRule[] {
  const canonical = [...new Set(keys.map(normalizeActiveKey))];
  const hits: ConflictRule[] = [];

  for (let i = 0; i < canonical.length; i++) {
    for (let j = i + 1; j < canonical.length; j++) {
      const rule = matchPairRule(canonical[i], canonical[j]);
      if (rule) hits.push(rule);
    }
  }

  return hits;
}
