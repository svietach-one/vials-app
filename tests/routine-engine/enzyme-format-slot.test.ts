/**
 * An enzyme exfoliant sold in a format that shares a layering slot with a plain
 * product (a toner, a cream…) must not displace the user's own plain product
 * (intermediate-routine, tech-lead W1). The owner accepted that an enzyme
 * toner/cream LEAVES its format slot; she did not accept that it takes the plain
 * product's place or demotes it to a "Change" alternative.
 *
 * Expected, per spec Story 3: the plain product stays a daily step with no gap
 * card, and the enzyme product is the weekly exfoliate step (morning, <= 3 days).
 */
import { generatePlan, type RoutinePlan } from '@/utils/routineEngine/generate';
import {
  makeEngineInput,
  makeProduct,
  makeRng,
  makeSeasonMask,
  randomConcerns,
  randomFitzpatrick,
  randomGoal,
  randomShelf,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

const ids = (steps: { productId: string }[]) => steps.map((s) => s.productId);
const step = (plan: RoutinePlan, period: 'morning' | 'evening', id: string) =>
  plan.periods[period].find((s) => s.productId === id);
const gapKeys = (plan: RoutinePlan) => plan.placeholders.map((p) => `${p.period}:${p.productTypes[0]}`);
const days = (s: { scheduledDays: number[] } | undefined) => (s && s.scheduledDays.length === 0 ? 7 : s?.scheduledDays.length);

describe('an enzyme cream does not displace the plain moisturiser', () => {
  it('keeps the plain cream every day and schedules the enzyme cream as the weekly morning exfoliant', () => {
    const cleanser = makeProduct({ id: 'cleanser', productType: 'cleanser' });
    const plain = makeProduct({ id: 'plain-cream', productType: 'moisturizer', addedAt: '2026-01-01' });
    const enzyme = makeProduct({ id: 'enzyme-cream', productType: 'moisturizer', activeTags: ['enzyme_exfoliant'], addedAt: '2026-03-01' });
    const spf = makeProduct({ id: 'spf', productType: 'spf' });

    const plan = generatePlan(makeEngineInput([cleanser, plain, enzyme, spf]));

    expect(step(plan, 'morning', 'plain-cream')?.scheduledDays).toEqual([]);
    expect(step(plan, 'evening', 'plain-cream')?.scheduledDays).toEqual([]);
    expect(days(step(plan, 'morning', 'enzyme-cream'))).toBeLessThanOrEqual(3);
    expect(step(plan, 'morning', 'enzyme-cream')).toBeDefined();
    expect(step(plan, 'evening', 'enzyme-cream')).toBeUndefined();
    expect(gapKeys(plan)).not.toContain('am:moisturizer');
    expect(gapKeys(plan)).not.toContain('pm:moisturizer');
  });

  it('does not offer the plain cream as a "Change" alternative of the enzyme cream, nor the reverse', () => {
    const plain = makeProduct({ id: 'plain-cream', productType: 'moisturizer', addedAt: '2026-01-01' });
    const enzyme = makeProduct({ id: 'enzyme-cream', productType: 'moisturizer', activeTags: ['enzyme_exfoliant'], addedAt: '2026-03-01' });

    const plan = generatePlan(makeEngineInput([makeProduct({ id: 'c', productType: 'cleanser' }), plain, enzyme]));

    expect(plan.slotAlternatives ?? []).toEqual([]);
  });
});

describe('an enzyme toner does not displace the plain toner', () => {
  it('schedules the plain toner daily and the enzyme toner weekly even when the enzyme toner is the OLDER product', () => {
    const cleanser = makeProduct({ id: 'cleanser', productType: 'cleanser' });
    const enzyme = makeProduct({ id: 'enzyme-toner', productType: 'toner', activeTags: ['enzyme_exfoliant'], addedAt: '2026-01-01' });
    const plain = makeProduct({ id: 'plain-toner', productType: 'toner', addedAt: '2026-03-01' });

    const plan = generatePlan(makeEngineInput([cleanser, enzyme, plain]));

    expect(step(plan, 'morning', 'plain-toner')?.scheduledDays).toEqual([]);
    expect(step(plan, 'evening', 'plain-toner')?.scheduledDays).toEqual([]);
    expect(step(plan, 'morning', 'enzyme-toner')).toBeDefined();
    expect(days(step(plan, 'morning', 'enzyme-toner'))).toBeLessThanOrEqual(3);
    expect(gapKeys(plan)).not.toContain('am:toner');
    expect(gapKeys(plan)).not.toContain('pm:toner');
  });

  it('raises the toner gap, not a phantom filled slot, when the enzyme toner is the only toner', () => {
    const plan = generatePlan(makeEngineInput([makeProduct({ id: 'c', productType: 'cleanser' }), makeProduct({ id: 'enzyme-toner', productType: 'toner', activeTags: ['enzyme_exfoliant'] })]));

    expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:toner', 'pm:toner']));
    expect(step(plan, 'morning', 'enzyme-toner')).toBeDefined();
  });
});

describe('enzyme-tagged products of every format stay accounted for and never share a slot with a plain product', () => {
  const FORMATS = ['toner', 'moisturizer', 'cream', 'lotion', 'serum', 'gel', 'essence', 'ampoule', 'mask', 'oil', 'balm', 'eye_cream', 'spf', 'peeling', 'cleanser', 'makeup_remover'] as const;

  it.each(FORMATS)('puts an enzyme %s in a plan bucket and, unless it is a makeup remover or SPF, never schedules it daily', (productType) => {
    const enzyme = makeProduct({ id: 'enzyme', productType, name: 'Enzyme Thing', activeTags: ['enzyme_exfoliant'] });
    const plan = generatePlan(makeEngineInput([makeProduct({ id: 'c', productType: 'cleanser' }), enzyme]));

    const inBucket =
      ids(plan.periods.morning).includes('enzyme') ||
      ids(plan.periods.evening).includes('enzyme') ||
      plan.reserve.some((r) => r.productId === 'enzyme') ||
      plan.frozen.some((f) => f.productId === 'enzyme') ||
      (plan.slotAlternatives ?? []).some((a) => a.alternatives.some((s) => s.productId === 'enzyme'));
    expect(inBucket).toBe(true);
    // A makeup remover and an SPF keep their function (they are not read as an exfoliant).
    if (productType !== 'makeup_remover' && productType !== 'spf') {
      for (const period of ['morning', 'evening'] as const) {
        const s = step(plan, period, 'enzyme');
        if (s) expect(s.scheduledDays.length === 0 ? 7 : s.scheduledDays.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('holds over 400 seeded shelves salted with enzyme-tagged products: one outcome each, a plain product is never an alternative of an enzyme product', () => {
    const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;
    const offences: string[] = [];
    let enzymeShelves = 0;
    for (let seed = 0; seed < 400; seed += 1) {
      const rng = makeRng(seed * 41 + 3);
      const { products, tagsById } = randomShelf(rng, 4 + Math.floor(rng() * 10));
      // Salt: tag a random third of the shelf's products as enzyme exfoliants.
      const salted = products.map((p) => (rng() < 0.33 ? { ...p, activeTags: [...(p.activeTags ?? []), 'enzyme_exfoliant' as const] } : p));
      if (salted.some((p) => p.activeTags?.includes('enzyme_exfoliant'))) enzymeShelves += 1;
      const plan = generatePlan(
        makeEngineInput(salted, {
          profile: { fitzpatrick: randomFitzpatrick(rng), concerns: randomConcerns(rng), primaryGoal: randomGoal(rng), secondaryGoal: null },
          seasonMask: makeSeasonMask(SEASONS[seed % SEASONS.length]),
        }),
      );
      void tagsById;
      const accounted = new Set([
        ...ids(plan.periods.morning), ...ids(plan.periods.evening),
        ...plan.frozen.map((f) => f.productId), ...plan.reserve.map((r) => r.productId),
        ...(plan.slotAlternatives ?? []).flatMap((a) => a.alternatives.map((s) => s.productId)),
      ]);
      for (const p of salted) if (!accounted.has(p.id)) offences.push(`seed ${seed}: ${p.id} unaccounted`);
      for (const period of ['morning', 'evening'] as const) {
        const scheduled = ids(plan.periods[period]);
        if (new Set(scheduled).size !== scheduled.length) offences.push(`seed ${seed}: ${period} schedules a product twice`);
        for (const entry of plan.slotAlternatives ?? []) {
          if (entry.period !== period) continue;
          for (const alt of entry.alternatives) if (scheduled.includes(alt.productId)) offences.push(`seed ${seed}: ${alt.productId} offered while scheduled`);
        }
      }
    }
    expect(enzymeShelves).toBeGreaterThan(300);
    expect(offences).toEqual([]);
  });
});
