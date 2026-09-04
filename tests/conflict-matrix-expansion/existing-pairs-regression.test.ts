/**
 * FE-8 (pre-existing-pair half only) — full before/after regression snapshot
 * of the pairRules that shipped before this task.
 * Spec: docs/specs/vials-conflict-matrix-expansion.md (Story 4)
 * Tech design: docs/tech-design/vials-conflict-matrix-expansion.md §3
 *
 * This is the most important regression guard in the whole task: none of
 * these entries may change severity, trigger condition, or copy as a side
 * effect of adding the new physical_exfoliant class or (once unblocked) the
 * new benzoyl-peroxide/niacinamide pairs. Values below were read verbatim
 * from the live src/constants/rulesets/actives.json on 2026-08-05, not
 * guessed or reconstructed from the spec's prose (tech design's explicit
 * instruction).
 *
 * Note on count: the spec/handoff prose refers to "6 pre-existing pairs";
 * the live ruleset actually ships 7 pairRule entries pre-dating this task.
 * All 7 are snapshotted below rather than trusting the "6" figure.
 *
 * Two of these (rule_benzoyl_retinol, rule_vitc_derivative_bpo) are the pairs
 * handoff.json's bounded_decision_list flags as needing only "retroactive
 * confirmation, not fresh approval" — this suite is what that confirmation
 * protects going forward, not a re-approval of the values themselves.
 */
import activesRuleset from '@/constants/rulesets/actives.json';
import { ConflictEngine } from '@/utils/conflictEngine';
import type { ActiveIngredientKey } from '@/types';
import { makeProduct, makeStep } from './fixtures';

interface PairRuleSnapshot {
  id: string;
  a: string | string[];
  b: string | string[];
  scope: string;
  severity: string;
  reasonCode: string;
  resolutions: string[];
  exceptions?: unknown[];
  explanation: string;
  suggestion: string;
}

const PAIR_RULES = activesRuleset.pairRules as unknown as PairRuleSnapshot[];

function ruleById(id: string): PairRuleSnapshot {
  const rule = PAIR_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`Expected pre-existing pairRule "${id}" to still exist`);
  return rule;
}

describe('actives.json — pre-existing pairRules stay byte-identical (FE-8)', () => {
  it('rule_retinol_aha is unchanged', () => {
    expect(ruleById('rule_retinol_aha')).toEqual({
      id: 'rule_retinol_aha',
      a: 'retinoid',
      b: 'aha',
      scope: 'same_period',
      severity: 'avoid',
      reasonCode: 'retinoid_acid_conflict',
      resolutions: ['separate_days', 'freeze_lower_priority'],
      exceptions: [{ whenPotencyAtMost: { a: 'low' }, downgradeTo: 'caution' }],
      explanation:
        'Both Retinoids and AHA (Glycolic/Lactic acid) accelerate skin cell turnover. Combining them in the same routine causes severe redness, peeling, and chemical irritation.',
      suggestion:
        'Separate them: use AHA 2 nights a week, and your retinoid on the other nights. Never layer them together.',
    });
  });

  it('rule_retinol_bha is unchanged', () => {
    expect(ruleById('rule_retinol_bha')).toEqual({
      id: 'rule_retinol_bha',
      a: 'retinoid',
      b: 'bha',
      scope: 'same_period',
      severity: 'avoid',
      reasonCode: 'retinoid_acid_conflict',
      resolutions: ['separate_periods', 'separate_days'],
      exceptions: [{ whenPotencyAtMost: { b: 'low' }, downgradeTo: 'caution' }],
      explanation:
        'Salicylic Acid (BHA) strips lipids, while retinoids alter deep cell behavior. Layering them compromises the moisture barrier, triggering breakout flare-ups and dermatitis.',
      suggestion: 'Use BHA in your morning cleanser step (wash-off) and your retinoid strictly at night.',
    });
  });

  it('rule_benzoyl_retinol is unchanged (retroactive-confirmation-only pair per handoff bounded_decision_list)', () => {
    expect(ruleById('rule_benzoyl_retinol')).toEqual({
      id: 'rule_benzoyl_retinol',
      a: 'benzoyl_peroxide',
      b: 'retinoid',
      scope: 'same_period',
      severity: 'avoid',
      reasonCode: 'benzoyl_retinoid_conflict',
      resolutions: ['separate_periods', 'separate_days'],
      explanation:
        'Benzoyl Peroxide oxidizes retinoids, rendering both compounds completely useless while doubling skin dryness.',
      suggestion: 'Use Benzoyl Peroxide as a spot treatment in the morning, and your retinoid at night.',
    });
  });

  it('rule_copper_peptides_acids is unchanged', () => {
    expect(ruleById('rule_copper_peptides_acids')).toEqual({
      id: 'rule_copper_peptides_acids',
      a: 'copper_peptides',
      b: ['aha', 'bha', 'pha'],
      scope: 'same_period',
      severity: 'avoid',
      reasonCode: 'copper_peptide_acid_conflict',
      resolutions: ['separate_periods', 'separate_days'],
      explanation:
        'Acids alter the optimal pH required for copper peptides, potentially breaking down the peptide structure and neutralizing its remodeling benefits.',
      suggestion: 'Use copper peptides in the morning and acids at night, or alternate them on different days.',
    });
  });

  it('rule_vitc_pure_acids is unchanged', () => {
    expect(ruleById('rule_vitc_pure_acids')).toEqual({
      id: 'rule_vitc_pure_acids',
      a: 'vitamin_c_pure',
      b: ['aha', 'bha'],
      scope: 'same_period',
      severity: 'caution',
      reasonCode: 'vitamin_c_acid_conflict',
      resolutions: ['separate_periods', 'keep_with_note'],
      exceptions: [{ whenPotencyAtMost: { b: 'low' }, downgradeTo: 'keep_with_note' }],
      explanation:
        'Layering multiple low-pH acids dramatically increases the risk of skin irritation and barrier disruption.',
      suggestion: 'Keep pure Vitamin C in the morning and exfoliating acids in the evening.',
    });
  });

  it('rule_vitc_pure_copper_peptides is unchanged', () => {
    expect(ruleById('rule_vitc_pure_copper_peptides')).toEqual({
      id: 'rule_vitc_pure_copper_peptides',
      a: 'vitamin_c_pure',
      b: 'copper_peptides',
      scope: 'same_period',
      severity: 'caution',
      reasonCode: 'vitamin_c_copper_conflict',
      resolutions: ['separate_periods', 'keep_with_note'],
      explanation:
        'Pure Vitamin C is acidic and oxidises the copper ion in copper peptides, breaking down the peptide complex and neutralising both ingredients.',
      suggestion:
        'Use copper peptides in the morning and pure Vitamin C in the evening, or alternate them on different days.',
    });
  });

  it('rule_vitc_derivative_bpo is unchanged (retroactive-confirmation-only pair per handoff bounded_decision_list)', () => {
    expect(ruleById('rule_vitc_derivative_bpo')).toEqual({
      id: 'rule_vitc_derivative_bpo',
      a: 'vitamin_c_derivative',
      b: 'benzoyl_peroxide',
      scope: 'same_period',
      severity: 'caution',
      reasonCode: 'vitamin_c_benzoyl_conflict',
      resolutions: ['separate_periods', 'keep_with_note'],
      explanation:
        'Benzoyl Peroxide is a strong oxidiser and degrades Vitamin C derivatives on contact, leaving both less effective.',
      suggestion:
        'Apply Benzoyl Peroxide in the morning and your Vitamin C derivative at night, or use them on alternate days.',
    });
  });
});

describe('ConflictEngine.detectConflicts — pre-existing pairs resolve end-to-end, unchanged (FE-8)', () => {
  const CASES: {
    id: string;
    keysA: ActiveIngredientKey[];
    keysB: ActiveIngredientKey[];
    severity: string;
  }[] = [
    { id: 'rule_retinol_aha', keysA: ['retinoid'], keysB: ['aha'], severity: 'avoid' },
    { id: 'rule_retinol_bha', keysA: ['retinoid'], keysB: ['bha'], severity: 'avoid' },
    { id: 'rule_benzoyl_retinol', keysA: ['benzoyl_peroxide'], keysB: ['retinoid'], severity: 'avoid' },
    { id: 'rule_copper_peptides_acids', keysA: ['copper_peptides'], keysB: ['bha'], severity: 'avoid' },
    { id: 'rule_vitc_pure_acids', keysA: ['vitamin_c_pure'], keysB: ['aha'], severity: 'caution' },
    {
      id: 'rule_vitc_pure_copper_peptides',
      keysA: ['vitamin_c_pure'],
      keysB: ['copper_peptides'],
      severity: 'caution',
    },
    {
      id: 'rule_vitc_derivative_bpo',
      keysA: ['vitamin_c_derivative'],
      keysB: ['benzoyl_peroxide'],
      severity: 'caution',
    },
  ];

  it.each(CASES)('resolves $id at severity $severity via detectConflicts', ({ id, keysA, keysB, severity }) => {
    const a = makeProduct(keysA);
    const b = makeProduct(keysB);
    const steps = [makeStep(a.id), makeStep(b.id)];

    const results = ConflictEngine.detectConflicts(steps, [a, b]);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe(id);
    expect(results[0].rule.severity).toBe(severity);
  });
});
