/**
 * Engine-level integration: what the single routine puts in the plan.
 * Spec: docs/specs/intermediate-routine.md Story 1, G2 (APPROVED 2026-10-15).
 * There is no routine style: every test runs against the one engine.
 */
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  buildPromotionShapedShelf,
  buildSweepShelf,
  gapKeys,
  ids,
  makeEngineInput,
  makeR9,
  makeS3,
  R9,
  reserveIds,
  resetFixtureCounters,
  S3,
  shelfProduct,
  stepFor,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('R9 reference shelf (Story 1 AC1, G2)', () => {
  it('builds morning foam, toner, eye cream, cream, SPF and evening micellar, foam, toner, eye cream, cream, with essence, oil and ampoule in reserve and no gap cards', () => {
    const plan = generatePlan(makeEngineInput(makeR9()));

    expect(ids(plan.periods.morning)).toEqual([R9.foam, R9.toner, R9.eye, R9.cream, R9.spf]);
    expect(ids(plan.periods.evening)).toEqual([R9.micellar, R9.foam, R9.toner, R9.eye, R9.cream]);
    expect(reserveIds(plan)).toEqual([R9.essence, R9.oil, R9.ampoule].sort());
    expect(plan.placeholders).toEqual([]);
  });

  it('keeps essence, oil and ampoule under the existing "not needed" reason', () => {
    const plan = generatePlan(makeEngineInput(makeR9()));

    const reasons = Object.fromEntries(plan.reserve.map((r) => [r.productId, r.reasonCode]));
    expect(reasons[R9.essence]).toBe('not_needed_for_goals');
    expect(reasons[R9.oil]).toBe('not_needed_for_goals');
    expect(reasons[R9.ampoule]).toBe('not_needed_for_goals');
  });
});

describe('toner and eye cream scheduling (Story 1)', () => {
  it('places an evening-only toner in the evening only', () => {
    const products = [...makeS3(), shelfProduct('t-pm', 'Night Toner', 'toner', { usageTime: 'evening' })];

    const plan = generatePlan(makeEngineInput(products));

    expect(ids(plan.periods.evening)).toContain('t-pm');
    expect(ids(plan.periods.morning)).not.toContain('t-pm');
  });

  it('schedules one of two toners per period and offers the other as a swap, never both in one period', () => {
    const products = [
      ...makeS3(),
      shelfProduct('t-a', 'Toner A', 'toner', { addedAt: '2026-02-01' }),
      shelfProduct('t-b', 'Toner B', 'toner', { addedAt: '2026-03-01' }),
    ];

    const plan = generatePlan(makeEngineInput(products));

    for (const period of ['morning', 'evening'] as const) {
      const toners = ids(plan.periods[period]).filter((id) => id === 't-a' || id === 't-b');
      expect(toners).toHaveLength(1);
      const loser = toners[0] === 't-a' ? 't-b' : 't-a';
      const offered = (plan.slotAlternatives ?? [])
        .filter((a) => a.period === period)
        .flatMap((a) => a.alternatives.map((s) => s.productId));
      expect(offered).toContain(loser);
    }
  });

  it('does not count a toner carrying a strong acid as the toner step, and files it as a treatment', () => {
    const acidToner = shelfProduct('t-acid', 'Acid Toner', 'toner', { activeTags: ['aha'] });
    const profile = { fitzpatrick: null, concerns: [], primaryGoal: 'acne' as const, secondaryGoal: null };

    const plan = generatePlan(makeEngineInput([...makeS3(), acidToner], { profile }));

    expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:toner', 'pm:toner']));
    expect(ids(plan.periods.morning)).not.toContain('t-acid');
    expect(stepFor(plan, 't-acid', 'evening')).toBeDefined();
  });

  it('keeps the moisturiser gap when the only "moisturiser" is an eye cream, while the eye cream fills its own slot', () => {
    const products = [
      shelfProduct('c', 'Cleanser', 'cleanser'),
      shelfProduct('e', 'Eye Cream', 'eye_cream'),
      shelfProduct('s', 'SPF', 'spf'),
    ];

    const plan = generatePlan(makeEngineInput(products));

    expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:moisturizer', 'pm:moisturizer']));
    expect(ids(plan.periods.morning)).toContain('e');
    expect(gapKeys(plan)).not.toContain('am:eye_cream');
  });
});

describe('a swap never offers a product that is already scheduled (Story 1 AC3)', () => {
  // The planner found (and the owner ruled 2026-10-15 to FIX) that the engine can list a slot's
  // own current product among that slot's alternatives, making "Change" a no-op: 28 of 1092
  // alternatives on a 600-shelf probe of today's engine. This test fails until the root cause is fixed.
  it('holds for every alternative in every period over 600 shelves', () => {
    const offences: string[] = [];
    let alternativesSeen = 0;
    const shelves = [
      ...Array.from({ length: 300 }, (_, seed) => buildSweepShelf(seed, { salt: 8 }).input),
      ...Array.from({ length: 300 }, (_, seed) => buildPromotionShapedShelf(seed).input),
    ];

    shelves.forEach((input, n) => {
      const plan = generatePlan(input);
      for (const entry of plan.slotAlternatives ?? []) {
        const scheduled = ids(plan.periods[entry.period]);
        for (const alt of entry.alternatives) {
          alternativesSeen += 1;
          if (scheduled.includes(alt.productId)) offences.push(`shelf ${n}: ${alt.productId} offered but already in ${entry.period}`);
        }
      }
    });

    expect(alternativesSeen).toBeGreaterThan(300);
    expect(offences).toEqual([]);
  });
});

describe('balms and the moisturiser slot', () => {
  const base = () => [shelfProduct('c', 'Cleanser', 'cleanser'), shelfProduct('s', 'SPF', 'spf')];

  it('lets a face balm fill the moisturiser slot, so no moisturiser gap is raised', () => {
    const plan = generatePlan(makeEngineInput([...base(), shelfProduct('b', 'Barrier Balm', 'balm')]));

    expect(ids(plan.periods.morning)).toContain('b');
    expect(ids(plan.periods.evening)).toContain('b');
    expect(gapKeys(plan)).not.toContain('am:moisturizer');
    expect(gapKeys(plan)).not.toContain('pm:moisturizer');
  });

  it('never schedules a lip balm or a hair balm as a face step and still raises the moisturiser gap', () => {
    const products = [...base(), shelfProduct('lip', 'Lip Balm', 'balm'), shelfProduct('hair', 'Hair Balm', 'balm')];

    const plan = generatePlan(makeEngineInput(products));

    const scheduled = [...ids(plan.periods.morning), ...ids(plan.periods.evening)];
    expect(scheduled).not.toContain('lip');
    expect(scheduled).not.toContain('hair');
    expect(reserveIds(plan)).toEqual(expect.arrayContaining(['hair', 'lip']));
    expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:moisturizer', 'pm:moisturizer']));
  });

  it('routes a "Cleansing Balm" typed balm to the evening pre-cleanse step, not the moisturiser slot', () => {
    const plan = generatePlan(makeEngineInput([...base(), shelfProduct('cb', 'Cleansing Balm', 'balm')]));

    expect(ids(plan.periods.morning)).not.toContain('cb');
    expect(stepFor(plan, 'cb', 'evening')?.productType).toBe('makeup_remover');
    expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:moisturizer', 'pm:moisturizer']));
  });
});

describe('S3 sparse shelf', () => {
  it('keeps its three core steps and nothing else', () => {
    const plan = generatePlan(makeEngineInput(makeS3()));

    expect(ids(plan.periods.morning)).toEqual([S3.cleanser, S3.cream, S3.spf]);
    expect(ids(plan.periods.evening)).toEqual([S3.cleanser, S3.cream]);
  });
});
