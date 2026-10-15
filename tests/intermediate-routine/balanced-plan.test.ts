/**
 * Engine-level integration: what each routine style puts in the plan.
 * Spec: docs/specs/intermediate-routine.md Stories 2 and 4 (toner / eye cream
 * part), G2, G6. Written against a DRAFT spec.
 */
import { reasonText } from '@/constants/decisionReasons';
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  DEPTHS,
  gapKeys,
  ids,
  makeDepthInput,
  makeEngineInput,
  makeR9,
  makeS3,
  R9,
  REASON,
  reserveIds,
  resetFixtureCounters,
  S3,
  shelfProduct,
  stepFor,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('R9 reference shelf (spec G2, Story 2 AC1-2)', () => {
  it('Balanced: morning is foam, toner, eye cream, cream, SPF; evening adds micellar and drops SPF; reserve is essence, oil, ampoule; no gap cards', () => {
    const plan = generatePlan(makeDepthInput(makeR9(), 'balanced'));

    expect(ids(plan.periods.morning)).toEqual([R9.foam, R9.toner, R9.eye, R9.cream, R9.spf]);
    expect(ids(plan.periods.evening)).toEqual([R9.micellar, R9.foam, R9.toner, R9.eye, R9.cream]);
    expect(reserveIds(plan)).toEqual([R9.essence, R9.oil, R9.ampoule].sort());
    expect(plan.placeholders).toEqual([]);
  });

  it('Essential: today\'s minimal routine, with toner and eye cream in reserve under the style reason', () => {
    const plan = generatePlan(makeDepthInput(makeR9(), 'essential'));

    expect(ids(plan.periods.morning)).toEqual([R9.foam, R9.cream, R9.spf]);
    expect(ids(plan.periods.evening)).toEqual([R9.micellar, R9.foam, R9.cream]);
    const reasons = Object.fromEntries(plan.reserve.map((r) => [r.productId, r.reasonCode]));
    expect(reasons[R9.toner]).toBe(REASON('outside_routine_depth'));
    expect(reasons[R9.eye]).toBe(REASON('outside_routine_depth'));
    expect(plan.placeholders).toEqual([]);
  });

  it('shows the user the exact Essential reserve sentence from the spec', () => {
    expect(reasonText('outside_routine_depth')).toBe(
      'Not part of your Essential routine — switch to Balanced to include it.',
    );
  });

  it('keeps essence, oil and ampoule under their old reason at both styles (Balanced would not place them)', () => {
    for (const depth of DEPTHS) {
      const plan = generatePlan(makeDepthInput(makeR9(), depth));
      const reasons = Object.fromEntries(plan.reserve.map((r) => [r.productId, r.reasonCode]));
      expect(reasons[R9.essence]).toBe('not_needed_for_goals');
      expect(reasons[R9.oil]).toBe('not_needed_for_goals');
      expect(reasons[R9.ampoule]).toBe('not_needed_for_goals');
    }
  });

  it('treats an input with no depth as Balanced (the default style)', () => {
    const plan = generatePlan(makeEngineInput(makeR9()));

    expect(ids(plan.periods.morning)).toEqual([R9.foam, R9.toner, R9.eye, R9.cream, R9.spf]);
  });
});

describe('Balanced scheduling of toner and eye cream (Story 2)', () => {
  it('places an evening-only toner in the evening only', () => {
    const products = [...makeS3(), shelfProduct('t-pm', 'Night Toner', 'toner', { usageTime: 'evening' })];

    const plan = generatePlan(makeDepthInput(products, 'balanced'));

    expect(ids(plan.periods.evening)).toContain('t-pm');
    expect(ids(plan.periods.morning)).not.toContain('t-pm');
  });

  it('schedules one of two toners per period and offers the other as a swap, never both in one period', () => {
    const products = [
      ...makeS3(),
      shelfProduct('t-a', 'Toner A', 'toner', { addedAt: '2026-02-01' }),
      shelfProduct('t-b', 'Toner B', 'toner', { addedAt: '2026-03-01' }),
    ];

    const plan = generatePlan(makeDepthInput(products, 'balanced'));

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

  it('does not count a toner carrying a strong acid as the toner step, and schedules it exactly as Essential does', () => {
    const acidToner = shelfProduct('t-acid', 'Acid Toner', 'toner', { activeTags: ['aha'] });
    const products = [...makeS3(), acidToner];
    const profile = { fitzpatrick: null, concerns: [], primaryGoal: 'acne' as const, secondaryGoal: null };

    const balanced = generatePlan(makeDepthInput(products, 'balanced', { profile }));
    const essential = generatePlan(makeDepthInput(products, 'essential', { profile }));

    expect(gapKeys(balanced)).toEqual(expect.arrayContaining(['am:toner', 'pm:toner']));
    expect(ids(balanced.periods.morning)).not.toContain('t-acid');
    expect(stepFor(balanced, 't-acid', 'evening')).toBeDefined();
    expect(stepFor(balanced, 't-acid', 'evening')?.scheduledDays).toEqual(
      stepFor(essential, 't-acid', 'evening')?.scheduledDays,
    );
    expect(gapKeys(essential)).not.toContain('am:toner');
  });

  it('keeps the moisturiser gap when the only "moisturiser" is an eye cream, at both styles', () => {
    const products = [
      shelfProduct('c', 'Cleanser', 'cleanser'),
      shelfProduct('e', 'Eye Cream', 'eye_cream'),
      shelfProduct('s', 'SPF', 'spf'),
    ];

    for (const depth of DEPTHS) {
      const plan = generatePlan(makeDepthInput(products, depth));
      expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:moisturizer', 'pm:moisturizer']));
    }
  });

  it('places that eye cream in its own Balanced slot (no eye-cream gap) while the moisturiser gap stays', () => {
    const products = [
      shelfProduct('c', 'Cleanser', 'cleanser'),
      shelfProduct('e', 'Eye Cream', 'eye_cream'),
      shelfProduct('s', 'SPF', 'spf'),
    ];

    const balanced = generatePlan(makeDepthInput(products, 'balanced'));

    expect(ids(balanced.periods.morning)).toContain('e');
    expect(gapKeys(balanced)).not.toContain('am:eye_cream');
    expect(gapKeys(balanced)).toContain('am:moisturizer');
  });
});

describe.each(DEPTHS)('balms and the moisturiser slot (%s)', (depth) => {
  const base = () => [shelfProduct('c', 'Cleanser', 'cleanser'), shelfProduct('s', 'SPF', 'spf')];

  it('lets a face balm fill the moisturiser slot, so no moisturiser gap is raised', () => {
    const plan = generatePlan(makeDepthInput([...base(), shelfProduct('b', 'Barrier Balm', 'balm')], depth));

    expect(ids(plan.periods.morning)).toContain('b');
    expect(ids(plan.periods.evening)).toContain('b');
    expect(gapKeys(plan)).not.toContain('am:moisturizer');
    expect(gapKeys(plan)).not.toContain('pm:moisturizer');
  });

  it('never schedules a lip balm or a hair balm as a face step and still raises the moisturiser gap', () => {
    const products = [...base(), shelfProduct('lip', 'Lip Balm', 'balm'), shelfProduct('hair', 'Hair Balm', 'balm')];

    const plan = generatePlan(makeDepthInput(products, depth));

    const scheduled = [...ids(plan.periods.morning), ...ids(plan.periods.evening)];
    expect(scheduled).not.toContain('lip');
    expect(scheduled).not.toContain('hair');
    expect(reserveIds(plan)).toEqual(expect.arrayContaining(['hair', 'lip']));
    expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:moisturizer', 'pm:moisturizer']));
  });

  it('routes a "Cleansing Balm" typed balm to the evening pre-cleanse step, not the moisturiser slot', () => {
    const products = [...base(), shelfProduct('cb', 'Cleansing Balm', 'balm')];

    const plan = generatePlan(makeDepthInput(products, depth));

    expect(ids(plan.periods.morning)).not.toContain('cb');
    expect(stepFor(plan, 'cb', 'evening')?.productType).toBe('makeup_remover');
    expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:moisturizer', 'pm:moisturizer']));
  });
});

describe('S3 sanity: the sparse shelf keeps its three core steps at both styles', () => {
  it.each(DEPTHS)('%s schedules cleanser, cream and SPF in the morning', (depth) => {
    const plan = generatePlan(makeDepthInput(makeS3(), depth));

    expect(ids(plan.periods.morning)).toEqual([S3.cleanser, S3.cream, S3.spf]);
    expect(ids(plan.periods.evening)).toEqual([S3.cleanser, S3.cream]);
  });
});
