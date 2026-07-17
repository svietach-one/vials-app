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
  // Since phase-02 (2026-07-17) every collection also contains the base
  // spf_photosensitizing mandate — it is unconditional by design, so these
  // assert membership rather than the exact array.
  it('collects the clinical SPF mandate during peel rehab', () => {
    const mandates = collectRequireMandates(makeContext({ procedures: [PEEL] }));
    expect(mandates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ period: 'am', reasonCode: 'peel_spf_mandatory', nonSkippable: false }),
      ]),
    );
    expect(mandates.filter((m) => m.reasonCode !== 'spf_required_photosensitizing')).toHaveLength(1);
  });

  it('collects the phototype 1–2 mandate as non-skippable with its condition', () => {
    const mandates = collectRequireMandates(makeContext({ fitzpatrick: 2 }));
    expect(mandates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nonSkippable: true,
          planContainsProperty: 'photosensitizing',
          reasonCode: 'phototype_uv_sensitivity_spf',
        }),
      ]),
    );
    expect(mandates.filter((m) => m.reasonCode !== 'spf_required_photosensitizing')).toHaveLength(1);
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
    // 3 since phase-02: summer + phototype + the base spf_photosensitizing
    // mandate all fire and log individually; the placeholder still merges to 1.
    expect(result.decisions.filter((d) => d.action === 'placeholder')).toHaveLength(3);
  });
});

describe('base mandates — spf_photosensitizing (spec phase-02 §2.1)', () => {
  it('collects the base SPF mandate for every context, with its condition', () => {
    // The whole point of the widening: no phototype, no season, no procedure —
    // winter + phototype 4 was the gap that motivated the rule.
    const mandates = collectRequireMandates(makeContext({ season: 'winter', fitzpatrick: 4 }));
    const base = mandates.find((m) => m.reasonCode === 'spf_required_photosensitizing');

    expect(base).toBeDefined();
    expect(base?.period).toBe('am');
    expect(base?.severity).toBe('avoid');
    expect(base?.nonSkippable).toBe(false);
    expect(base?.planContainsProperty).toBe('photosensitizing');
  });

  it('adds an AM SPF placeholder for a phototype-4 user with a retinoid in winter', () => {
    // Fails before this phase: the SPF mandate was gated behind phototype 1–2
    // or summer, so this exact user got no placeholder.
    const retinoid = makeProduct({ activeTags: ['retinoid'], usageTime: 'evening' });
    const facts = buildShelfFacts([retinoid], NOW);
    const result = applyMandates(
      { am: [], pm: [makeStep(retinoid)] },
      facts,
      makeContext({ season: 'winter', fitzpatrick: 4 }),
    );

    expect(result.placeholders).toEqual([
      expect.objectContaining({
        period: 'am',
        productTypes: ['spf'],
        reasonCode: 'spf_required_photosensitizing',
        severity: 'avoid',
        nonSkippable: false,
      }),
    ]);
  });

  it('adds no placeholder for a phototype-5 user with no photosensitizing actives', () => {
    // Mandate no, recommendation maybe — a shelf of hydrators triggers nothing.
    const hydrator = makeProduct({ activeTags: ['hyaluronic_acid'] });
    const facts = buildShelfFacts([hydrator], NOW);
    const result = applyMandates(
      { am: [makeStep(hydrator)], pm: [] },
      facts,
      makeContext({ season: 'winter', fitzpatrick: 5 }),
    );

    expect(result.placeholders).toEqual([]);
  });

  it('is satisfied by an SPF step already in AM — no placeholder', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'], usageTime: 'evening' });
    const spf = makeProduct({ id: 'p2', productType: 'spf', usageTime: 'morning' });
    const facts = buildShelfFacts([retinoid, spf], NOW);
    const result = applyMandates(
      { am: [makeStep(spf)], pm: [makeStep(retinoid)] },
      facts,
      makeContext({ season: 'winter', fitzpatrick: 4 }),
    );

    expect(result.placeholders).toEqual([]);
  });

  it('merges with the phototype 1–2 mandate into one AM placeholder, nonSkippable winning', () => {
    // No regression from the widening: the phototype user keeps their original
    // reasonCode (first mandate in fold order names the merged slot) and the
    // strictest flags survive the merge.
    const retinoid = makeProduct({ activeTags: ['retinoid'], usageTime: 'evening' });
    const facts = buildShelfFacts([retinoid], NOW);
    const result = applyMandates(
      { am: [], pm: [makeStep(retinoid)] },
      facts,
      makeContext({ season: 'winter', fitzpatrick: 2 }),
    );

    expect(result.placeholders).toHaveLength(1);
    expect(result.placeholders[0]).toEqual(
      expect.objectContaining({
        period: 'am',
        reasonCode: 'phototype_uv_sensitivity_spf',
        nonSkippable: true,
        severity: 'avoid',
      }),
    );
    // Both mandates still individually logged their placeholder decision.
    expect(
      result.decisions.filter((d) => d.action === 'placeholder').map((d) => d.reasonCode),
    ).toEqual(
      expect.arrayContaining(['phototype_uv_sensitivity_spf', 'spf_required_photosensitizing']),
    );
  });

  it('merges with the summer mandate without duplicating the AM slot', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'], usageTime: 'evening' });
    const facts = buildShelfFacts([retinoid], NOW);
    const result = applyMandates(
      { am: [], pm: [makeStep(retinoid)] },
      facts,
      makeContext({ season: 'summer', fitzpatrick: 3 }),
    );

    expect(result.placeholders).toHaveLength(1);
    expect(result.placeholders[0].period).toBe('am');
    expect(result.placeholders[0].severity).toBe('avoid');
  });
});

describe('goal-conditioned mandates — spf_required_goal (phase-03 §3.3)', () => {
  const goalContext = (primary: 'pigmentation' | 'maintenance', secondary: 'pigmentation' | null = null) =>
    buildRoutineContext({
      procedures: [],
      profile: { fitzpatrick: null, primaryGoal: primary, secondaryGoal: secondary },
      seasonMask: { season: 'winter', source: 'calendar' },
      now: NOW,
    });

  it('collects the goal SPF mandate for a pigmentation primary goal', () => {
    const mandates = collectRequireMandates(goalContext('pigmentation'));
    const goal = mandates.find((m) => m.reasonCode === 'spf_required_goal');
    expect(goal).toBeDefined();
    expect(goal?.period).toBe('am');
    expect(goal?.severity).toBe('caution');
    // No planContainsProperty — the goal alone is the condition
    expect(goal?.planContainsProperty).toBeUndefined();
  });

  it('collects it when pigmentation is the secondary goal', () => {
    const mandates = collectRequireMandates(goalContext('maintenance', 'pigmentation'));
    expect(mandates.some((m) => m.reasonCode === 'spf_required_goal')).toBe(true);
  });

  it('does not collect it for a maintenance profile', () => {
    const mandates = collectRequireMandates(goalContext('maintenance'));
    expect(mandates.some((m) => m.reasonCode === 'spf_required_goal')).toBe(false);
  });

  it('renders an AM SPF placeholder for a pigmentation goal with no SPF and no actives', () => {
    // The trigger phase-02 deferred: no photosensitizer anywhere, winter,
    // baseline phototype — the goal alone mandates SPF.
    const hydrator = makeProduct({ activeTags: ['hyaluronic_acid'] });
    const facts = buildShelfFacts([hydrator], NOW);
    const result = applyMandates(
      { am: [makeStep(hydrator)], pm: [] },
      facts,
      goalContext('pigmentation'),
    );
    expect(result.placeholders).toEqual([
      expect.objectContaining({
        period: 'am',
        productTypes: ['spf'],
        reasonCode: 'spf_required_goal',
        severity: 'caution',
      }),
    ]);
  });
});
