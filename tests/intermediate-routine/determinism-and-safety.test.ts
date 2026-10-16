/**
 * Determinism, explainability and pair-rule safety
 * (spec G8, Story 8) plus the targeted landmines this session already hit.
 *
 * Deliberately NOT a re-run of tests/routine-engine/*: those suites did not
 * catch the last round of bugs (a promoted cleanser co-scheduled with copper
 * peptides; "Change" duplicating a scheduled product). The checkers here are
 * independent of the engine's own validator, and the corpora are shaped to
 * make the risky code path fire, with non-vacuity guards that fail loudly if
 * a future engine change makes a sweep stop exercising it.
 * Spec Story 8 (APPROVED). One engine, no style.
 */
import { generatePlan } from '@/utils/routineEngine/generate';
import { applySlotAlternativeSwap } from '@/utils/routineEngine/planApply';
import { validateRoutines } from '@/utils/routineEngine/validate';
import {
  accountedIds,
  avoidPairOffences,
  buildPromotionShapedShelf,
  buildSweepShelf,
  hardGateViolations,
  ids,
  makeEngineInput,
  makeS3,
  resetFixtureCounters,
  routinesFromPlan,
  shelfProduct,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('determinism, accountability and hard gates over 300 enzyme-salted, wishlist-salted shelves', () => {
  it('produces an identical plan for identical input', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const { input } = buildSweepShelf(seed, { enzyme: true, wishlist: true, salt: 7 });

      expect(generatePlan(input)).toEqual(generatePlan(input));
    }
  });

  it('puts every non-hidden shelf product in scheduled, frozen, reserve or same-slot alternatives', () => {
    const missing: string[] = [];
    for (let seed = 0; seed < 300; seed += 1) {
      const { input } = buildSweepShelf(seed, { enzyme: true, wishlist: true, salt: 7 });
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
      const { input, tagsById } = buildSweepShelf(seed, { enzyme: true, wishlist: true, salt: 7 });
      offences.push(...avoidPairOffences(generatePlan(input), tagsById).map((o) => `seed ${seed}: ${o}`));
    }

    expect(offences).toEqual([]);
  });

  it('never schedules a product frozen by a hard gate (clinical, pregnancy, expired, no period) in EITHER period', () => {
    const offences: string[] = [];
    let frozenByHardGate = 0;
    for (let seed = 0; seed < 300; seed += 1) {
      const { input } = buildSweepShelf(seed, { enzyme: true, wishlist: true, salt: 7 });
      const plan = generatePlan(input);
      offences.push(...hardGateViolations(plan).map((o) => `seed ${seed}: ${o}`));
      frozenByHardGate += plan.frozen.length;
    }

    expect(offences).toEqual([]);
    expect(frozenByHardGate).toBeGreaterThan(20); // the sweep must actually freeze things
  });
});

describe('the routine never co-schedules an avoid-level pair with a toner or eye cream it adds (promotion-shaped sweep)', () => {
  const SEEDS = 1500;

  it(`holds across ${SEEDS} shelves with a pre-cleanse step, 2-5 cleansers and active-bearing toners/eye creams`, () => {
    const offences: string[] = [];
    let shelvesWithToneOrEye = 0;

    for (let seed = 0; seed < SEEDS; seed += 1) {
      const shelf = buildPromotionShapedShelf(seed);
      const plan = generatePlan(shelf.input);

      const added = new Set<string>();
      for (const period of ['morning', 'evening'] as const) {
        for (const step of plan.periods[period]) {
          if (step.productType === 'toner' || step.productType === 'eye_cream') added.add(`${period}|${step.productId}`);
        }
      }
      if (added.size === 0) continue;
      shelvesWithToneOrEye += 1;

      // Independent check over the WHOLE plan first (no engine validator involved).
      offences.push(...avoidPairOffences(plan, shelf.tagsById).map((o) => `seed ${seed}: ${o}`));

      // Then the engine's own validator, restricted to avoid-level findings that touch an ADDED step
      // in the period it was added to (pre-existing findings elsewhere are not this task's damage).
      const findings = validateRoutines(routinesFromPlan(plan), shelf.input).findings.filter((f) => f.severity === 'avoid');
      for (const f of findings) {
        const period = f.routineId === 'routine-morning' ? 'morning' : 'evening';
        if (f.productIds.some((p) => added.has(`${period}|${p}`))) {
          offences.push(`seed ${seed}: ${f.reasonCode}:${f.productIds.join('&')} in ${period}`);
        }
      }
    }

    expect(shelvesWithToneOrEye).toBeGreaterThan(400); // guard against a vacuous sweep
    expect(offences).toEqual([]);
  });

  it('keeps copper peptides and an acid apart when the routine adds the copper-peptide toner (rule_copper_peptides_acids)', () => {
    const copperToner = shelfProduct('cu-toner', 'Copper Toner', 'toner', { activeTags: ['copper_peptides'] });
    const acidSerum = shelfProduct('acid-serum', 'AHA Serum', 'serum', { activeTags: ['aha'], usageTime: 'evening' });
    const products = [...makeS3(), copperToner, acidSerum];
    const tagsById = new Map<string, import('@/types').ActiveIngredientKey[]>([
      ['cu-toner', ['copper_peptides']],
      ['acid-serum', ['aha']],
    ]);

    const plan = generatePlan(
      makeEngineInput(products, {
        profile: { fitzpatrick: null, concerns: [], primaryGoal: 'acne', secondaryGoal: null },
      }),
    );

    const scheduledSomewhere = [...ids(plan.periods.morning), ...ids(plan.periods.evening)];
    expect(scheduledSomewhere).toContain('cu-toner'); // the routine really placed the toner
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

    const plan = generatePlan(makeEngineInput(products));

    expect(ids(plan.periods.evening)).toContain('cu-eye');
    expect(avoidPairOffences(plan, tagsById)).toEqual([]);
  });
});

describe('Draft Preview "Change": a swap leaves every product and step id unique in the period', () => {
  // The stricter "a swap never OFFERS the scheduled product" lives in routine-plan.test.ts.
  it('holds for every alternative over 600 shelves', () => {
    const offences: string[] = [];
    let swapsTried = 0;
    const shelves = [
      ...Array.from({ length: 300 }, (_, seed) => buildSweepShelf(seed, { salt: 8 }).input),
      ...Array.from({ length: 300 }, (_, seed) => buildPromotionShapedShelf(seed).input),
    ];

    shelves.forEach((input, n) => {
      const plan = generatePlan(input);
      for (const entry of plan.slotAlternatives ?? []) {
        for (const alt of entry.alternatives) {
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

    expect(swapsTried).toBeGreaterThan(300);
    expect(offences).toEqual([]);
  });
});

describe('hidden shelf products', () => {
  it('keeps hidden shelf products out of every plan bucket', () => {
    const hidden = shelfProduct('h', 'Hidden Toner', 'toner', { isHidden: true });

    const plan = generatePlan(makeEngineInput([...makeS3(), hidden]));

    expect(accountedIds(plan).has('h')).toBe(false);
  });
});
