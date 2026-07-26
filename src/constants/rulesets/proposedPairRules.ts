import type { PairRule } from '@/constants/rulesets/rulesetTypes';
import { PROPOSED_V12_PAIR_RULES_ENABLED } from '@/constants/featureFlags';

/**
 * PRD v1.2 §5.2's "proposed, pending clinical sign-off" collision rows, held
 * OUT of production.
 *
 * They live here — beside actives.json but deliberately not inside it — so:
 *   - `ACTIVES_RULESET.pairRules` (which both ConflictEngine and the routine
 *     engine resolve against) stays exactly what a clinician signed off on, and
 *   - enabling them after review is one flag flip plus one array concat, not a
 *     re-derivation of the rules from the spec months later.
 *
 * Two of §5.2's proposed rows are absent from this file on purpose:
 * `benzoyl_peroxide` + `retinoid` and `vitamin_c_derivative` +
 * `benzoyl_peroxide` already existed in the shipped matrix before v1.2, so
 * re-declaring them here would duplicate live rules.
 *
 * The BPO/AZA tags these reference are already parsed and already used by the
 * v1.2 condition and density layers — only the PAIRWISE claims are gated.
 */
export const PROPOSED_V12_PAIR_RULES: readonly PairRule[] = [
  {
    id: 'proposed_bpo_acids',
    a: 'benzoyl_peroxide',
    b: ['aha', 'bha', 'pha'],
    scope: 'same_period',
    severity: 'caution',
    reasonCode: 'benzoyl_acid_conflict',
    resolutions: ['separate_periods', 'separate_days'],
    explanation:
      'Benzoyl peroxide and exfoliating acids are both drying, and their irritation is additive when layered in the same period.',
    suggestion: 'Consider using them in different periods or on alternating days.',
  },
  {
    id: 'proposed_bpo_copper_peptides',
    a: 'benzoyl_peroxide',
    b: 'copper_peptides',
    scope: 'same_period',
    severity: 'caution',
    reasonCode: 'benzoyl_copper_peptide_conflict',
    resolutions: ['separate_periods', 'separate_days'],
    explanation:
      'Benzoyl peroxide is a strong oxidiser and is reported to deactivate copper peptide complexes applied alongside it.',
    suggestion: 'Consider moving the peptide product to the opposite period.',
  },
  {
    id: 'proposed_bpo_vitamin_c_pure',
    a: 'benzoyl_peroxide',
    b: 'vitamin_c_pure',
    scope: 'same_period',
    severity: 'avoid',
    reasonCode: 'vitamin_c_benzoyl_conflict',
    resolutions: ['separate_periods', 'separate_days'],
    explanation:
      'Benzoyl peroxide oxidises ascorbic acid, so layering them in one period largely neutralises the vitamin C.',
    suggestion: 'Consider keeping vitamin C to the morning and benzoyl peroxide to the evening.',
  },
  {
    id: 'proposed_azelaic_acids',
    a: 'azelaic_acid',
    b: ['aha', 'bha', 'pha'],
    scope: 'same_period',
    severity: 'caution',
    reasonCode: 'azelaic_acid_conflict',
    resolutions: ['separate_periods', 'separate_days'],
    explanation:
      'Azelaic acid stacked with exfoliating acids in one period raises the combined irritation load.',
    suggestion: 'Consider alternating them rather than layering them the same evening.',
  },
];

/**
 * The pair rules to actually apply. Returns `[]` until sign-off flips
 * PROPOSED_V12_PAIR_RULES_ENABLED — nothing reads the proposals directly.
 */
export function getProposedPairRules(): readonly PairRule[] {
  return PROPOSED_V12_PAIR_RULES_ENABLED ? PROPOSED_V12_PAIR_RULES : [];
}
