/**
 * "Not silent", direction 1: a step the routine calls for but the shelf cannot
 * fill raises a per-period gap placeholder (rendered by the existing GapCard).
 * Spec Story 2, G3, the §5 gap-card rules (APPROVED 2026-10-15).
 */
import type { ProductType } from '@/types';
import { generatePlan } from '@/utils/routineEngine/generate';
import { getSlotIndex } from '@/utils/routineEngine/slotting';
import {
  buildSweepShelf,
  gapKeys,
  makeEngineInput,
  makeS3,
  REASON,
  resetFixtureCounters,
  shelfProduct,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('the routine raises toner and eye-cream gaps for both periods (Story 2 AC1)', () => {
  it('on the sparse shelf S3 raises exactly those four gaps', () => {
    const plan = generatePlan(makeEngineInput(makeS3()));

    expect([...gapKeys(plan)].sort()).toEqual(['am:eye_cream', 'am:toner', 'pm:eye_cream', 'pm:toner']);
  });

  it('uses dedicated reason codes for the new gaps, so the card can say why', () => {
    const plan = generatePlan(makeEngineInput(makeS3()));

    const byKey = Object.fromEntries(plan.placeholders.map((p) => [`${p.period}:${p.productTypes[0]}`, p]));
    expect(byKey['am:toner'].reasonCode).toBe(REASON('toner_recommended'));
    expect(byKey['am:eye_cream'].reasonCode).toBe(REASON('eye_cream_recommended'));
    expect(byKey['pm:toner'].nonSkippable).toBe(false);
  });

  it('raises only the morning toner gap when the shelf owns an evening-only toner', () => {
    const products = [...makeS3(), shelfProduct('t-pm', 'Night Toner', 'toner', { usageTime: 'evening' })];

    const plan = generatePlan(makeEngineInput(products));

    expect(gapKeys(plan)).toContain('am:toner');
    expect(gapKeys(plan)).not.toContain('pm:toner');
  });

  it('drops both toner gaps once a toner joins the shelf and keeps the eye-cream gaps', () => {
    const after = generatePlan(makeEngineInput([...makeS3(), shelfProduct('t', 'Toner', 'toner')]));

    expect(gapKeys(after)).not.toContain('am:toner');
    expect(gapKeys(after)).not.toContain('pm:toner');
    expect(gapKeys(after)).toEqual(expect.arrayContaining(['am:eye_cream', 'pm:eye_cream']));
  });

  it('never asks for an exfoliant or a makeup remover', () => {
    const types = generatePlan(makeEngineInput([])).placeholders.map((p) => p.productTypes[0]);

    expect(types).not.toContain('peeling');
    expect(types).not.toContain('makeup_remover');
  });

  it('does not count a hidden toner, so the toner gaps remain', () => {
    const products = [...makeS3(), shelfProduct('t', 'Hidden Toner', 'toner', { isHidden: true })];

    expect(gapKeys(generatePlan(makeEngineInput(products)))).toEqual(expect.arrayContaining(['am:toner', 'pm:toner']));
  });
});

describe('gap-only groups read in build order, not rule-firing order', () => {
  it('lists an empty shelf\'s gaps cleanse -> tone -> eye -> moisturise -> protect, morning before evening', () => {
    const plan = generatePlan(makeEngineInput([]));

    expect(gapKeys(plan)).toEqual([
      'am:cleanser', 'am:toner', 'am:eye_cream', 'am:moisturizer', 'am:spf',
      'pm:cleanser', 'pm:toner', 'pm:eye_cream', 'pm:moisturizer',
    ]);
  });
});

describe('placeholder precedence by (period, productType): mandate > pre-cleanse follow-up > generic gap', () => {
  it('a pigmentation goal with no SPF yields ONE spf placeholder carrying the mandate reason', () => {
    const products = [shelfProduct('c', 'Cleanser', 'cleanser'), shelfProduct('m', 'Cream', 'moisturizer')];

    const plan = generatePlan(
      makeEngineInput(products, { profile: { fitzpatrick: null, concerns: [], primaryGoal: 'pigmentation', secondaryGoal: null } }),
    );

    const spf = plan.placeholders.filter((p) => p.period === 'am' && p.productTypes.includes('spf'));
    expect(spf).toHaveLength(1);
    expect(spf[0].reasonCode).toBe('spf_required_goal');
    expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:toner']));
  });

  it('a micellar water with no cleanser yields ONE evening cleanser placeholder with the follow-up reason', () => {
    const products = [
      shelfProduct('mw', 'Micellar Water', 'makeup_remover'),
      shelfProduct('m', 'Cream', 'moisturizer'),
      shelfProduct('s', 'SPF', 'spf'),
    ];

    const plan = generatePlan(makeEngineInput(products));

    const pm = plan.placeholders.filter((p) => p.period === 'pm' && p.productTypes.includes('cleanser'));
    expect(pm).toHaveLength(1);
    expect(pm[0].reasonCode).toBe('pre_cleanse_requires_followup');
  });
});

describe('gap-card bounds over 400 seeded shelves', () => {
  const ALLOWED: ProductType[] = ['cleanser', 'moisturizer', 'spf', 'toner', 'eye_cream'];

  it('keeps morning <= 5 and evening <= 4, unique (period,type) keys, allowed types, build order', () => {
    const offences: string[] = [];
    let maxMorning = 0;
    let maxEvening = 0;
    let seedsWithTonerGap = 0;
    for (let seed = 0; seed < 400; seed += 1) {
      const plan = generatePlan(buildSweepShelf(seed, { salt: 2 }).input);
      const am = plan.placeholders.filter((p) => p.period === 'am');
      const pm = plan.placeholders.filter((p) => p.period === 'pm');
      maxMorning = Math.max(maxMorning, am.length);
      maxEvening = Math.max(maxEvening, pm.length);
      if (plan.placeholders.some((p) => p.productTypes[0] === 'toner')) seedsWithTonerGap += 1;

      const keys = plan.placeholders.map((p) => `${p.period}|${[...p.productTypes].sort().join(',')}`);
      if (new Set(keys).size !== keys.length) offences.push(`seed ${seed}: duplicate (period,type) placeholder`);
      for (const p of plan.placeholders) {
        if (p.productTypes.some((t) => !ALLOWED.includes(t))) offences.push(`seed ${seed}: ${p.period}:${p.productTypes.join(',')} is not a gap type`);
      }
      for (const group of [am, pm]) {
        const idx = group.map((p) => getSlotIndex(p.productTypes[0]));
        if (idx.some((v, i) => i > 0 && v < idx[i - 1])) offences.push(`seed ${seed}: gaps out of build order`);
      }
    }

    expect(offences).toEqual([]);
    expect(seedsWithTonerGap).toBeGreaterThan(100); // non-vacuity
    expect(maxMorning).toBeLessThanOrEqual(5);
    expect(maxEvening).toBeLessThanOrEqual(4);
  });
});
