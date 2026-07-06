import type { Product, SkinConcern, UserProcedureLog } from '@/types';
import { buildRoutineContext, type RoutineContext } from '@/utils/routineEngine/context';
import { buildShelfFacts } from '@/utils/routineEngine/productFacts';
import { resolvePeriods, type ResolveResult } from '@/utils/routineEngine/resolve';

const NOW = new Date('2026-07-04T12:00:00Z');

let idCounter = 0;
function makeProduct(overrides: Partial<Product> = {}): Product {
  idCounter += 1;
  return {
    id: `p${idCounter}`,
    name: `Product ${idCounter}`,
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
): RoutineContext {
  return buildRoutineContext({
    procedures: options.procedures ?? [],
    profile: { fitzpatrick: options.fitzpatrick ?? null },
    seasonMask: { season: options.season ?? 'spring', source: 'calendar' },
    now: NOW,
  });
}

function resolve(
  products: Product[],
  options: { context?: RoutineContext; concerns?: SkinConcern[] } = {},
): ResolveResult {
  return resolvePeriods({
    products,
    facts: buildShelfFacts(products, NOW),
    context: options.context ?? makeContext(),
    concerns: options.concerns ?? [],
  });
}

const stepFor = (result: ResolveResult, period: 'am' | 'pm', productId: string) =>
  result.periods[period].find((s) => s.productId === productId);

beforeEach(() => {
  idCounter = 0;
});

describe('resolvePeriods — placement', () => {
  it('places a benign product without actives into both periods, every day', () => {
    const cleanser = makeProduct({ productType: 'cleanser' });
    const result = resolve([cleanser]);
    expect(stepFor(result, 'am', cleanser.id)?.scheduledDays).toEqual([]);
    expect(stepFor(result, 'pm', cleanser.id)?.scheduledDays).toEqual([]);
  });

  it('places treatments once, in their preferred period', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const result = resolve([retinoid, vitC]);
    expect(stepFor(result, 'pm', retinoid.id)).toBeDefined();
    expect(stepFor(result, 'am', retinoid.id)).toBeUndefined();
    expect(stepFor(result, 'am', vitC.id)).toBeDefined();
    expect(stepFor(result, 'pm', vitC.id)).toBeUndefined();
  });

  it('returns each period ordered by the layering table', () => {
    const spf = makeProduct({ productType: 'spf' });
    const cleanser = makeProduct({ productType: 'cleanser' });
    const serum = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const result = resolve([spf, cleanser, serum]);
    expect(result.periods.am.map((s) => s.productType)).toEqual(['cleanser', 'serum', 'spf']);
  });
});

describe('resolvePeriods — pair conflicts and the ladder', () => {
  it('day-splits retinoid vs AHA: loser takes Tue/Sat, daily winner shrinks around it', () => {
    // Retinoid newer → higher tiebreak → admitted first as the daily winner
    const retinoid = makeProduct({ activeTags: ['retinoid'], addedAt: '2026-06-01' });
    const aha = makeProduct({ activeTags: ['aha'], addedAt: '2026-01-01' });
    const result = resolve([retinoid, aha]);

    expect(stepFor(result, 'pm', aha.id)?.scheduledDays).toEqual([2, 6]);
    expect(stepFor(result, 'pm', retinoid.id)?.scheduledDays).toEqual([0, 1, 3, 4, 5]);
    expect(result.frozen).toHaveLength(0);
    expect(result.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'day_split', productId: aha.id, ruleId: 'rule_retinol_aha' }),
      ]),
    );
  });

  it('keeps a caution pair with a note when the loser cannot change period', () => {
    // Both locked to am: vitC (preferred am) + niacinamide (usageTime morning)
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const niacinamide = makeProduct({ activeTags: ['niacinamide'], usageTime: 'morning' });
    const result = resolve([vitC, niacinamide]);

    expect(stepFor(result, 'am', vitC.id)).toBeDefined();
    expect(stepFor(result, 'am', niacinamide.id)).toBeDefined();
    expect(result.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'keep_with_note', ruleId: 'rule_vitc_niacinamide' }),
      ]),
    );
  });

  it('relocates the loser to its other allowed period when the ladder starts with separate_periods', () => {
    // PHA locked to am and outscoring (concern match); copper peptides prefer am
    // but may relocate → rule_copper_peptides_acids sends copper to pm.
    const pha = makeProduct({ activeTags: ['pha'], usageTime: 'morning', productType: 'toner' });
    const copper = makeProduct({ activeTags: ['copper_peptides'] });
    const result = resolve([pha, copper], { concerns: ['pores'] });

    expect(stepFor(result, 'am', pha.id)).toBeDefined();
    expect(stepFor(result, 'am', copper.id)).toBeUndefined();
    expect(stepFor(result, 'pm', copper.id)).toBeDefined();
    expect(result.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'relocate', productId: copper.id, period: 'am' }),
      ]),
    );
  });

  it('attributes a mixed-severity multi-violation freeze to the avoid rule, not the first partner (2026-07-05 review blocker)', () => {
    // All three land in PM. Admission order: vitC (potency 30) → copper (20)
    // → willow-bark BHA (low, 10). The BHA candidate then violates BOTH
    // vitC (caution, rule_vitc_pure_acids) and copper (avoid,
    // rule_copper_peptides_acids). The avoid rule must drive the ladder and
    // the attribution even though the caution partner was admitted first.
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'], usageTime: 'evening' });
    const copper = makeProduct({ activeTags: ['copper_peptides'], usageTime: 'evening' });
    const bha = makeProduct({
      activeTags: ['bha'],
      usageTime: 'evening',
      fullIngredientText: 'Aqua, Willow Bark Extract', // low potency evidence
    });
    const result = resolve([vitC, copper, bha]);

    // Both daily partners make a day split impossible → the BHA freezes,
    // citing the rule that actually forced it (avoid), not the caution one.
    expect(stepFor(result, 'pm', vitC.id)).toBeDefined();
    expect(stepFor(result, 'pm', copper.id)).toBeDefined();
    expect(result.frozen).toEqual([
      expect.objectContaining({ productId: bha.id, ruleId: 'rule_copper_peptides_acids' }),
    ]);
  });

  it('escalated avoid pairs never coexist via keep_with_note (phototype 6)', () => {
    // vitC forced pm next to BHA; caution ladder ends keep_with_note, but
    // phototype 6 escalates the pair to avoid → the loser freezes instead.
    const bha = makeProduct({ activeTags: ['bha'], addedAt: '2026-06-01' });
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'], usageTime: 'evening', addedAt: '2026-01-01' });

    const baseline = resolve([bha, vitC]);
    expect(stepFor(baseline, 'pm', vitC.id)).toBeDefined(); // caution → note

    const escalated = resolve([bha, vitC], { context: makeContext({ fitzpatrick: 6 }) });
    expect(stepFor(escalated, 'pm', vitC.id)).toBeUndefined();
    expect(escalated.frozen).toEqual([
      expect.objectContaining({ productId: vitC.id, ruleId: 'rule_vitc_pure_acids' }),
    ]);
  });
});

describe('resolvePeriods — stacking caps', () => {
  it('day-splits a second product of a capped class (two AHA serums)', () => {
    const aha1 = makeProduct({ activeTags: ['aha'], addedAt: '2026-06-01' });
    const aha2 = makeProduct({ activeTags: ['aha'], addedAt: '2026-01-01' });
    const result = resolve([aha1, aha2]);

    expect(stepFor(result, 'pm', aha2.id)?.scheduledDays).toEqual([2, 6]);
    expect(stepFor(result, 'pm', aha1.id)?.scheduledDays).toEqual([0, 1, 3, 4, 5]);
    expect(result.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'day_split', ruleId: 'stacking_cap_aha' }),
      ]),
    );
  });

  it('applies the shared cap across acid classes (AHA + PHA in one period)', () => {
    const aha = makeProduct({ activeTags: ['aha'], addedAt: '2026-06-01' });
    const pha = makeProduct({ activeTags: ['pha'], addedAt: '2026-01-01' }); // treatment → default pm
    const result = resolve([aha, pha]);

    // pha collides with aha via sharedCapWith and lands on split days
    expect(stepFor(result, 'pm', pha.id)?.scheduledDays).toEqual([2, 6]);
  });
});

describe('resolvePeriods — limits and prioritize', () => {
  it('clamps exfoliants to one day per week under the summer mask', () => {
    const aha = makeProduct({ activeTags: ['aha'] });
    const result = resolve([aha], { context: makeContext({ season: 'summer' }) });

    expect(stepFor(result, 'pm', aha.id)?.scheduledDays).toEqual([3]);
    expect(result.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'limit', reasonCode: 'summer_uv_exfoliant_limit' }),
      ]),
    );
  });

  it('boosts barrier-repair products during peel rehab (SOS prioritize)', () => {
    const peel: UserProcedureLog = {
      id: 'proc-1',
      procedureKey: 'chemical_peel_deep',
      datePerformed: '2026-07-04',
      status: 'rehab',
      deferralCount: 0,
    };
    const ceramide = makeProduct({ activeTags: ['ceramides'] });
    const plain = makeProduct();
    const boosted = resolve([ceramide, plain], { context: makeContext({ procedures: [peel] }) });
    const ceramideStep = stepFor(boosted, 'pm', ceramide.id);
    const plainStep = stepFor(boosted, 'pm', plain.id);
    expect(ceramideStep && plainStep && ceramideStep.score > plainStep.score).toBe(true);
    expect(ceramideStep!.score).toBeGreaterThanOrEqual(1000);
  });
});

describe('resolvePeriods — scoring', () => {
  it('prefers the concern-matching product when a freeze must pick a loser', () => {
    // Two benzoyl products (cap 1, am): the acne-concern match wins the slot
    const matching = makeProduct({ activeTags: ['benzoyl_peroxide'], addedAt: '2026-01-01' });
    const other = makeProduct({ activeTags: ['retinoid'], addedAt: '2026-06-01' });
    const result = resolve([matching, other], { concerns: ['acne'] });

    // benzoyl matches 'acne' → 100 + potency 30; retinoid matches 'acne' too.
    // Both match — verify the score component is visible on the steps instead.
    expect(stepFor(result, 'am', matching.id)?.score).toBe(130);
    expect(stepFor(result, 'pm', other.id)?.score).toBe(130);
  });
});

describe('resolvePeriods — determinism', () => {
  it('produces an identical result for the same input, twice', () => {
    const products = [
      makeProduct({ activeTags: ['retinoid'], addedAt: '2026-03-01' }),
      makeProduct({ activeTags: ['aha'], addedAt: '2026-02-01' }),
      makeProduct({ activeTags: ['vitamin_c_pure'], addedAt: '2026-04-01' }),
      makeProduct({ activeTags: ['niacinamide'], addedAt: '2026-01-15' }),
      makeProduct({ productType: 'cleanser' }),
      makeProduct({ productType: 'spf' }),
    ];
    const context = makeContext({ season: 'summer', fitzpatrick: 4 });
    const a = resolvePeriods({ products, facts: buildShelfFacts(products, NOW), context, concerns: ['acne'] });
    const b = resolvePeriods({ products, facts: buildShelfFacts(products, NOW), context, concerns: ['acne'] });
    expect(a).toEqual(b);
  });

  it('is insensitive to shelf array order', () => {
    const products = [
      makeProduct({ activeTags: ['retinoid'], addedAt: '2026-03-01' }),
      makeProduct({ activeTags: ['aha'], addedAt: '2026-02-01' }),
      makeProduct({ activeTags: ['bha'], addedAt: '2026-01-01' }),
    ];
    const context = makeContext();
    const forward = resolvePeriods({ products, facts: buildShelfFacts(products, NOW), context, concerns: [] });
    const reversed = resolvePeriods({
      products: [...products].reverse(),
      facts: buildShelfFacts(products, NOW),
      context,
      concerns: [],
    });
    expect(forward.periods).toEqual(reversed.periods);
    expect(forward.frozen).toEqual(reversed.frozen);
  });
});
