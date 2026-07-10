import type { Product, UserProcedureLog } from '@/types';
import { buildRoutineContext } from '@/utils/routineEngine/context';
import { applyEligibilityGates } from '@/utils/routineEngine/eligibility';
import { buildShelfFacts } from '@/utils/routineEngine/productFacts';

const NOW = new Date('2026-07-04T12:00:00Z');

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Test',
    brand: null,
    productType: 'serum',
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both',
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
    ...overrides,
  };
}

function makeContext(procedures: UserProcedureLog[] = []) {
  return buildRoutineContext({
    procedures,
    profile: { fitzpatrick: null },
    seasonMask: { season: 'spring', source: 'calendar' },
    now: NOW,
  });
}

const PEEL: UserProcedureLog = {
  id: 'proc-1',
  procedureKey: 'chemical_peel_deep',
  datePerformed: '2026-07-04',
  status: 'rehab',
  deferralCount: 0,
};

function gate(products: Product[], procedures: UserProcedureLog[] = []) {
  return applyEligibilityGates(products, buildShelfFacts(products, NOW), makeContext(procedures));
}

describe('applyEligibilityGates', () => {
  it('passes an ordinary product through', () => {
    const result = gate([makeProduct()]);
    expect(result.eligible).toHaveLength(1);
    expect(result.rejections).toHaveLength(0);
  });

  it('rejects hidden products with the hidden gate', () => {
    const result = gate([makeProduct({ isHidden: true })]);
    expect(result.eligible).toHaveLength(0);
    expect(result.rejections).toEqual([
      { productId: 'p1', gate: 'hidden', reasonCode: 'product_hidden' },
    ]);
  });

  it('rejects PAO-expired products with the pao gate', () => {
    const result = gate([makeProduct({ openedDate: '2025-01-01', paoMonths: 6 })]);
    expect(result.rejections[0]).toEqual(
      expect.objectContaining({ gate: 'pao_expired' }),
    );
  });

  it('freezes exfoliating products during a peel rehab window, with the expiry date', () => {
    // AHA serum + deep peel performed today → frozen until day 14
    const result = gate([makeProduct({ activeTags: ['aha'] })], [PEEL]);
    expect(result.eligible).toHaveLength(0);
    expect(result.rejections[0]).toEqual({
      productId: 'p1',
      gate: 'clinical_freeze',
      reasonCode: 'peel_rehab_no_exfoliants',
      until: '2026-07-18',
    });
  });

  it('freezes aggressive classes (retinoid) during a peel via the class target', () => {
    const result = gate([makeProduct({ activeTags: ['retinoid'] })], [PEEL]);
    expect(result.rejections[0]).toEqual(
      expect.objectContaining({ gate: 'clinical_freeze', reasonCode: 'peel_rehab_no_aggressive_actives' }),
    );
  });

  it('does not freeze benign products during a peel', () => {
    const result = gate([makeProduct({ activeTags: ['hyaluronic_acid'] })], [PEEL]);
    expect(result.eligible).toHaveLength(1);
  });

  it('rejects products with no placeable period (pm-only active on a morning product)', () => {
    const result = gate([makeProduct({ activeTags: ['retinoid'], usageTime: 'morning' })]);
    expect(result.rejections[0]).toEqual(
      expect.objectContaining({ gate: 'no_allowed_period' }),
    );
  });

  it('reports exactly one gate per product in fixed precedence order', () => {
    // Hidden AND PAO-expired AND freezable → only the hidden gate fires
    const result = gate(
      [makeProduct({ isHidden: true, openedDate: '2025-01-01', paoMonths: 6, activeTags: ['aha'] })],
      [PEEL],
    );
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0].gate).toBe('hidden');
  });
});
