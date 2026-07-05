import type { Product, UserProcedureLog } from '@/types';
import { buildRoutineContext } from '@/utils/routineEngine/context';
import {
  applyMandates,
  collectLimits,
  collectPrioritizeTargets,
  collectRequireMandates,
} from '@/utils/routineEngine/mandates';
import type { PlannedStep } from '@/utils/routineEngine/planTypes';
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

function makeContext(
  options: {
    procedures?: UserProcedureLog[];
    season?: 'winter' | 'spring' | 'summer' | 'autumn';
    fitzpatrick?: 1 | 2 | 3 | 4 | 5 | 6 | null;
  } = {},
) {
  return buildRoutineContext({
    procedures: options.procedures ?? [],
    profile: { fitzpatrick: options.fitzpatrick ?? null },
    seasonMask: { season: options.season ?? 'spring', source: 'calendar' },
    now: NOW,
  });
}

function makeStep(product: Product): PlannedStep {
  return {
    productId: product.id,
    productType: product.productType,
    scheduledDays: [],
    slotIndex: 0,
    score: 0,
    addedAt: product.addedAt,
  };
}

const PEEL: UserProcedureLog = {
  id: 'proc-1',
  procedureKey: 'chemical_peel_deep',
  datePerformed: '2026-07-04',
  status: 'rehab',
  deferralCount: 0,
};

describe('collectLimits', () => {
  it('collects the seasonal exfoliant limit in summer', () => {
    const limits = collectLimits(makeContext({ season: 'summer' }));
    expect(limits).toEqual([
      expect.objectContaining({ maxDaysPerWeek: 1, reasonCode: 'summer_uv_exfoliant_limit' }),
    ]);
  });

  it('collects the phototype exfoliant cap for high-melanin types', () => {
    const limits = collectLimits(makeContext({ fitzpatrick: 5 }));
    expect(limits).toEqual([
      expect.objectContaining({ reasonCode: 'phototype_pih_exfoliant_cap' }),
    ]);
  });

  it('collects nothing in spring with a baseline phototype', () => {
    expect(collectLimits(makeContext())).toHaveLength(0);
  });
});

describe('collectPrioritizeTargets', () => {
  it('collects the clinical barrier-repair prioritize during peel rehab', () => {
    const targets = collectPrioritizeTargets(makeContext({ procedures: [PEEL] }));
    expect(targets).toEqual([
      expect.objectContaining({ reasonCode: 'peel_sos_recovery' }),
    ]);
  });

  it('collects the winter barrier prioritize scoped to pm', () => {
    const targets = collectPrioritizeTargets(makeContext({ season: 'winter' }));
    expect(targets).toEqual([
      expect.objectContaining({ reasonCode: 'winter_barrier_repair', period: 'pm' }),
    ]);
  });
});

describe('collectRequireMandates', () => {
  it('collects the clinical SPF mandate during peel rehab', () => {
    const mandates = collectRequireMandates(makeContext({ procedures: [PEEL] }));
    expect(mandates).toEqual([
      expect.objectContaining({ period: 'am', reasonCode: 'peel_spf_mandatory', nonSkippable: false }),
    ]);
  });

  it('collects the phototype 1–2 mandate as non-skippable with its condition', () => {
    const mandates = collectRequireMandates(makeContext({ fitzpatrick: 2 }));
    expect(mandates).toEqual([
      expect.objectContaining({
        nonSkippable: true,
        planContainsProperty: 'photosensitizing',
        reasonCode: 'phototype_uv_sensitivity_spf',
      }),
    ]);
  });
});

describe('applyMandates', () => {
  it('adds an SPF placeholder when a peel mandates SPF and the plan has none', () => {
    const serum = makeProduct();
    const facts = buildShelfFacts([serum], NOW);
    const result = applyMandates(
      { am: [makeStep(serum)], pm: [] },
      facts,
      makeContext({ procedures: [PEEL] }),
    );
    expect(result.placeholders).toEqual([
      {
        period: 'am',
        productTypes: ['spf'],
        reasonCode: 'peel_spf_mandatory',
        nonSkippable: false,
        severity: 'caution',
      },
    ]);
  });

  it('adds no placeholder when an SPF step satisfies the mandate', () => {
    const spf = makeProduct({ id: 'spf-1', productType: 'spf' });
    const facts = buildShelfFacts([spf], NOW);
    const result = applyMandates(
      { am: [makeStep(spf)], pm: [] },
      facts,
      makeContext({ procedures: [PEEL] }),
    );
    expect(result.placeholders).toHaveLength(0);
  });

  it('triggers the summer SPF mandate only when the plan contains a photosensitizer', () => {
    const retinoid = makeProduct({ id: 'ret', activeTags: ['retinoid'] });
    const plain = makeProduct({ id: 'plain' });
    const facts = buildShelfFacts([retinoid, plain], NOW);

    const withPhotosensitizer = applyMandates(
      { am: [], pm: [makeStep(retinoid)] },
      facts,
      makeContext({ season: 'summer' }),
    );
    expect(withPhotosensitizer.placeholders).toEqual([
      expect.objectContaining({ period: 'am', reasonCode: 'summer_photosensitizer_spf' }),
    ]);

    const without = applyMandates(
      { am: [], pm: [makeStep(plain)] },
      facts,
      makeContext({ season: 'summer' }),
    );
    expect(without.placeholders).toHaveLength(0);
  });

  it('merges concurrent mandates into one placeholder per period, nonSkippable winning', () => {
    // Summer + phototype 2 + photosensitizer in plan → two am SPF mandates
    const retinoid = makeProduct({ id: 'ret', activeTags: ['retinoid'] });
    const facts = buildShelfFacts([retinoid], NOW);
    const result = applyMandates(
      { am: [], pm: [makeStep(retinoid)] },
      facts,
      makeContext({ season: 'summer', fitzpatrick: 2 }),
    );
    expect(result.placeholders).toHaveLength(1);
    expect(result.placeholders[0].nonSkippable).toBe(true);
    expect(result.decisions.filter((d) => d.action === 'placeholder')).toHaveLength(2);
  });
});
