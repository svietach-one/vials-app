/**
 * Integration tests for ConflictEngine
 *
 * Verifies that the conflict detection logic correctly identifies ingredient
 * pair conflicts, seasonal restrictions, phototype cautions, and procedure
 * collision rules using only local rule constants — no mocks needed.
 */

import { ConflictEngine } from '@/utils/conflictEngine';
import { getProductActiveKeys } from '@/utils/ingredientParser';
import type { Product, RoutineStep } from '@/types';

// ─── Factories ────────────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId(): string {
  return `test-id-${++_idCounter}`;
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: nextId(),
    name: 'Test Product',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
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

function makeStep(productId: string, overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: nextId(),
    productType: 'serum',
    productId,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

// ─── detectConflicts — ingredient pair conflicts ───────────────────────────────

describe('ConflictEngine.detectConflicts', () => {
  it('should return retinol + AHA conflict when both are present in routine steps', () => {
    const productA = makeProduct({
      activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    });
    const productB = makeProduct({
      activeIngredients: [{ key: 'aha', displayName: 'Glycolic Acid' }],
    });
    const steps = [makeStep(productA.id), makeStep(productB.id)];

    const results = ConflictEngine.detectConflicts(steps, [productA, productB]);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule_retinol_aha');
    expect(results[0].rule.severity).toBe('avoid');
  });

  it('should return retinol + BHA conflict when both are present in routine steps', () => {
    const productA = makeProduct({
      activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    });
    const productB = makeProduct({
      activeIngredients: [{ key: 'bha', displayName: 'Salicylic Acid' }],
    });
    const steps = [makeStep(productA.id), makeStep(productB.id)];

    const results = ConflictEngine.detectConflicts(steps, [productA, productB]);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule_retinol_bha');
    expect(results[0].rule.severity).toBe('avoid');
  });

  it('does not conflict a signal peptide with pure vitamin C', () => {
    // The headline acceptance case (spec phase-01). Assert the attribution too:
    // before the subclass split, Matrixyl matched no class at all, so "no
    // conflict" passed vacuously. It must now be a recognised peptide_signal
    // product AND still be conflict-free.
    const matrixyl = makeProduct({
      fullIngredientText: 'Aqua, Palmitoyl Pentapeptide-4, Glycerin',
    });
    const vitC = makeProduct({ fullIngredientText: 'Aqua, Ascorbic Acid' });
    const steps = [makeStep(matrixyl.id), makeStep(vitC.id)];

    expect(getProductActiveKeys(matrixyl)).toContain('peptide_signal');
    expect(ConflictEngine.detectConflicts(steps, [matrixyl, vitC])).toEqual([]);
  });

  it('conflicts a copper peptide with pure vitamin C at caution', () => {
    const ghkCu = makeProduct({ fullIngredientText: 'Aqua, Copper Tripeptide-1' });
    const vitC = makeProduct({ fullIngredientText: 'Aqua, Ascorbic Acid' });
    const steps = [makeStep(ghkCu.id), makeStep(vitC.id)];

    const results = ConflictEngine.detectConflicts(steps, [ghkCu, vitC]);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule_vitc_pure_copper_peptides');
    expect(results[0].rule.severity).toBe('caution');
  });

  it('matches a pair rule whose side is a shared group (copper peptides × acids)', () => {
    // pairRules sides may be arrays; the legacy flat table could not express
    // this, so the array path is new and needs its own cover.
    const ghkCu = makeProduct({ activeTags: ['copper_peptides'] });
    const bha = makeProduct({ activeTags: ['bha'] });
    const steps = [makeStep(ghkCu.id), makeStep(bha.id)];

    const results = ConflictEngine.detectConflicts(steps, [ghkCu, bha]);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule_copper_peptides_acids');
    expect(results[0].rule.itemA).toBe('copper_peptides');
    expect(results[0].rule.itemB).toBe('bha');
  });

  it('treats vitamin C + niacinamide as compatible — the low-pH myth is retired', () => {
    // Regression lock (spec phase-01 §1.4): the two are widely believed to
    // cancel each other out. They do not, and this pair carried a caution rule
    // until 2026-07-17. Do not reintroduce one without a clinical source.
    const productA = makeProduct({
      activeIngredients: [{ key: 'vitamin_c', displayName: 'Ascorbic Acid' }],
    });
    const productB = makeProduct({
      activeIngredients: [{ key: 'niacinamide', displayName: 'Niacinamide' }],
    });
    const steps = [makeStep(productA.id), makeStep(productB.id)];

    const results = ConflictEngine.detectConflicts(steps, [productA, productB]);

    expect(results).toEqual([]);
  });

  it('should return benzoyl peroxide + retinol conflict when both are present in routine steps', () => {
    const productA = makeProduct({
      activeIngredients: [{ key: 'benzoyl_peroxide', displayName: 'Benzoyl Peroxide' }],
    });
    const productB = makeProduct({
      activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    });
    const steps = [makeStep(productA.id), makeStep(productB.id)];

    const results = ConflictEngine.detectConflicts(steps, [productA, productB]);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule_benzoyl_retinol');
    expect(results[0].rule.severity).toBe('avoid');
  });

  it('should detect conflict regardless of the order products appear in steps', () => {
    // AHA first, retinol second — rule is defined as itemA=retinol, itemB=aha
    const productAha = makeProduct({
      activeIngredients: [{ key: 'aha', displayName: 'Lactic Acid' }],
    });
    const productRetinol = makeProduct({
      activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    });
    const steps = [makeStep(productAha.id), makeStep(productRetinol.id)];

    const results = ConflictEngine.detectConflicts(steps, [productAha, productRetinol]);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule_retinol_aha');
  });

  it('should not flag retinol + copper peptides as a conflict (compatible pair)', () => {
    const productA = makeProduct({
      activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    });
    const productB = makeProduct({
      activeIngredients: [{ key: 'copper_peptides', displayName: 'Copper Tripeptide-1' }],
    });
    const steps = [makeStep(productA.id), makeStep(productB.id)];

    const results = ConflictEngine.detectConflicts(steps, [productA, productB]);

    expect(results).toHaveLength(0);
  });

  it('should skip hidden steps when detecting conflicts', () => {
    const productA = makeProduct({
      activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    });
    const productB = makeProduct({
      activeIngredients: [{ key: 'aha', displayName: 'Glycolic Acid' }],
    });
    // productB step is hidden
    const steps = [
      makeStep(productA.id),
      makeStep(productB.id, { hidden: true }),
    ];

    const results = ConflictEngine.detectConflicts(steps, [productA, productB]);

    expect(results).toHaveLength(0);
  });

  it('should skip steps with no productId (empty slot)', () => {
    const productA = makeProduct({
      activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    });
    const steps = [
      makeStep(productA.id),
      makeStep(null as unknown as string, { productId: null }),
    ];

    const results = ConflictEngine.detectConflicts(steps, [productA]);

    expect(results).toHaveLength(0);
  });

  it('should return stepIdA and stepIdB matching the routine step ids', () => {
    const productA = makeProduct({
      activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    });
    const productB = makeProduct({
      activeIngredients: [{ key: 'aha', displayName: 'Glycolic Acid' }],
    });
    const stepA = makeStep(productA.id);
    const stepB = makeStep(productB.id);

    const results = ConflictEngine.detectConflicts([stepA, stepB], [productA, productB]);

    expect(results[0].stepIdA).toBe(stepA.id);
    expect(results[0].stepIdB).toBe(stepB.id);
  });

  it('should return multiple conflicts when three incompatible products are present', () => {
    // retinol vs aha + retinol vs bha
    const productRetinol = makeProduct({
      activeIngredients: [{ key: 'retinol', displayName: 'Retinol' }],
    });
    const productAha = makeProduct({
      activeIngredients: [{ key: 'aha', displayName: 'Glycolic Acid' }],
    });
    const productBha = makeProduct({
      activeIngredients: [{ key: 'bha', displayName: 'Salicylic Acid' }],
    });
    const steps = [
      makeStep(productRetinol.id),
      makeStep(productAha.id),
      makeStep(productBha.id),
    ];

    const results = ConflictEngine.detectConflicts(steps, [productRetinol, productAha, productBha]);

    // retinol<>aha, retinol<>bha — that's 2 conflicts
    expect(results).toHaveLength(2);
    const ruleIds = results.map((r) => r.rule.id);
    expect(ruleIds).toContain('rule_retinol_aha');
    expect(ruleIds).toContain('rule_retinol_bha');
  });

  it('should detect conflicts derived from INCI fullIngredientText when no explicit activeIngredients are set', () => {
    const productA = makeProduct({
      activeIngredients: [],
      fullIngredientText: 'Water, Glycerin, Retinol, Fragrance',
    });
    const productB = makeProduct({
      activeIngredients: [],
      fullIngredientText: 'Water, Glycolic Acid, Niacinamide',
    });
    const steps = [makeStep(productA.id), makeStep(productB.id)];

    const results = ConflictEngine.detectConflicts(steps, [productA, productB]);

    // Retinol (from INCI) vs AHA (from INCI) should trigger rule_retinol_aha
    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('rule_retinol_aha');
  });
});

// ─── checkSeasonalConflict ────────────────────────────────────────────────────

describe('ConflictEngine.checkSeasonalConflict', () => {
  it('should return an avoid conflict when deep chemical peel is planned in summer', () => {
    const result = ConflictEngine.checkSeasonalConflict('chemical_peel_deep', 'summer');

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('avoid');
  });

  it('should return null when deep chemical peel is planned in autumn', () => {
    const result = ConflictEngine.checkSeasonalConflict('chemical_peel_deep', 'autumn');

    expect(result).toBeNull();
  });

  it('should return null when deep chemical peel is planned in winter', () => {
    const result = ConflictEngine.checkSeasonalConflict('chemical_peel_deep', 'winter');

    expect(result).toBeNull();
  });

  it('should return null when deep chemical peel is planned in spring', () => {
    const result = ConflictEngine.checkSeasonalConflict('chemical_peel_deep', 'spring');

    expect(result).toBeNull();
  });

  it('should return null when botox is planned in summer (not a seasonal-restricted procedure)', () => {
    const result = ConflictEngine.checkSeasonalConflict('botox', 'summer');

    expect(result).toBeNull();
  });

  it('should return null when fillers are planned in summer (not a seasonal-restricted procedure)', () => {
    const result = ConflictEngine.checkSeasonalConflict('fillers', 'summer');

    expect(result).toBeNull();
  });
});

// ─── checkPhototypeConflict ────────────────────────────────────────────────────

describe('ConflictEngine.checkPhototypeConflict', () => {
  it('should return a caution conflict for type_3_4 phototype with deep chemical peel', () => {
    const result = ConflictEngine.checkPhototypeConflict('chemical_peel_deep', 'type_3_4');

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('caution');
  });

  it('should return a caution conflict for type_5_6 phototype with deep chemical peel', () => {
    const result = ConflictEngine.checkPhototypeConflict('chemical_peel_deep', 'type_5_6');

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('caution');
  });

  it('should return null for type_1_2 phototype with deep chemical peel', () => {
    const result = ConflictEngine.checkPhototypeConflict('chemical_peel_deep', 'type_1_2');

    expect(result).toBeNull();
  });

  it('should return null when phototype is null', () => {
    const result = ConflictEngine.checkPhototypeConflict('chemical_peel_deep', null);

    expect(result).toBeNull();
  });

  it('should return null for type_3_4 with botox (non-restricted procedure)', () => {
    const result = ConflictEngine.checkPhototypeConflict('botox', 'type_3_4');

    expect(result).toBeNull();
  });
});

// ─── checkProcedureCollision ───────────────────────────────────────────────────

describe('ConflictEngine.checkProcedureCollision', () => {
  it('should return an avoid conflict when botox and smas_lifting are both active', () => {
    const result = ConflictEngine.checkProcedureCollision('botox', [
      { procedureKey: 'smas_lifting', datePerformed: '2026-05-01' },
    ]);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('avoid');
  });

  it('should detect the collision in reverse order (smas_lifting added when botox is active)', () => {
    const result = ConflictEngine.checkProcedureCollision('smas_lifting', [
      { procedureKey: 'botox', datePerformed: '2026-05-01' },
    ]);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('avoid');
  });

  it('should return an avoid conflict when fillers and chemical_peel_deep are both active', () => {
    const result = ConflictEngine.checkProcedureCollision('fillers', [
      { procedureKey: 'chemical_peel_deep', datePerformed: '2026-05-01' },
    ]);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('avoid');
  });

  it('should return null when adding botox with no active procedures', () => {
    const result = ConflictEngine.checkProcedureCollision('botox', []);

    expect(result).toBeNull();
  });

  it('should return null when adding mesotherapy with an active botox procedure (no collision rule)', () => {
    const result = ConflictEngine.checkProcedureCollision('mesotherapy', [
      { procedureKey: 'botox', datePerformed: '2026-05-01' },
    ]);

    expect(result).toBeNull();
  });
});

// ─── getRehabRestrictions ─────────────────────────────────────────────────────

describe('ConflictEngine.getRehabRestrictions', () => {
  it('should return botox-specific lifestyle restrictions', () => {
    const restrictions = ConflictEngine.getRehabRestrictions('botox');

    expect(restrictions.length).toBeGreaterThan(0);
    expect(restrictions.some((r) => r.toLowerCase().includes('sauna'))).toBe(true);
  });

  it('should return fillers-specific lifestyle restrictions', () => {
    const restrictions = ConflictEngine.getRehabRestrictions('fillers');

    expect(restrictions.length).toBeGreaterThan(0);
    expect(restrictions.some((r) => r.toLowerCase().includes('alcohol'))).toBe(true);
  });

  it('should return chemical_peel_deep-specific lifestyle restrictions', () => {
    const restrictions = ConflictEngine.getRehabRestrictions('chemical_peel_deep');

    expect(restrictions.length).toBeGreaterThan(0);
    expect(restrictions.some((r) => r.toLowerCase().includes('spf'))).toBe(true);
  });

  it('should return a non-empty list for every supported procedure key', () => {
    const keys = ['botox', 'fillers', 'smas_lifting', 'mesotherapy', 'chemical_peel_deep', 'mechanical_facial'] as const;
    for (const key of keys) {
      expect(ConflictEngine.getRehabRestrictions(key).length).toBeGreaterThan(0);
    }
  });
});
