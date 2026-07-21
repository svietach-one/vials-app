import type { Product, RoutineStep } from '@/types';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import { applySlotAlternativeSwap, buildDraftSummaryLines, buildStepsFromPlan } from '@/utils/routineEngine/planApply';
import type { FrozenItem, PlannedStep, SlotAlternative } from '@/utils/routineEngine/planTypes';
import type { PlanDiffEntry } from '@/utils/routineEngine/validate';

function makePlanned(productId: string, overrides: Partial<PlannedStep> = {}): PlannedStep {
  return {
    productId,
    productType: 'serum',
    scheduledDays: [],
    slotIndex: 6,
    score: 0,
    addedAt: '2026-01-01',
    ...overrides,
  };
}

function makeStep(productId: string, overrides: Partial<RoutineStep> = {}): RoutineStep {
  return {
    id: `step-${productId}`,
    productType: 'serum',
    productId,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

function makeIdFactory(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `new-${n}`;
  };
}

describe('buildStepsFromPlan', () => {
  it('creates steps for planned products with fresh ids', () => {
    const steps = buildStepsFromPlan([makePlanned('a'), makePlanned('b')], [], [], makeIdFactory());
    expect(steps.map((s) => s.productId)).toEqual(['a', 'b']);
    expect(steps.map((s) => s.id)).toEqual(['new-1', 'new-2']);
    expect(steps.every((s) => s.hidden === false && s.userPinned === false)).toBe(true);
  });

  it('reuses the existing step id and pin flag when the product stays', () => {
    const existing = [makeStep('a', { userPinned: true })];
    const steps = buildStepsFromPlan([makePlanned('a')], existing, [], makeIdFactory());
    expect(steps).toEqual([
      expect.objectContaining({ id: 'step-a', productId: 'a', userPinned: true }),
    ]);
  });

  it('carries the plan schedule, not the old one', () => {
    const existing = [makeStep('a', { scheduledDays: [1, 3] })];
    const steps = buildStepsFromPlan(
      [makePlanned('a', { scheduledDays: [2, 6] })],
      existing,
      [],
      makeIdFactory(),
    );
    expect(steps[0].scheduledDays).toEqual([2, 6]);
  });

  it('re-appends pinned steps the plan dropped — the engine never removes a pin', () => {
    const existing = [makeStep('kept'), makeStep('pinned', { userPinned: true, scheduledDays: [5] })];
    const steps = buildStepsFromPlan([makePlanned('kept')], existing, [], makeIdFactory());
    expect(steps.map((s) => s.productId)).toEqual(['kept', 'pinned']);
    expect(steps[1].scheduledDays).toEqual([5]);
  });

  it('drops a pinned step under a clinical freeze — safety beats preference', () => {
    const existing = [makeStep('pinned', { userPinned: true })];
    const frozen: FrozenItem[] = [
      { productId: 'pinned', reasonCode: 'peel_rehab_no_exfoliants', until: '2026-07-18' },
    ];
    const steps = buildStepsFromPlan([], existing, frozen, makeIdFactory());
    expect(steps).toHaveLength(0);
  });

  it('keeps a pinned step frozen by a pair rule (no expiry) — pins beat preferences', () => {
    const existing = [makeStep('pinned', { userPinned: true })];
    const frozen: FrozenItem[] = [
      { productId: 'pinned', reasonCode: 'retinoid_acid_conflict', ruleId: 'rule_retinol_aha' },
    ];
    const steps = buildStepsFromPlan([], existing, frozen, makeIdFactory());
    expect(steps.map((s) => s.productId)).toEqual(['pinned']);
  });

  it('preserves hidden steps untouched — they are user-managed', () => {
    const existing = [makeStep('hidden-one', { hidden: true, scheduledDays: [0] })];
    const steps = buildStepsFromPlan([makePlanned('a')], existing, [], makeIdFactory());
    expect(steps).toEqual([
      expect.objectContaining({ productId: 'a' }),
      expect.objectContaining({ productId: 'hidden-one', hidden: true, scheduledDays: [0] }),
    ]);
  });

  it('drops unpinned, unhidden steps the plan replaced', () => {
    const existing = [makeStep('old')];
    const steps = buildStepsFromPlan([makePlanned('new-product')], existing, [], makeIdFactory());
    expect(steps.map((s) => s.productId)).toEqual(['new-product']);
  });
});

describe('buildDraftSummaryLines', () => {
  const products: Product[] = [
    { id: 'ret', name: 'Retinol Serum' },
    { id: 'aha', name: 'Glycolic Toner' },
    { id: 'vitc', name: 'Vitamin C' },
  ].map((p) => ({
    ...p,
    brand: null,
    productType: 'serum' as const,
    imageUrl: null,
    activeIngredients: [],
    fullIngredientText: null,
    usageTime: 'both' as const,
    openBeautyFactsId: null,
    addedAt: '2026-01-01',
    notes: null,
    openedDate: null,
    paoMonths: null,
  }));

  function makePlan(overrides: Partial<RoutinePlan> = {}): RoutinePlan {
    return {
      rulesetVersion: '2026-07-04',
      generatedFor: '2026-07-05',
      periods: { morning: [], evening: [] },
      frozen: [],
      reserve: [],
      placeholders: [],
      decisions: [],
      ...overrides,
    };
  }

  it('summarizes a day split by naming both products', () => {
    const plan = makePlan({
      decisions: [
        { action: 'day_split', productId: 'aha', ruleId: 'rule_retinol_aha' },
        { action: 'day_split', productId: 'ret', ruleId: 'rule_retinol_aha' },
      ],
    });
    const lines = buildDraftSummaryLines(plan, [], products);
    expect(lines[0]).toBe('Glycolic Toner and Retinol Serum split across nights');
  });

  it('summarizes paused products with the short unfreeze date', () => {
    const plan = makePlan({
      frozen: [{ productId: 'aha', reasonCode: 'peel_rehab_no_exfoliants', until: '2026-07-17' }],
      reserve: [],
    });
    const lines = buildDraftSummaryLines(plan, [], products);
    expect(lines).toContain('1 product paused until Jul 17');
  });

  it('narrates pair-rule freezes (no expiry) instead of letting products vanish silently', () => {
    const plan = makePlan({
      frozen: [{ productId: 'aha', reasonCode: 'retinoid_acid_conflict', ruleId: 'rule_retinol_aha' }],
      reserve: [],
    });
    const lines = buildDraftSummaryLines(plan, [], products);
    expect(lines).toContain('Glycolic Toner set aside to avoid a conflict');
  });

  it('summarizes moves and additions from the diff', () => {
    const diff: PlanDiffEntry[] = [
      { productId: 'vitc', kind: 'moved', from: 'evening', to: 'morning' },
      { productId: 'ret', kind: 'added', to: 'evening' },
    ];
    const lines = buildDraftSummaryLines(makePlan(), diff, products);
    expect(lines).toEqual(['Vitamin C moved to the morning routine', '1 product added']);
  });

  it('never emits more than three lines', () => {
    const plan = makePlan({
      decisions: [
        { action: 'day_split', productId: 'aha' },
        { action: 'day_split', productId: 'ret' },
      ],
      frozen: [{ productId: 'vitc', reasonCode: 'peel_rehab_no_exfoliants', until: '2026-07-20' }],
      reserve: [],
    });
    const diff: PlanDiffEntry[] = [
      { productId: 'vitc', kind: 'moved', from: 'evening', to: 'morning' },
      { productId: 'ret', kind: 'added', to: 'evening' },
    ];
    expect(buildDraftSummaryLines(plan, diff, products)).toHaveLength(3);
  });

  it('returns no lines for a plan with nothing noteworthy', () => {
    expect(buildDraftSummaryLines(makePlan(), [], products)).toEqual([]);
  });
});

// ─── applySlotAlternativeSwap (routine-similar-product-priority, FE-4) ───────

function makeSlotAlternative(overrides: Partial<SlotAlternative> = {}): SlotAlternative {
  return {
    winnerProductId: 'winner',
    period: 'morning',
    slotIndex: 6,
    alternatives: [makePlanned('alt-1')],
    ...overrides,
  };
}

function makeBasePlan(overrides: Partial<RoutinePlan> = {}): RoutinePlan {
  return {
    rulesetVersion: 'test',
    generatedFor: '2026-07-11',
    periods: {
      morning: [makePlanned('winner', { slotIndex: 6 })],
      evening: [],
    },
    frozen: [],
    reserve: [],
    placeholders: [],
    decisions: [],
    slotAlternatives: [makeSlotAlternative()],
    ...overrides,
  };
}

describe('applySlotAlternativeSwap', () => {
  it('replaces the winner with the chosen alternative at the same array position', () => {
    const plan = makeBasePlan({
      periods: {
        morning: [makePlanned('before', { slotIndex: 0 }), makePlanned('winner', { slotIndex: 6 }), makePlanned('after', { slotIndex: 11 })],
        evening: [],
      },
    });
    const result = applySlotAlternativeSwap(plan, 'winner', 'alt-1');
    expect(result.periods.morning.map((s) => s.productId)).toEqual(['before', 'alt-1', 'after']);
  });

  it('is a pure array splice — the chosen step is the exact recorded snapshot, not recomputed', () => {
    const altStep = makePlanned('alt-1', { scheduledDays: [2, 6], score: 42, addedAt: '2026-05-01' });
    const plan = makeBasePlan({
      slotAlternatives: [makeSlotAlternative({ alternatives: [altStep] })],
    });
    const result = applySlotAlternativeSwap(plan, 'winner', 'alt-1');
    expect(result.periods.morning[0]).toBe(altStep);
  });

  it('does not mutate the input plan', () => {
    const plan = makeBasePlan();
    const originalMorning = plan.periods.morning;
    applySlotAlternativeSwap(plan, 'winner', 'alt-1');
    expect(plan.periods.morning).toBe(originalMorning);
    expect(plan.periods.morning[0].productId).toBe('winner');
  });

  it('swaps within the evening period when the alternative entry is scoped there', () => {
    const plan = makeBasePlan({
      periods: { morning: [], evening: [makePlanned('winner', { slotIndex: 6 })] },
      slotAlternatives: [makeSlotAlternative({ period: 'evening' })],
    });
    const result = applySlotAlternativeSwap(plan, 'winner', 'alt-1');
    expect(result.periods.evening.map((s) => s.productId)).toEqual(['alt-1']);
    expect(result.periods.morning).toEqual([]);
  });

  it('returns the plan unchanged when the winner/alternative pairing is not found', () => {
    const plan = makeBasePlan();
    expect(applySlotAlternativeSwap(plan, 'nonexistent-winner', 'alt-1')).toBe(plan);
    expect(applySlotAlternativeSwap(plan, 'winner', 'nonexistent-alt')).toBe(plan);
  });

  it('returns the plan unchanged when the winner is no longer present in its period', () => {
    const plan = makeBasePlan({ periods: { morning: [], evening: [] } });
    expect(applySlotAlternativeSwap(plan, 'winner', 'alt-1')).toBe(plan);
  });

  it('supports swapping back to the original winner after swapping to an alternative', () => {
    const winnerStep = makePlanned('winner', { slotIndex: 6, addedAt: '2026-01-01' });
    const plan = makeBasePlan({
      periods: { morning: [winnerStep], evening: [] },
    });

    const afterSwap = applySlotAlternativeSwap(plan, 'winner', 'alt-1');
    expect(afterSwap.periods.morning.map((s) => s.productId)).toEqual(['alt-1']);

    // The "winnerProductId" key stays the entry's stable identity — the caller
    // (Draft Preview's Select) always passes it, never the currently-admitted
    // product id, so the slot is still locatable here.
    const afterRevert = applySlotAlternativeSwap(afterSwap, 'winner', 'winner');
    expect(afterRevert.periods.morning.map((s) => s.productId)).toEqual(['winner']);
    expect(afterRevert.periods.morning[0]).toBe(winnerStep);
  });

  it('keeps every displaced candidate selectable across more than one swap', () => {
    const plan = makeBasePlan({
      periods: { morning: [makePlanned('winner', { slotIndex: 6 })], evening: [] },
      slotAlternatives: [
        makeSlotAlternative({ alternatives: [makePlanned('alt-1'), makePlanned('alt-2')] }),
      ],
    });

    const step1 = applySlotAlternativeSwap(plan, 'winner', 'alt-1');
    expect(step1.periods.morning.map((s) => s.productId)).toEqual(['alt-1']);

    // From alt-1, swap directly to alt-2 — the winner and alt-1 must both
    // remain recorded as candidates for a future re-selection.
    const step2 = applySlotAlternativeSwap(step1, 'winner', 'alt-2');
    expect(step2.periods.morning.map((s) => s.productId)).toEqual(['alt-2']);
    const remainingIds = (step2.slotAlternatives ?? [])[0].alternatives.map((s) => s.productId);
    expect(remainingIds.sort()).toEqual(['alt-1', 'winner']);

    const step3 = applySlotAlternativeSwap(step2, 'winner', 'alt-1');
    expect(step3.periods.morning.map((s) => s.productId)).toEqual(['alt-1']);
  });
});
