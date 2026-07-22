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
    // Both locked to am: vitC pure (preferred am) + a copper peptide toner
    // pinned to morning. rule_vitc_pure_copper_peptides is caution and offers
    // separate_periods first; with the peptide unable to move, the ladder falls
    // through to keep_with_note.
    // (This used vitC + niacinamide until 2026-07-17, when that pair became
    // compatible — see spec phase-01 §1.4.)
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const copper = makeProduct({
      activeTags: ['copper_peptides'],
      usageTime: 'morning',
      productType: 'toner',
    });
    const result = resolve([vitC, copper]);

    expect(stepFor(result, 'am', vitC.id)).toBeDefined();
    expect(stepFor(result, 'am', copper.id)).toBeDefined();
    expect(result.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'keep_with_note',
          ruleId: 'rule_vitc_pure_copper_peptides',
        }),
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
    // Distinct productType from the default 'serum' — this test is about
    // pair-rule freeze attribution, not slot competition; sharing a slot with
    // vitC would otherwise make copper a same-slot loser under the
    // routine-similar-product-priority engine cap (they have no pair rule
    // between each other, so nothing else would keep copper out of that slot).
    const copper = makeProduct({ activeTags: ['copper_peptides'], usageTime: 'evening', productType: 'ampoule' });
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
        expect.objectContaining({ action: 'day_split', ruleId: 'cumulative_active_cap' }),
      ]),
    );
  });

  it('shares the cap between AHA and BHA (both strong actives)', () => {
    const aha = makeProduct({ activeTags: ['aha'], addedAt: '2026-06-01' });
    const bha = makeProduct({ activeTags: ['bha'], addedAt: '2026-01-01' });
    const result = resolve([aha, bha]);

    // bha collides with aha via sharedCapWith and lands on split days
    expect(stepFor(result, 'pm', bha.id)?.scheduledDays).toEqual([2, 6]);
  });

  it('does not cap PHA against AHA — PHA is mild, so it carries no cumulative restriction', () => {
    // Behavior change 2026-07-17 (spec phase-01 §1.2, report §7 assumption 8.2):
    // stacking is declared iff irritancy >= 3. PHA is irritancy 1, so it left
    // both its own stacking block and aha/bha's sharedCapWith group.
    // Distinct productTypes (toner vs serum) keep the same-slot cap out of the
    // way, so this asserts the stacking cap alone.
    const aha = makeProduct({ activeTags: ['aha'], productType: 'serum' });
    const pha = makeProduct({ activeTags: ['pha'], productType: 'toner' });
    const result = resolve([aha, pha]);

    // Both run every day; neither is day-split or frozen by a cap.
    expect(stepFor(result, 'pm', aha.id)?.scheduledDays).toEqual([]);
    expect(stepFor(result, 'pm', pha.id)?.scheduledDays).toEqual([]);
    expect(result.frozen).toEqual([]);
  });

  it('does not cap PHA against AHA regardless of admission order', () => {
    // Order-independence is exactly what removing pha from sharedCapWith buys:
    // leaving it in the group would let a PHA admitted first block a later AHA,
    // while AHA-first would not block PHA (pha has no stacking to check).
    const pha = makeProduct({ activeTags: ['pha'], productType: 'toner', addedAt: '2026-06-01' });
    const aha = makeProduct({ activeTags: ['aha'], productType: 'serum', addedAt: '2026-01-01' });
    const result = resolve([pha, aha]);

    expect(stepFor(result, 'pm', pha.id)?.scheduledDays).toEqual([]);
    expect(stepFor(result, 'pm', aha.id)?.scheduledDays).toEqual([]);
    expect(result.frozen).toEqual([]);
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
    // Distinct productType from the default 'serum' — this test compares
    // scores between two conflict-free products; sharing ceramide's slot
    // would otherwise make one of them a same-slot loser (no PlannedStep at
    // all) under the routine-similar-product-priority engine cap.
    const plain = makeProduct({ productType: 'toner' });
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

    // phase-04 rebanded the score: concernHits*10 + potency*2 (1*10 + 3*2 = 16).
    // Relative concern-over-potency order is unchanged from V2.
    expect(stepFor(result, 'am', matching.id)?.score).toBe(16);
    expect(stepFor(result, 'pm', other.id)?.score).toBe(16);
  });
});

describe('resolvePeriods — same-slot alternatives (routine-similar-product-priority)', () => {
  it('admits exactly one of two conflict-free same-slot candidates and records the other as an alternative', () => {
    const spfA = makeProduct({ productType: 'spf', usageTime: 'morning', addedAt: '2026-06-01' });
    const spfB = makeProduct({ productType: 'spf', usageTime: 'morning', addedAt: '2026-01-01' });
    const result = resolve([spfA, spfB]);

    // Newer addedAt wins ties (compareCandidates) — spfA admitted, spfB the alternative.
    expect(stepFor(result, 'am', spfA.id)).toBeDefined();
    expect(stepFor(result, 'am', spfB.id)).toBeUndefined();
    expect(result.frozen).toHaveLength(0); // a slot loser is never frozen — it's a swappable alternative

    expect(result.slotAlternatives).toEqual([
      expect.objectContaining({
        winnerProductId: spfA.id,
        period: 'morning',
        alternatives: [expect.objectContaining({ productId: spfB.id, productType: 'spf' })],
      }),
    ]);
  });

  it('the winning same-slot candidate is chosen by scoreCandidate ordering (concern match wins)', () => {
    const matching = makeProduct({ activeTags: ['benzoyl_peroxide'], addedAt: '2026-01-01' });
    const other = makeProduct({ activeTags: ['ceramides'], addedAt: '2026-06-01' }); // newer, would win with no boost
    const result = resolve([matching, other], { concerns: ['acne'] });

    expect(stepFor(result, 'am', matching.id)).toBeDefined();
    expect(stepFor(result, 'am', other.id)).toBeUndefined();
    expect(result.slotAlternatives).toEqual([
      expect.objectContaining({ winnerProductId: matching.id }),
    ]);
  });

  it('never caps the exempt "other" slot — both same-"other" products are admitted', () => {
    const otherA = makeProduct({ productType: 'other' });
    const otherB = makeProduct({ productType: 'other' });
    const result = resolve([otherA, otherB]);

    expect(stepFor(result, 'am', otherA.id)).toBeDefined();
    expect(stepFor(result, 'am', otherB.id)).toBeDefined();
    expect(result.slotAlternatives).toHaveLength(0);
  });

  it('a same-slot loser is never deleted from the shelf or from any other period', () => {
    const spfA = makeProduct({ productType: 'spf', usageTime: 'morning', addedAt: '2026-06-01' });
    const spfB = makeProduct({ productType: 'spf', usageTime: 'morning', addedAt: '2026-01-01' });
    const result = resolve([spfA, spfB]);

    // Not admitted anywhere, not frozen, not silently dropped — recorded as an alternative.
    expect(stepFor(result, 'am', spfB.id)).toBeUndefined();
    expect(stepFor(result, 'pm', spfB.id)).toBeUndefined();
    expect(result.frozen.some((f) => f.productId === spfB.id)).toBe(false);
    expect(
      result.slotAlternatives.some((a) => a.alternatives.some((alt) => alt.productId === spfB.id)),
    ).toBe(true);
  });

  it('admits the next-ranked same-slot candidate once the top-ranked one is frozen by a pair rule (AC4)', () => {
    // vitC/copper occupy distinct slots from each other and from bha/plain —
    // isolates the slot competition to just {bha, plain} sharing the
    // serum/gel slot (6), independent of the unrelated pair-rule freeze.
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'], usageTime: 'evening', productType: 'essence' });
    const copper = makeProduct({ activeTags: ['copper_peptides'], usageTime: 'evening', productType: 'ampoule' });
    const bha = makeProduct({
      activeTags: ['bha'],
      usageTime: 'evening',
      productType: 'gel', // shares the serum/gel slot (6) with `plain`
      fullIngredientText: 'Aqua, Willow Bark Extract', // low potency evidence -> score 10, ranks above plain
      addedAt: '2026-06-01',
    });
    const plain = makeProduct({ productType: 'serum', addedAt: '2026-01-01' }); // same slot as bha, no actives -> score 0

    const result = resolve([vitC, copper, bha, plain]);

    // bha conflicts with BOTH vitC and copper (no day-split room) -> frozen,
    // never reaches admission — the slot is never actually occupied by it.
    expect(stepFor(result, 'pm', bha.id)).toBeUndefined();
    expect(result.frozen).toEqual(
      expect.arrayContaining([expect.objectContaining({ productId: bha.id })]),
    );
    // plain shares bha's slot but has no conflicts of its own — admitted
    // once bha's freeze leaves that slot open, exactly as AC4 requires.
    expect(stepFor(result, 'pm', plain.id)).toBeDefined();
    // bha never competed for the slot (it never got there), so no
    // alternative entry exists for it.
    expect(result.slotAlternatives.find((a) => a.slotIndex === 6)).toBeUndefined();
  });

  it('is deterministic across repeated runs on the same inputs', () => {
    const spfA = makeProduct({ productType: 'spf', usageTime: 'morning', addedAt: '2026-06-01' });
    const spfB = makeProduct({ productType: 'spf', usageTime: 'morning', addedAt: '2026-01-01' });
    const context = makeContext();
    const a = resolvePeriods({ products: [spfA, spfB], facts: buildShelfFacts([spfA, spfB], NOW), context, concerns: [] });
    const b = resolvePeriods({ products: [spfA, spfB], facts: buildShelfFacts([spfA, spfB], NOW), context, concerns: [] });
    expect(a.slotAlternatives).toEqual(b.slotAlternatives);
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
