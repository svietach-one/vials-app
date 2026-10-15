/**
 * "Not silent", direction 1: a step the style calls for but the shelf cannot
 * fill raises a per-period gap placeholder (rendered by the existing GapCard).
 * Spec Story 3, G3, the §5 gap-card table. Written against a DRAFT spec.
 */
import type { ProductType } from '@/types';
import { generatePlan } from '@/utils/routineEngine/generate';
import { getSlotIndex } from '@/utils/routineEngine/slotting';
import {
  buildSweepShelf,
  DEPTHS,
  gapKeys,
  makeDepthInput,
  makeS3,
  REASON,
  resetFixtureCounters,
  shelfProduct,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Balanced raises toner and eye-cream gaps for both periods (Story 3 AC1)', () => {
  it('on the sparse shelf S3 raises exactly the four Balanced gaps', () => {
    const plan = generatePlan(makeDepthInput(makeS3(), 'balanced'));

    expect([...gapKeys(plan)].sort()).toEqual(['am:eye_cream', 'am:toner', 'pm:eye_cream', 'pm:toner']);
  });

  it('on S3 raises none of the four at Essential', () => {
    const plan = generatePlan(makeDepthInput(makeS3(), 'essential'));

    expect(gapKeys(plan)).toEqual([]);
  });

  it('uses dedicated reason codes for the new gaps, so the card can say why', () => {
    const plan = generatePlan(makeDepthInput(makeS3(), 'balanced'));

    const byKey = Object.fromEntries(plan.placeholders.map((p) => [`${p.period}:${p.productTypes[0]}`, p]));
    expect(byKey['am:toner'].reasonCode).toBe(REASON('toner_recommended'));
    expect(byKey['am:eye_cream'].reasonCode).toBe(REASON('eye_cream_recommended'));
    expect(byKey['pm:toner'].nonSkippable).toBe(false);
  });

  it('raises only the morning toner gap when the shelf owns an evening-only toner', () => {
    const products = [...makeS3(), shelfProduct('t-pm', 'Night Toner', 'toner', { usageTime: 'evening' })];

    const plan = generatePlan(makeDepthInput(products, 'balanced'));

    expect(gapKeys(plan)).toContain('am:toner');
    expect(gapKeys(plan)).not.toContain('pm:toner');
  });

  it('drops both toner gaps once a toner joins the shelf', () => {
    const before = generatePlan(makeDepthInput(makeS3(), 'balanced'));
    const after = generatePlan(makeDepthInput([...makeS3(), shelfProduct('t', 'Toner', 'toner')], 'balanced'));

    expect(gapKeys(before)).toEqual(expect.arrayContaining(['am:toner', 'pm:toner']));
    expect(gapKeys(after)).not.toContain('am:toner');
    expect(gapKeys(after)).not.toContain('pm:toner');
    expect(gapKeys(after)).toEqual(expect.arrayContaining(['am:eye_cream', 'pm:eye_cream']));
  });

  it('never asks for an exfoliant or a makeup remover at either style', () => {
    for (const depth of DEPTHS) {
      const plan = generatePlan(makeDepthInput([], depth));
      const types = plan.placeholders.map((p) => p.productTypes[0]);
      expect(types).not.toContain('peeling');
      expect(types).not.toContain('makeup_remover');
    }
  });
});

describe('gap-only groups read in build order, not rule-firing order', () => {
  it('lists an empty shelf\'s Balanced gaps cleanse -> tone -> eye -> moisturise -> protect, morning before evening', () => {
    const plan = generatePlan(makeDepthInput([], 'balanced'));

    expect(gapKeys(plan)).toEqual([
      'am:cleanser', 'am:toner', 'am:eye_cream', 'am:moisturizer', 'am:spf',
      'pm:cleanser', 'pm:toner', 'pm:eye_cream', 'pm:moisturizer',
    ]);
  });

  it('lists an empty shelf\'s Essential gaps in the same build order', () => {
    const plan = generatePlan(makeDepthInput([], 'essential'));

    expect(gapKeys(plan)).toEqual(['am:cleanser', 'am:moisturizer', 'am:spf', 'pm:cleanser', 'pm:moisturizer']);
  });
});

describe('placeholder precedence by (period, productType): mandate > pre-cleanse follow-up > generic gap', () => {
  it.each(DEPTHS)('%s: a pigmentation goal with no SPF yields ONE spf placeholder carrying the mandate reason', (depth) => {
    const products = [shelfProduct('c', 'Cleanser', 'cleanser'), shelfProduct('m', 'Cream', 'moisturizer')];

    const plan = generatePlan(
      makeDepthInput(products, depth, {
        profile: { fitzpatrick: null, concerns: [], primaryGoal: 'pigmentation', secondaryGoal: null },
      }),
    );

    const spf = plan.placeholders.filter((p) => p.period === 'am' && p.productTypes.includes('spf'));
    expect(spf).toHaveLength(1);
    expect(spf[0].reasonCode).toBe('spf_required_goal');
  });

  it.each(DEPTHS)('%s: a micellar water with no cleanser yields ONE evening cleanser placeholder with the follow-up reason', (depth) => {
    const products = [
      shelfProduct('mw', 'Micellar Water', 'makeup_remover'),
      shelfProduct('m', 'Cream', 'moisturizer'),
      shelfProduct('s', 'SPF', 'spf'),
    ];

    const plan = generatePlan(makeDepthInput(products, depth));

    const pm = plan.placeholders.filter((p) => p.period === 'pm' && p.productTypes.includes('cleanser'));
    expect(pm).toHaveLength(1);
    expect(pm[0].reasonCode).toBe('pre_cleanse_requires_followup');
  });

  it('still lets the Balanced toner gap through next to a mandate-owned SPF gap', () => {
    const products = [shelfProduct('c', 'Cleanser', 'cleanser'), shelfProduct('m', 'Cream', 'moisturizer')];

    const plan = generatePlan(
      makeDepthInput(products, 'balanced', {
        profile: { fitzpatrick: null, concerns: [], primaryGoal: 'pigmentation', secondaryGoal: null },
      }),
    );

    expect(gapKeys(plan)).toEqual(expect.arrayContaining(['am:toner', 'am:spf']));
  });
});

describe('gap-card bounds over 400 seeded shelves', () => {
  const ALLOWED: Record<'essential' | 'balanced', ProductType[]> = {
    essential: ['cleanser', 'moisturizer', 'spf'],
    balanced: ['cleanser', 'moisturizer', 'spf', 'toner', 'eye_cream'],
  };

  it.each(DEPTHS)('%s: per-period count is bounded, keys are unique, types are allowed, order is build order', (depth) => {
    const offences: string[] = [];
    let maxMorning = 0;
    let maxEvening = 0;
    let seedsWithTonerGap = 0;
    for (let seed = 0; seed < 400; seed += 1) {
      const { input } = buildSweepShelf(seed, depth, { salt: 2 });
      const plan = generatePlan(input);
      const am = plan.placeholders.filter((p) => p.period === 'am');
      const pm = plan.placeholders.filter((p) => p.period === 'pm');
      maxMorning = Math.max(maxMorning, am.length);
      maxEvening = Math.max(maxEvening, pm.length);
      if (plan.placeholders.some((p) => p.productTypes[0] === 'toner')) seedsWithTonerGap += 1;

      const keys = plan.placeholders.map((p) => `${p.period}|${[...p.productTypes].sort().join(',')}`);
      if (new Set(keys).size !== keys.length) offences.push(`seed ${seed}: duplicate (period,type) placeholder`);
      for (const p of plan.placeholders) {
        if (p.productTypes.some((t) => !ALLOWED[depth].includes(t))) {
          offences.push(`seed ${seed}: ${p.period}:${p.productTypes.join(',')} is not a ${depth} gap type`);
        }
      }
      for (const group of [am, pm]) {
        const idx = group.map((p) => getSlotIndex(p.productTypes[0]));
        if (idx.some((v, i) => i > 0 && v < idx[i - 1])) offences.push(`seed ${seed}: ${group[0].period} gaps out of build order`);
      }
    }

    expect(offences).toEqual([]);
    // Non-vacuity: Balanced must actually raise toner gaps on a healthy share of shelves, Essential never.
    if (depth === 'balanced') expect(seedsWithTonerGap).toBeGreaterThan(100);
    else expect(seedsWithTonerGap).toBe(0);
    // Spec says "at most 5 in any single period view" (Balanced) / 3 (Essential).
    // The evening has only four Balanced slots, so it can never reach 5: pinned tighter.
    expect(maxMorning).toBeLessThanOrEqual(depth === 'balanced' ? 5 : 3);
    expect(maxEvening).toBeLessThanOrEqual(depth === 'balanced' ? 4 : 2);
  });
});
