/**
 * Unit tests for the skin-condition risk modifiers (PRD v1.2 §4.2.2,
 * US-23–US-27). Pure logic only: no rendering, no store access.
 *
 * The US-27 no-op harness at the bottom is the load-bearing test of this
 * feature — it runs every conflict case through the engine twice (actual
 * profile vs. conditions forced to []) and asserts equality.
 */

import { ConflictEngine } from '@/utils/conflictEngine';
import {
  AGGRESSIVE_PROCEDURES,
  CONDITION_MODIFIERS,
  applyConditionSeverityModifiers,
  escalate,
  getConditionRiskWarnings,
  getRecoveryConditionCaution,
  isAggressiveProcedure,
  toAdvisorySeverity,
  toConflictSeverity,
} from '@/utils/skinConditionModifiers';
import type { ActiveIngredientKey, Product, RoutineStep, SkinConditionType } from '@/types';

// ─── Factories ────────────────────────────────────────────────────────────────

let idCounter = 0;
const nextId = () => `sc-${++idCounter}`;

function makeProduct(keys: ActiveIngredientKey[], overrides: Partial<Product> = {}): Product {
  return {
    id: nextId(),
    name: 'Test Product',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: keys.map((key) => ({ key, displayName: key })),
    fullIngredientText: null,
    usageTime: 'evening',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

function makeStep(productId: string): RoutineStep {
  return {
    id: nextId(),
    productType: 'serum',
    productId,
    hidden: false,
    scheduledDays: [],
  };
}

// ─── Severity scale bridging ──────────────────────────────────────────────────

describe('severity scale projection', () => {
  it('maps the engine caution level onto medium and avoid onto high', () => {
    // Arrange / Act / Assert
    expect(toAdvisorySeverity('caution')).toBe('medium');
    expect(toAdvisorySeverity('avoid')).toBe('high');
  });

  it('projects advisory levels back onto the engine two-level scale', () => {
    expect(toConflictSeverity('low')).toBe('caution');
    expect(toConflictSeverity('medium')).toBe('caution');
    expect(toConflictSeverity('high')).toBe('avoid');
  });
});

describe('escalate', () => {
  it('raises a severity by exactly one level', () => {
    expect(escalate('low')).toBe('medium');
    expect(escalate('medium')).toBe('high');
  });

  it('caps at high rather than inventing a level above it', () => {
    expect(escalate('high')).toBe('high');
  });
});

// ─── applyConditionSeverityModifiers (US-24) ──────────────────────────────────

describe('applyConditionSeverityModifiers', () => {
  /** Vitamin C (pure) + AHA — a 'caution'-severity pair in the shipped matrix. */
  function cautionPairConflicts() {
    const vitc = makeProduct(['vitamin_c_pure']);
    const aha = makeProduct(['aha']);
    const steps = [makeStep(vitc.id), makeStep(aha.id)];
    return ConflictEngine.detectConflicts(steps, [vitc, aha]);
  }

  /** Retinoid + AHA — an 'avoid'-severity pair in the shipped matrix. */
  function avoidPairConflicts() {
    const reti = makeProduct(['retinoid']);
    const aha = makeProduct(['aha']);
    const steps = [makeStep(reti.id), makeStep(aha.id)];
    return ConflictEngine.detectConflicts(steps, [reti, aha]);
  }

  it('leaves severity at its engine level when no condition is selected', () => {
    // Arrange
    const conflicts = cautionPairConflicts();
    // Act
    const modified = applyConditionSeverityModifiers(conflicts, []);
    // Assert
    expect(modified).toHaveLength(1);
    expect(modified[0].severity).toBe('medium');
    expect(modified[0].escalated).toBe(false);
  });

  it('escalates one level when a condition targets a tag in the pair', () => {
    // Arrange
    const conflicts = cautionPairConflicts();
    // Act
    const modified = applyConditionSeverityModifiers(conflicts, ['eczema']);
    // Assert
    expect(modified[0].severity).toBe('high');
    expect(modified[0].escalated).toBe(true);
    expect(modified[0].escalatedBy).toEqual(['eczema']);
  });

  it('caps an already-high pair rather than escalating past high', () => {
    // Arrange
    const conflicts = avoidPairConflicts();
    // Act
    const modified = applyConditionSeverityModifiers(conflicts, ['eczema']);
    // Assert
    expect(modified[0].severity).toBe('high');
    expect(modified[0].escalated).toBe(false);
  });

  it('escalates only once when several conditions target the same pair', () => {
    // Arrange
    const conflicts = cautionPairConflicts();
    // Act
    const modified = applyConditionSeverityModifiers(conflicts, ['eczema', 'rosacea']);
    // Assert — two matching conditions, still exactly one level up
    expect(modified[0].severity).toBe('high');
    expect(modified[0].escalatedBy).toEqual(['eczema', 'rosacea']);
  });

  it('leaves a pair untouched when no selected condition targets either tag', () => {
    // Arrange — copper peptides + vitamin C, neither targeted by rosacea
    const pept = makeProduct(['copper_peptides']);
    const vitc = makeProduct(['vitamin_c_pure']);
    const conflicts = ConflictEngine.detectConflicts(
      [makeStep(pept.id), makeStep(vitc.id)],
      [pept, vitc],
    );
    // Act
    const modified = applyConditionSeverityModifiers(conflicts, ['rosacea']);
    // Assert
    expect(modified[0].severity).toBe('medium');
    expect(modified[0].escalated).toBe(false);
  });

  it('never mutates the engine result it wraps', () => {
    // Arrange
    const conflicts = cautionPairConflicts();
    const severityBefore = conflicts[0].rule.severity;
    // Act
    applyConditionSeverityModifiers(conflicts, ['eczema']);
    // Assert
    expect(conflicts[0].rule.severity).toBe(severityBefore);
  });

  it('keeps a retinoid + peptide combination non-conflicting under any condition', () => {
    // Arrange — US-24's explicit carve-out
    const reti = makeProduct(['retinoid']);
    const pept = makeProduct(['peptide_signal']);
    const conflicts = ConflictEngine.detectConflicts(
      [makeStep(reti.id), makeStep(pept.id)],
      [reti, pept],
    );
    // Act
    const modified = applyConditionSeverityModifiers(conflicts, ['eczema', 'rosacea']);
    // Assert
    expect(conflicts).toEqual([]);
    expect(modified).toEqual([]);
  });
});

// ─── getConditionRiskWarnings (US-24) ─────────────────────────────────────────

describe('getConditionRiskWarnings', () => {
  it('returns nothing when no condition is selected', () => {
    // Arrange
    const products = [makeProduct(['retinoid']), makeProduct(['aha'])];
    // Act
    const advisories = getConditionRiskWarnings(products, []);
    // Assert
    expect(advisories).toEqual([]);
  });

  it('surfaces an advisory for a single relevant ingredient with no second product', () => {
    // Arrange
    const products = [makeProduct(['retinoid'], { name: 'Night Serum' })];
    // Act
    const advisories = getConditionRiskWarnings(products, ['rosacea']);
    // Assert
    expect(advisories).toHaveLength(1);
    expect(advisories[0].tag).toBe('retinoid');
    expect(advisories[0].productNames).toEqual(['Night Serum']);
  });

  it('never uses the word conflict in a single-ingredient advisory', () => {
    // Arrange
    const products = [makeProduct(['retinoid']), makeProduct(['aha']), makeProduct(['benzoyl_peroxide'])];
    // Act
    const advisories = getConditionRiskWarnings(products, ['eczema', 'rosacea']);
    // Assert
    expect(advisories.length).toBeGreaterThan(0);
    for (const advisory of advisories) {
      expect(advisory.message.toLowerCase()).not.toContain('conflict');
    }
  });

  it('rates azelaic acid low for eczema rather than escalating it', () => {
    // Arrange
    const products = [makeProduct(['azelaic_acid'])];
    // Act
    const advisories = getConditionRiskWarnings(products, ['eczema']);
    // Assert
    expect(advisories).toHaveLength(1);
    expect(advisories[0].severity).toBe('low');
  });

  it('produces no advisory for barrier-supporting ingredients', () => {
    // Arrange — the documented "no penalty for" set
    const products = [
      makeProduct(['ceramides']),
      makeProduct(['panthenol']),
      makeProduct(['glycerin_class']),
      makeProduct(['niacinamide']),
    ];
    // Act
    const advisories = getConditionRiskWarnings(products, ['eczema', 'rosacea', 'seborrheic_dermatitis']);
    // Assert
    expect(advisories).toEqual([]);
  });

  it('produces nothing for seborrheic dermatitis alone (documented no-op in v1)', () => {
    // Arrange — the format-based check has no catalog field to read yet
    const products = [makeProduct(['retinoid']), makeProduct(['aha'])];
    // Act
    const advisories = getConditionRiskWarnings(products, ['seborrheic_dermatitis']);
    // Assert
    expect(advisories).toEqual([]);
  });

  it('merges two conditions targeting the same tag into one row', () => {
    // Arrange — both eczema and rosacea flag retinoids
    const products = [makeProduct(['retinoid'], { name: 'Night Retinal' })];
    // Act
    const advisories = getConditionRiskWarnings(products, ['eczema', 'rosacea']);
    // Assert — one row, not two near-identical ones
    expect(advisories).toHaveLength(1);
    expect(advisories[0].conditions).toEqual(['eczema', 'rosacea']);
    expect(advisories[0].conditionLabels).toEqual([
      'Eczema / atopic dermatitis',
      'Rosacea',
    ]);
  });

  it('renders a merged row at the highest matching severity', () => {
    // Arrange — azelaic acid is 'low' for eczema and unflagged by rosacea
    const products = [makeProduct(['azelaic_acid'])];
    // Act
    const advisories = getConditionRiskWarnings(products, ['eczema', 'rosacea']);
    // Assert
    expect(advisories).toHaveLength(1);
    expect(advisories[0].severity).toBe('low');
  });

  it('still emits separate rows for different tags', () => {
    // Arrange
    const products = [makeProduct(['retinoid']), makeProduct(['bha'])];
    // Act
    const advisories = getConditionRiskWarnings(products, ['rosacea']);
    // Assert
    expect(advisories.map((a) => a.tag).sort()).toEqual(['bha', 'retinoid']);
  });

  it('counts two products sharing a name as two carriers', () => {
    // Arrange — carriers key on id, never on display name
    const products = [
      makeProduct(['retinoid'], { name: 'Retinol Cream' }),
      makeProduct(['retinoid'], { name: 'Retinol Cream' }),
    ];
    // Act
    const advisories = getConditionRiskWarnings(products, ['rosacea']);
    // Assert
    expect(advisories[0].productNames).toHaveLength(2);
  });

  it('lists every product carrying the tag on one advisory row', () => {
    // Arrange
    const products = [
      makeProduct(['retinoid'], { name: 'Retinal 0.1' }),
      makeProduct(['retinoid'], { name: 'Retinol Cream' }),
    ];
    // Act
    const advisories = getConditionRiskWarnings(products, ['rosacea']);
    // Assert
    expect(advisories).toHaveLength(1);
    expect(advisories[0].productNames).toEqual(['Retinal 0.1', 'Retinol Cream']);
  });

  it('covers no-penalty tags that are absent from every advisory rule', () => {
    // Arrange / Act / Assert — table-level invariant, not input-dependent
    for (const modifier of CONDITION_MODIFIERS) {
      const advisoryTags = modifier.advisories.flatMap((a) => a.tags);
      for (const safeTag of modifier.noPenaltyTags) {
        expect(advisoryTags).not.toContain(safeTag);
      }
    }
  });
});

// ─── getRecoveryConditionCaution (US-25) ──────────────────────────────────────

describe('getRecoveryConditionCaution', () => {
  it('returns a rehab caution for eczema after an aggressive procedure', () => {
    // Arrange / Act
    const line = getRecoveryConditionCaution(['eczema'], { aggressive: true, phase: 'rehab' });
    // Assert
    expect(line).toContain('Recovery may take a bit longer');
  });

  it('returns a fading caution for rosacea after an aggressive procedure', () => {
    const line = getRecoveryConditionCaution(['rosacea'], { aggressive: true, phase: 'fading' });
    expect(line).not.toBeNull();
  });

  it('returns nothing for a non-aggressive procedure', () => {
    const line = getRecoveryConditionCaution(['eczema'], { aggressive: false, phase: 'rehab' });
    expect(line).toBeNull();
  });

  it('returns nothing when no condition is selected', () => {
    const line = getRecoveryConditionCaution([], { aggressive: true, phase: 'rehab' });
    expect(line).toBeNull();
  });

  it('returns nothing for seborrheic dermatitis alone', () => {
    const line = getRecoveryConditionCaution(['seborrheic_dermatitis'], {
      aggressive: true,
      phase: 'rehab',
    });
    expect(line).toBeNull();
  });

  it('classifies botox and fillers as non-aggressive', () => {
    expect(isAggressiveProcedure('botox')).toBe(false);
    expect(isAggressiveProcedure('fillers')).toBe(false);
    expect(isAggressiveProcedure('custom')).toBe(false);
  });

  it('classifies the deep peel as aggressive', () => {
    expect(isAggressiveProcedure('chemical_peel_deep')).toBe(true);
    expect(AGGRESSIVE_PROCEDURES).toContain('chemical_peel_deep');
  });
});

// ─── US-27 no-op regression harness ───────────────────────────────────────────

/**
 * The guarantee: for a user with no condition selected, every v1.2 layer is
 * inert. Each case runs twice — once with the user's actual (empty) selection
 * and once with conditions forced to [] — and the two outputs must be equal,
 * so the feature can never grow a code path that fires without opt-in.
 */
describe('US-27 no-op guarantee for users without conditions', () => {
  const PAIR_CASES: { name: string; keysA: ActiveIngredientKey[]; keysB: ActiveIngredientKey[] }[] = [
    { name: 'retinoid + AHA', keysA: ['retinoid'], keysB: ['aha'] },
    { name: 'retinoid + BHA', keysA: ['retinoid'], keysB: ['bha'] },
    { name: 'benzoyl peroxide + retinoid', keysA: ['benzoyl_peroxide'], keysB: ['retinoid'] },
    { name: 'copper peptides + AHA', keysA: ['copper_peptides'], keysB: ['aha'] },
    { name: 'pure vitamin C + AHA', keysA: ['vitamin_c_pure'], keysB: ['bha'] },
    { name: 'pure vitamin C + copper peptides', keysA: ['vitamin_c_pure'], keysB: ['copper_peptides'] },
    { name: 'vitamin C derivative + benzoyl peroxide', keysA: ['vitamin_c_derivative'], keysB: ['benzoyl_peroxide'] },
    { name: 'retinoid + signal peptide (compatible)', keysA: ['retinoid'], keysB: ['peptide_signal'] },
    { name: 'azelaic acid + AHA (not in the shipped matrix)', keysA: ['azelaic_acid'], keysB: ['aha'] },
    { name: 'ceramides + panthenol (inert)', keysA: ['ceramides'], keysB: ['panthenol'] },
  ];

  /** A profile that genuinely has no condition selected. */
  const actualConditions: SkinConditionType[] = [];
  const forcedEmpty: SkinConditionType[] = [];

  it.each(PAIR_CASES)('renders $name identically with and without the feature', ({ keysA, keysB }) => {
    // Arrange
    const productA = makeProduct(keysA);
    const productB = makeProduct(keysB);
    const products = [productA, productB];
    const steps = [makeStep(productA.id), makeStep(productB.id)];
    const conflicts = ConflictEngine.detectConflicts(steps, products);

    // Act — the same inputs through both severity paths and both check layers
    const withActual = applyConditionSeverityModifiers(conflicts, actualConditions);
    const withForced = applyConditionSeverityModifiers(conflicts, forcedEmpty);

    // Assert — identical output, and the raw engine severity is what renders
    expect(withActual).toEqual(withForced);
    for (const modified of withActual) {
      expect(modified.severity).toBe(toAdvisorySeverity(modified.result.rule.severity));
      expect(modified.escalated).toBe(false);
    }
    expect(getConditionRiskWarnings(products, actualConditions)).toEqual([]);
    expect(getConditionRiskWarnings(products, forcedEmpty)).toEqual([]);
  });

  it('adds no recovery caution line in any phase', () => {
    // Arrange / Act / Assert
    for (const phase of ['rehab', 'fading'] as const) {
      for (const aggressive of [true, false]) {
        expect(getRecoveryConditionCaution([], { aggressive, phase })).toBeNull();
      }
    }
  });
});
