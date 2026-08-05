/**
 * Guards the clinical-sign-off gate on PRD v1.2 §5.2's proposed collision
 * rows: they must stay OUT of the production matrix until reviewed, and the
 * BPO/AZA tags they reference must still be detected (the condition and
 * density layers depend on them).
 */

import { ACTIVES_RULESET } from '@/constants/rulesets/rulesetTypes';
import { PROPOSED_V12_PAIR_RULES_ENABLED } from '@/constants/featureFlags';
import {
  PROPOSED_V12_PAIR_RULES,
  getProposedPairRules,
} from '@/constants/rulesets/proposedPairRules';
import { ConflictEngine, matchPairRule } from '@/utils/conflictEngine';
import { parseActiveIngredientsFromInci } from '@/utils/ingredientParser';

describe('proposed v1.2 pair rules', () => {
  it('is disabled pending the combined clinical review pass (PRD §6)', () => {
    // Arrange / Act / Assert
    expect(PROPOSED_V12_PAIR_RULES_ENABLED).toBe(false);
    expect(getProposedPairRules()).toEqual([]);
  });

  it('keeps every proposed rule id out of the shipped ruleset', () => {
    // Arrange
    const shippedIds = ACTIVES_RULESET.pairRules.map((r) => r.id);
    // Act / Assert
    for (const proposed of PROPOSED_V12_PAIR_RULES) {
      expect(shippedIds).not.toContain(proposed.id);
    }
  });

  it.each([
    ['benzoyl_peroxide', 'aha'],
    ['benzoyl_peroxide', 'bha'],
    ['benzoyl_peroxide', 'copper_peptides'],
    ['benzoyl_peroxide', 'vitamin_c_pure'],
    ['azelaic_acid', 'aha'],
  ] as const)('does not flag %s + %s in the production matrix yet', (a, b) => {
    // Act / Assert
    expect(matchPairRule(a, b)).toBeNull();
    expect(ConflictEngine.detectConflicts([], [])).toEqual([]);
  });

  it('still detects benzoyl peroxide and azelaic acid as tags', () => {
    // Arrange / Act / Assert — tag detection ships regardless of the gate
    expect(parseActiveIngredientsFromInci('Water, Benzoyl Peroxide 5%')).toContain(
      'benzoyl_peroxide',
    );
    expect(parseActiveIngredientsFromInci('Water, Azelaic Acid')).toContain('azelaic_acid');
  });
});
