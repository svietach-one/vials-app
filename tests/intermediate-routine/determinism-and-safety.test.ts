/**
 * Determinism, explainability and pair-rule safety at BOTH styles
 * (spec G7, Story 6) plus the targeted landmines this session already hit.
 *
 * Deliberately NOT a re-run of tests/routine-engine/*: those suites did not
 * catch the last round of bugs (a promoted cleanser co-scheduled with copper
 * peptides; "Change" duplicating a scheduled product). The checkers here are
 * independent of the engine's own validator, and the corpora are shaped to
 * make the risky code path fire, with non-vacuity guards that fail loudly if
 * a future engine change makes a sweep stop exercising it.
 * Written against a DRAFT spec.
 */
import { generatePlan } from '@/utils/routineEngine/generate';
import { applySlotAlternativeSwap } from '@/utils/routineEngine/planApply';
import { validateRoutines } from '@/utils/routineEngine/validate';
import {
  accountedIds,
  avoidPairOffences,
  buildPromotionShapedShelf,
  buildSweepShelf,
  DEPTHS,
  hardGateViolations,
  ids,
  makeDepthInput,
  makeRoutineStep,
  makeS3,
  resetFixtureCounters,
  routinesFromPlan,
  shelfProduct,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe.each(DEPTHS)('%s style: determinism, accountability and hard gates over 300 enzyme-salted shelves', (depth) => {
  it('produces an identical plan for identical input', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const { input } = buildSweepShelf(seed, depth, { enzyme: true, salt: 7 });

      expect(generatePlan(input)).toEqual(generatePlan(input));
    }
  });

  it('puts every non-hidden shelf product in scheduled, frozen, reserve or same-slot alternatives', () => {
    const missing: string[] = [];
    for (let seed = 0; seed < 300; seed += 1) {
      const { input } = buildSweepShelf(seed, depth, { enzyme: true, salt: 7 });
      const plan = generatePlan(input);
      const accounted = accountedIds(plan);
      for (const p of input.products) {
        if (!p.isHidden && !accounted.has(p.id)) missing.push(`seed ${seed}: ${p.id} (${p.productType})`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('never co-schedules an avoid-level pair on a shared day (independent tag-based check)', () => {
    const offences: string[] = [];
    for (let seed = 0; seed < 300; seed += 1) {
      const { input, tagsById } = buildSweepShelf(seed, depth, { enzyme: true, salt: 7 });
      offences.push(...avoidPairOffences(generatePlan(input), tagsById).map((o) => `seed ${seed}: ${o}`));
    }

    expect(offences).toEqual([]);
  });

  it('never schedules a product frozen by a hard gate (clinical, pregnancy, expired, no period) in EITHER period', () => {
    const offences: string[] = [];
    let frozenByHardGate = 0;
    for (let seed = 0; seed < 300; seed += 1) {
      const { input } = buildSweepShelf(seed, depth, { enzyme: true, salt: 7 });
      const plan = generatePlan(input);
      offences.push(...hardGateViolations(plan).map((o) => `seed ${seed}: ${o}`));
      frozenByHardGate += plan.frozen.length;
    }

    expect(offences).toEqual([]);
    expect(frozenByHardGate).toBeGreaterThan(20); // the sweep must actually freeze things
  });
});

describe('Balanced never co-schedules an avoid-level pair with a step it ADDED (promotion-shaped sweep)', () => {
  const SEEDS = 1500;

  it(`holds across ${SEEDS} shelves with a pre-cleanse step, 2-5 cleansers and active-bearing toners/eye creams`, () => {
    const offences: string[] = [];
    let shelvesWhereBalancedAdds = 0;

    for (let seed = 0; seed < SEEDS; seed += 1) {
      const balanced = buildPromotionShapedShelf(seed, 'balanced');
      const essential = buildPromotionShapedShelf(seed, 'essential');
      const plan = generatePlan(balanced.input);
      const base = generatePlan(essential.input);

      const added = new Set<string>();
      for (const period of ['morning', 'evening'] as const) {
        const baseIds = new Set(ids(base.periods[period]));
        for (const step of plan.periods[period]) if (!baseIds.has(step.productId)) added.add(`${period}|${step.productId}`);
      }
      if (added.size === 0) continue;
      shelvesWhereBalancedAdds += 1;

      // Independent check over the WHOLE plan first (cheap, no engine validator involved).
      offences.push(...avoidPairOffences(plan, balanced.tagsById).map((o) => `seed ${seed}: ${o}`));

      // Then the engine's own validator, restricted to avoid-level findings that touch an ADDED step
      // in the period it was added to (pre-existing findings elsewhere are not this task's damage).
      const findings = validateRoutines(routinesFromPlan(plan), balanced.input).findings.filter(
        (f) => f.severity === 'avoid',
      );
      for (const f of findings) {
        const period = f.routineId === 'routine-morning' ? 'morning' : 'evening';
        if (f.productIds.some((p) => added.has(`${period}|${p}`))) {
          offences.push(`seed ${seed}: ${f.reasonCode}:${f.productIds.join('&')} in ${period}`);
        }
      }
    }

    expect(shelvesWhereBalancedAdds).toBeGreaterThan(400); // guard against a vacuous sweep
    expect(offences).toEqual([]);
  });

  it('keeps copper peptides and an acid apart when Balanced adds the copper-peptide toner (rule_copper_peptides_acids)', () => {
    const copperToner = shelfProduct('cu-toner', 'Copper Toner', 'toner', { activeTags: ['copper_peptides'] });
    const acidSerum = shelfProduct('acid-serum', 'AHA Serum', 'serum', { activeTags: ['aha'], usageTime: 'evening' });
    const products = [...makeS3(), copperToner, acidSerum];
    const tagsById = new Map<string, import('@/types').ActiveIngredientKey[]>([
      ['cu-toner', ['copper_peptides']],
      ['acid-serum', ['aha']],
    ]);

    const plan = generatePlan(
      makeDepthInput(products, 'balanced', {
        profile: { fitzpatrick: null, concerns: [], primaryGoal: 'acne', secondaryGoal: null },
      }),
    );

    const scheduledSomewhere = [...ids(plan.periods.morning), ...ids(plan.periods.evening)];
    expect(scheduledSomewhere).toContain('cu-toner'); // Balanced really placed the toner
    expect(avoidPairOffences(plan, tagsById)).toEqual([]);
  });

  it('keeps copper peptides in an eye cream apart from a PHA cleanser promoted into the evening', () => {
    const copperEye = shelfProduct('cu-eye', 'Copper Eye Cream', 'eye_cream', { activeTags: ['copper_peptides'] });
    const phaWash = shelfProduct('pha-wash', 'PHA Wash', 'cleanser', { activeTags: ['pha'], usageTime: 'evening' });
    const products = [
      shelfProduct('mw', 'Micellar Water', 'makeup_remover'),
      shelfProduct('plain', 'Plain Cleanser', 'cleanser', { usageTime: 'evening' }),
      phaWash,
      copperEye,
      shelfProduct('cream', 'Cream', 'moisturizer'),
      shelfProduct('spf', 'SPF', 'spf'),
    ];
    const tagsById = new Map<string, import('@/types').ActiveIngredientKey[]>([
      ['cu-eye', ['copper_peptides']],
      ['pha-wash', ['pha']],
    ]);

    const plan = generatePlan(makeDepthInput(products, 'balanced'));

    expect(ids(plan.periods.evening)).toContain('cu-eye');
    expect(avoidPairOffences(plan, tagsById)).toEqual([]);
  });
});

describe.each(DEPTHS)('%s style: Draft Preview "Change" never duplicates a product already scheduled in the period', (depth) => {
  it('offers only products absent from the period, and a swap leaves every product and step id unique', () => {
    const offences: string[] = [];
    let swapsTried = 0;
    const shelves = [
      ...Array.from({ length: 300 }, (_, seed) => buildSweepShelf(seed, depth, { salt: 8 })),
      ...Array.from({ length: 300 }, (_, seed) => buildPromotionShapedShelf(seed, depth)),
    ];

    shelves.forEach(({ input }, n) => {
      const plan = generatePlan(input);
      for (const entry of plan.slotAlternatives ?? []) {
        const scheduled = ids(plan.periods[entry.period]);
        const current = plan.periods[entry.period].find((s) => s.slotIndex === entry.slotIndex)?.productId;
        for (const alt of entry.alternatives) {
          // KNOWN, PRE-EXISTING (see report): on ~2.5% of alternatives the engine offers the slot's own
          // current product as its alternative (a no-op "Change"). Not a duplicate, so not asserted here.
          if (alt.productId !== current && scheduled.includes(alt.productId)) offences.push(`shelf ${n}: ${alt.productId} offered but already in ${entry.period}`);
          const swapped = applySlotAlternativeSwap(plan, entry.winnerProductId, alt.productId);
          swapsTried += 1;
          for (const period of ['morning', 'evening'] as const) {
            const after = ids(swapped.periods[period]);
            if (new Set(after).size !== after.length) offences.push(`shelf ${n}: duplicate product after swapping ${alt.productId} in ${period}`);
          }
          const steps = routinesFromPlan(swapped).flatMap((r) => r.steps.map((s) => `${r.id}|${s.id}`));
          if (new Set(steps).size !== steps.length) offences.push(`shelf ${n}: duplicate step id after swapping ${alt.productId}`);
        }
      }
    });

    expect(swapsTried).toBeGreaterThan(100);
    expect(offences).toEqual([]);
  });
});

describe('a saved hidden step is a user decision the engine never re-adds', () => {
  it('keeps hidden shelf products out of every plan bucket at both styles', () => {
    const hidden = shelfProduct('h', 'Hidden Toner', 'toner', { isHidden: true });
    for (const depth of DEPTHS) {
      const plan = generatePlan(makeDepthInput([...makeS3(), hidden], depth));

      expect(accountedIds(plan).has('h')).toBe(false);
    }
    expect(makeRoutineStep(hidden, { hidden: true }).hidden).toBe(true);
  });
});
