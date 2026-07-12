import { INGREDIENT_CONFLICT_RULES } from '../../constants/conflictRulesDb';
import type { ActiveIngredientKey, ConflictRule } from '../../types';
import { normalizeActiveKey } from '../ingredientParser';

/**
 * Finds conflict rules whose BOTH sides appear within a single product's
 * active keys. Informational preview only — the real same-day check happens
 * later in Routine Hub against actual scheduled days (US-09); this just
 * tells the user the product carries interacting actives so they schedule
 * thoughtfully.
 */
export function findIntraProductConflicts(keys: ActiveIngredientKey[]): ConflictRule[] {
  const canonical = [...new Set(keys.map(normalizeActiveKey))];
  const hits: ConflictRule[] = [];

  for (const rule of INGREDIENT_CONFLICT_RULES) {
    for (let i = 0; i < canonical.length; i++) {
      for (let j = i + 1; j < canonical.length; j++) {
        const a = canonical[i];
        const b = canonical[j];
        if (
          (rule.itemA === a && rule.itemB === b) ||
          (rule.itemA === b && rule.itemB === a)
        ) {
          hits.push(rule);
        }
      }
    }
  }

  return hits;
}
