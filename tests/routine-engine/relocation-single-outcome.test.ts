/**
 * One terminal outcome per product per period (intermediate-routine FE-13).
 *
 * A product relocated by a `separate_periods` pair rule used to be attempted a
 * second time in the target period (AM → PM joined a twin to a pool the product
 * was already in; PM → AM re-ran it against an AM it had already been through).
 * Symptoms measured on a 6,000-shelf corpus: a product offered as its own
 * "Change" alternative, the same alternative listed twice, a product scheduled
 * twice in one period (a duplicate step id on save), and "frozen in a period in
 * which it is also scheduled".
 *
 * The repros are shrunk from failing seeded shelves, built through generatePlan
 * so the skeleton's pools are exactly what production sees.
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
const PERIOD_KEY = { am: 'morning', pm: 'evening' } as const;

/** Every violation of the one-outcome rule in a plan, as readable strings. */
function singleOutcomeViolations(plan: RoutinePlan): string[] {
  const out: string[] = [];
  for (const period of ['morning', 'evening'] as const) {
    const scheduled = ids(plan.periods[period]);
    if (new Set(scheduled).size !== scheduled.length) out.push(`${period}: a product is scheduled twice`);
    const offered = new Set<string>();
    for (const entry of plan.slotAlternatives ?? []) {
      if (entry.period !== period) continue;
      for (const alt of entry.alternatives) {
        if (scheduled.includes(alt.productId)) out.push(`${period}: ${alt.productId} is offered while scheduled`);
        if (offered.has(alt.productId)) out.push(`${period}: ${alt.productId} is offered twice`);
        offered.add(alt.productId);
      }
    }
  }
  for (const d of plan.decisions) {
    if (d.action !== 'freeze' || !d.period || !d.productId) continue;
    if (ids(plan.periods[PERIOD_KEY[d.period]]).includes(d.productId)) {
      out.push(`${d.productId} is frozen in ${d.period} and scheduled there`);
    }
  }
  return out;
}

describe('a relocated product has one outcome in the period it relocates to', () => {
  it('does not schedule a product twice in the evening (AM → PM relocation, repro of a failing shelf)', () => {
    const products = [
      makeProduct({ id: 'mw', productType: 'makeup_remover', addedAt: '2026-04-07' }),
      makeProduct({ id: 'plain', productType: 'cleanser', addedAt: '2026-04-26' }),
      makeProduct({ id: 'pha-cu', productType: 'cleanser', activeTags: ['pha', 'copper_peptides'], addedAt: '2026-02-03' }),
      makeProduct({ id: 'vitc-bp', productType: 'cleanser', activeTags: ['vitamin_c_pure', 'benzoyl_peroxide'], addedAt: '2026-06-26' }),
      makeProduct({ id: 'gel', productType: 'gel', usageTime: 'evening', addedAt: '2026-03-09' }),
      makeProduct({ id: 'serum', productType: 'serum', usageTime: 'evening', addedAt: '2026-05-04' }),
      makeProduct({ id: 'lotion', productType: 'lotion', activeTags: ['niacinamide'], addedAt: '2026-05-25' }),
    ];

    const plan = generatePlan(
      makeEngineInput(products, {
        profile: { fitzpatrick: 1, concerns: [], primaryGoal: 'pigmentation', secondaryGoal: null },
        seasonMask: makeSeasonMask('winter'),
      }),
    );

    expect(singleOutcomeViolations(plan)).toEqual([]);
  });

  it('never reports a product frozen in a period where it is also scheduled (PM → AM retry, repro of a failing shelf)', () => {
    const products = [
      makeProduct({ id: 'mw', productType: 'makeup_remover', addedAt: '2026-04-18' }),
      makeProduct({ id: 'vitc-cu', productType: 'cleanser', activeTags: ['vitamin_c_pure', 'copper_peptides'], addedAt: '2026-04-06' }),
      makeProduct({ id: 'panthenol', productType: 'cleanser', activeTags: ['panthenol'], addedAt: '2026-03-18' }),
      makeProduct({ id: 'toner', productType: 'toner', activeTags: ['ceramides'], usageTime: 'morning', addedAt: '2026-05-04' }),
      makeProduct({ id: 'bha-cu', productType: 'balm', activeTags: ['bha', 'copper_peptides'], addedAt: '2026-06-02' }),
      makeProduct({ id: 'cream', productType: 'cream', usageTime: 'morning', addedAt: '2026-04-15' }),
    ];

    const plan = generatePlan(
      makeEngineInput(products, {
        profile: { fitzpatrick: 6, concerns: [], primaryGoal: 'aging', secondaryGoal: null },
        seasonMask: makeSeasonMask('winter'),
      }),
    );

    expect(singleOutcomeViolations(plan)).toEqual([]);
  });

  it('accounts for the relocated product in some plan bucket (nothing vanishes)', () => {
    const products = [
      makeProduct({ id: 'lotion', productType: 'lotion', activeTags: ['copper_peptides'], addedAt: '2026-01-13' }),
      makeProduct({ id: 'balm-a', productType: 'balm', activeTags: ['vitamin_c_derivative', 'ceramides'], addedAt: '2026-04-07' }),
      makeProduct({ id: 'balm-b', productType: 'balm', activeTags: ['pha', 'cica'], usageTime: 'morning', addedAt: '2026-04-12' }),
    ];

    const plan = generatePlan(makeEngineInput(products, { profile: { fitzpatrick: 6, concerns: [] } }));

    const inBucket = new Set([
      ...ids(plan.periods.morning),
      ...ids(plan.periods.evening),
      ...plan.frozen.map((f) => f.productId),
      ...plan.reserve.map((r) => r.productId),
      ...(plan.slotAlternatives ?? []).flatMap((a) => a.alternatives.map((s) => s.productId)),
    ]);
    for (const p of products) expect(inBucket.has(p.id)).toBe(true);
    expect(singleOutcomeViolations(plan)).toEqual([]);
  });
});

describe('the one-outcome rule holds across seeded shelves', () => {
  const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;

  it('has no violation over 500 shelves, and the sweep really exercises relocations', () => {
    const offences: string[] = [];
    let relocations = 0;
    for (let seed = 0; seed < 500; seed += 1) {
      const rng = makeRng(seed * 23 + 11);
      const { products } = randomShelf(rng, 4 + Math.floor(rng() * 10));
      const plan = generatePlan(
        makeEngineInput(products, {
          profile: {
            fitzpatrick: randomFitzpatrick(rng),
            concerns: randomConcerns(rng),
            primaryGoal: randomGoal(rng),
            secondaryGoal: null,
          },
          seasonMask: makeSeasonMask(SEASONS[seed % SEASONS.length]),
        }),
      );
      relocations += plan.decisions.filter((d) => d.action === 'relocate').length;
      offences.push(...singleOutcomeViolations(plan).map((o) => `seed ${seed}: ${o}`));
    }

    expect(relocations).toBeGreaterThan(20); // non-vacuity guard
    expect(offences).toEqual([]);
  });
});
