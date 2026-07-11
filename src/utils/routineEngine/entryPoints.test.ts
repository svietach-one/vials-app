import type { Product, Routine, RoutineStep, UserProcedureLog } from '@/types';
import { getDailyView } from '@/utils/routineEngine/dailyView';
import { generatePlan, type EngineInput } from '@/utils/routineEngine/generate';
import { findSubstitute } from '@/utils/routineEngine/substitute';
import { validateRoutines } from '@/utils/routineEngine/validate';

const NOW = new Date('2026-07-04T12:00:00Z'); // Saturday (UTC dow 6)

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

let stepCounter = 0;
function makeStep(product: Product, overrides: Partial<RoutineStep> = {}): RoutineStep {
  stepCounter += 1;
  return {
    id: `s${stepCounter}`,
    productType: product.productType,
    productId: product.id,
    hidden: false,
    scheduledDays: [],
    ...overrides,
  };
}

function makeRoutine(timeOfDay: 'morning' | 'evening', steps: RoutineStep[]): Routine {
  return { id: `routine-${timeOfDay}`, name: timeOfDay, timeOfDay, steps };
}

function makeInput(products: Product[], overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    products,
    procedures: [],
    profile: { fitzpatrick: null, concerns: [] },
    seasonMask: { season: 'spring', source: 'calendar' },
    now: NOW,
    ...overrides,
  };
}

const PEEL: UserProcedureLog = {
  id: 'proc-1',
  procedureKey: 'chemical_peel_deep',
  datePerformed: '2026-07-04',
  status: 'rehab',
  deferralCount: 0,
};

beforeEach(() => {
  idCounter = 0;
  stepCounter = 0;
});

// ─── generatePlan ───────────────────────────────────────────────────────────

describe('generatePlan', () => {
  it('assembles a stamped full AM+PM draft from the shelf', () => {
    const cleanser = makeProduct({ productType: 'cleanser' });
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const plan = generatePlan(makeInput([cleanser, retinoid, vitC]));

    expect(plan.rulesetVersion).toBe('2026-07-04');
    expect(plan.generatedFor).toBe('2026-07-04');
    expect(plan.periods.morning.map((s) => s.productId)).toEqual([cleanser.id, vitC.id]);
    expect(plan.periods.evening.map((s) => s.productId)).toEqual([cleanser.id, retinoid.id]);
    expect(plan.frozen).toHaveLength(0);
  });

  it('turns clinical-freeze gate rejections into frozen rows with expiry', () => {
    const aha = makeProduct({ activeTags: ['aha'] });
    const plan = generatePlan(makeInput([aha], { procedures: [PEEL] }));

    expect(plan.periods.evening).toHaveLength(0);
    expect(plan.frozen).toEqual([
      { productId: aha.id, reasonCode: 'peel_rehab_no_exfoliants', until: '2026-07-18' },
    ]);
  });

  it('excludes hidden products silently — no step, no frozen row', () => {
    const hidden = makeProduct({ isHidden: true });
    const plan = generatePlan(makeInput([hidden]));
    expect(plan.periods.morning).toHaveLength(0);
    expect(plan.frozen).toHaveLength(0);
  });

  it('emits an SPF placeholder when a peel mandates SPF the shelf lacks', () => {
    const plain = makeProduct();
    const plan = generatePlan(makeInput([plain], { procedures: [PEEL] }));
    expect(plan.placeholders).toEqual([
      expect.objectContaining({ period: 'am', productTypes: ['spf'] }),
    ]);
  });

  it('caps a freshly added retinoid at 2 nights/week via adaptation (virtual count)', () => {
    // Added 3 days ago → virtual count 0 → phase 1 → maxDaysPerWeek 2
    const fresh = makeProduct({ activeTags: ['retinoid'], addedAt: '2026-07-01' });
    const plan = generatePlan(makeInput([fresh]));

    const step = plan.periods.evening.find((s) => s.productId === fresh.id);
    expect(step?.scheduledDays).toEqual([2, 6]);
    expect(plan.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'limit', reasonCode: 'adaptation_phase_1' }),
      ]),
    );
  });

  it('lifts the adaptation cap in dynamic mode once the tracked count passes eight', () => {
    const fresh = makeProduct({ activeTags: ['retinoid'], addedAt: '2026-07-01' });
    const plan = generatePlan(
      makeInput([fresh], {
        tracking: {
          cycleType: 'dynamic',
          applicationStats: [{ productId: fresh.id, count: 9, lastAppliedDate: '2026-07-03' }],
        },
      }),
    );
    const step = plan.periods.evening.find((s) => s.productId === fresh.id);
    expect(step?.scheduledDays).toEqual([]);
  });

  it('is deterministic — same input twice yields an identical plan', () => {
    const products = [
      makeProduct({ activeTags: ['retinoid'] }),
      makeProduct({ activeTags: ['aha'] }),
      makeProduct({ productType: 'spf' }),
    ];
    const input = makeInput(products, { procedures: [PEEL], profile: { fitzpatrick: 4, concerns: ['acne'] } });
    expect(generatePlan(input)).toEqual(generatePlan(input));
  });
});

// ─── validateRoutines ───────────────────────────────────────────────────────

describe('validateRoutines', () => {
  it('reports an avoid finding with rule copy for retinoid + AHA in one evening routine', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const aha = makeProduct({ activeTags: ['aha'] });
    const routines = [makeRoutine('evening', [makeStep(retinoid), makeStep(aha)])];
    const result = validateRoutines(routines, makeInput([retinoid, aha]));

    expect(result.hasBlockingFindings).toBe(true);
    expect(result.findings[0]).toEqual(
      expect.objectContaining({
        severity: 'avoid',
        ruleId: 'rule_retinol_aha',
        productIds: [retinoid.id, aha.id],
        explanation: expect.stringContaining('turnover'),
      }),
    );
  });

  it('does not flag day-separated steps of a conflicting pair', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const aha = makeProduct({ activeTags: ['aha'] });
    const routines = [
      makeRoutine('evening', [
        makeStep(retinoid, { scheduledDays: [0, 1, 3, 4, 5] }),
        makeStep(aha, { scheduledDays: [2, 6] }),
      ]),
    ];
    const result = validateRoutines(routines, makeInput([retinoid, aha]));
    expect(result.findings).toHaveLength(0);
    expect(result.hasBlockingFindings).toBe(false);
  });

  it('reports caution (non-blocking) for the vitamin C + niacinamide pair', () => {
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const niacinamide = makeProduct({ activeTags: ['niacinamide'] });
    const routines = [makeRoutine('morning', [makeStep(vitC), makeStep(niacinamide)])];
    const result = validateRoutines(routines, makeInput([vitC, niacinamide]));

    expect(result.findings[0].severity).toBe('caution');
    expect(result.hasBlockingFindings).toBe(false);
  });

  it('marks findings involving a pinned step so the UI knows it will not be auto-removed', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const aha = makeProduct({ activeTags: ['aha'] });
    const routines = [
      makeRoutine('evening', [makeStep(retinoid), makeStep(aha, { userPinned: true })]),
    ];
    const result = validateRoutines(routines, makeInput([retinoid, aha]));
    expect(result.findings[0].pinned).toBe(true);
  });

  it('flags a clinically frozen product sitting in a saved routine as avoid', () => {
    const aha = makeProduct({ activeTags: ['aha'] });
    const routines = [makeRoutine('evening', [makeStep(aha)])];
    const result = validateRoutines(routines, makeInput([aha], { procedures: [PEEL] }));
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'avoid', reasonCode: 'peel_rehab_no_exfoliants' }),
      ]),
    );
  });

  it('flags an unmet non-skippable SPF mandate as avoid (phototype 2 + photosensitizer)', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const routines = [makeRoutine('evening', [makeStep(retinoid)])];
    const result = validateRoutines(
      routines,
      makeInput([retinoid], { profile: { fitzpatrick: 2, concerns: [] } }),
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'avoid', reasonCode: 'phototype_uv_sensitivity_spf' }),
      ]),
    );
  });

  it('diffs the proposed plan against the saved state (added and moved)', () => {
    // Saved: vitC in the evening. Proposed: vitC moves to am; cleanser appears in both.
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const cleanser = makeProduct({ productType: 'cleanser' });
    const routines = [makeRoutine('evening', [makeStep(vitC)])];
    const result = validateRoutines(routines, makeInput([vitC, cleanser]));

    expect(result.diff).toEqual(
      expect.arrayContaining([
        { productId: vitC.id, kind: 'moved', from: 'evening', to: 'morning' },
        { productId: cleanser.id, kind: 'added', to: 'morning' },
        { productId: cleanser.id, kind: 'added', to: 'evening' },
      ]),
    );
  });

  it('diffs a clinically frozen saved product as frozen, not removed', () => {
    const aha = makeProduct({ activeTags: ['aha'] });
    const routines = [makeRoutine('evening', [makeStep(aha)])];
    const result = validateRoutines(routines, makeInput([aha], { procedures: [PEEL] }));
    expect(result.diff).toEqual([{ productId: aha.id, kind: 'frozen', from: 'evening' }]);
  });
});

// ─── findSubstitute ─────────────────────────────────────────────────────────

describe('findSubstitute', () => {
  it('returns the best same-slot, conflict-free candidate not already in the plan', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const niacinamide = makeProduct({ activeTags: ['niacinamide'], usageTime: 'evening' });
    const input = makeInput([retinoid, niacinamide]);
    const plan = generatePlan(makeInput([retinoid])); // plan holds only the retinoid

    const result = findSubstitute(plan, 'evening', retinoid.id, input);
    expect(result?.productId).toBe(niacinamide.id);
  });

  it('skips candidates that conflict with the rest of the period', () => {
    // Evening plan: retinoid + ceramide serum. Substituting the ceramide must
    // not offer AHA (conflicts with the remaining retinoid) — panthenol wins.
    // retinoid's productType is distinct from the default 'serum' so it
    // doesn't compete with ceramide/aha/panthenol for the serum slot under
    // the routine-similar-product-priority engine cap (this test is about
    // pair-rule-aware substitution, not slot competition) — aha/panthenol
    // must still share ceramide's real slot for the substitute lookup itself.
    const retinoid = makeProduct({ activeTags: ['retinoid'], productType: 'toner' });
    const ceramide = makeProduct({ activeTags: ['ceramides'] });
    const aha = makeProduct({ activeTags: ['aha'] });
    const panthenol = makeProduct({ activeTags: ['panthenol'], usageTime: 'evening' });
    const planInput = makeInput([retinoid, ceramide]);
    const plan = generatePlan(planInput);

    const result = findSubstitute(
      plan,
      'evening',
      ceramide.id,
      makeInput([retinoid, ceramide, aha, panthenol]),
    );
    expect(result?.productId).toBe(panthenol.id);
  });

  it('enforces the layering slot — a toner is never offered for a serum step', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const toner = makeProduct({ productType: 'toner', usageTime: 'evening' });
    const plan = generatePlan(makeInput([retinoid]));

    const result = findSubstitute(plan, 'evening', retinoid.id, makeInput([retinoid, toner]));
    expect(result).toBeNull();
  });

  it('returns null for an unknown step', () => {
    const plan = generatePlan(makeInput([makeProduct()]));
    expect(findSubstitute(plan, 'morning', 'nonexistent', makeInput([]))).toBeNull();
  });
});

// ─── getDailyView ───────────────────────────────────────────────────────────

describe('getDailyView', () => {
  function view(routines: Routine[], products: Product[], procedures: UserProcedureLog[] = []) {
    return getDailyView(routines, products, {
      procedures,
      profile: { fitzpatrick: null },
      seasonMask: { season: 'spring', source: 'calendar' },
      now: NOW,
    });
  }

  it('shows only steps scheduled for the date (2026-07-04 is a Saturday)', () => {
    const daily = makeProduct();
    const saturdayOnly = makeProduct();
    const mondayOnly = makeProduct();
    const routines = [
      makeRoutine('morning', [
        makeStep(daily),
        makeStep(saturdayOnly, { scheduledDays: [6] }),
        makeStep(mondayOnly, { scheduledDays: [1] }),
      ]),
    ];
    const [result] = view(routines, [daily, saturdayOnly, mondayOnly]);

    expect(result.date).toBe('2026-07-04');
    expect(result.steps.map((s) => s.productId)).toEqual([daily.id, saturdayOnly.id]);
  });

  it('skips hidden steps entirely', () => {
    const product = makeProduct();
    const routines = [makeRoutine('morning', [makeStep(product, { hidden: true })])];
    const [result] = view(routines, [product]);
    expect(result.steps).toHaveLength(0);
    expect(result.frozen).toHaveLength(0);
  });

  it('masks clinically frozen steps into the frozen list with the unfreeze date', () => {
    const aha = makeProduct({ activeTags: ['aha'] });
    const cleanser = makeProduct({ productType: 'cleanser' });
    const routines = [makeRoutine('evening', [makeStep(cleanser), makeStep(aha)])];
    const [result] = view(routines, [cleanser, aha], [PEEL]);

    expect(result.steps.map((s) => s.productId)).toEqual([cleanser.id]);
    expect(result.frozen).toEqual([
      expect.objectContaining({
        productId: aha.id,
        reasonCode: 'peel_rehab_no_exfoliants',
        until: '2026-07-18',
      }),
    ]);
  });

  it('masks frozen steps even when they are pinned — safety beats preference', () => {
    const aha = makeProduct({ activeTags: ['aha'] });
    const routines = [makeRoutine('evening', [makeStep(aha, { userPinned: true })])];
    const [result] = view(routines, [aha], [PEEL]);
    expect(result.steps).toHaveLength(0);
    expect(result.frozen).toHaveLength(1);
  });

  it('keeps steps whose product was deleted visible for the empty-slot UI', () => {
    const orphan = makeStep(makeProduct(), {});
    orphan.productId = 'deleted-product';
    const routines = [makeRoutine('morning', [orphan])];
    const [result] = view(routines, []);
    expect(result.steps).toHaveLength(1);
  });

  it('returns one view per routine with its timeOfDay', () => {
    const product = makeProduct();
    const routines = [makeRoutine('morning', [makeStep(product)]), makeRoutine('evening', [])];
    const results = view(routines, [product]);
    expect(results.map((r) => r.timeOfDay)).toEqual(['morning', 'evening']);
  });

  describe('dynamic cycling mask', () => {
    function dynamicView(
      routines: Routine[],
      products: Product[],
      cyclePhaseIndex: 0 | 1 | 2 | 3,
    ) {
      return getDailyView(routines, products, {
        procedures: [],
        profile: { fitzpatrick: null },
        seasonMask: { season: 'spring', source: 'calendar' },
        cycle: { type: 'dynamic', state: { cyclePhaseIndex, lastAppliedDate: null } },
        now: NOW,
      });
    }

    it('shows exfoliants and cycles out retinoids on an exfoliation night', () => {
      const retinoid = makeProduct({ activeTags: ['retinoid'] });
      const aha = makeProduct({ activeTags: ['aha'] });
      const cream = makeProduct({ productType: 'cream' });
      const routines = [makeRoutine('evening', [makeStep(retinoid), makeStep(aha), makeStep(cream)])];

      const [result] = dynamicView(routines, [retinoid, aha, cream], 0);

      expect(result.steps.map((s) => s.productId)).toEqual([aha.id, cream.id]);
      expect(result.cycledOut).toEqual([
        expect.objectContaining({ productId: retinoid.id, phase: 'exfoliation' }),
      ]);
    });

    it('cycles out every cycled active on a recovery night', () => {
      const retinoid = makeProduct({ activeTags: ['retinoid'] });
      const aha = makeProduct({ activeTags: ['aha'] });
      const routines = [makeRoutine('evening', [makeStep(retinoid), makeStep(aha)])];

      const [result] = dynamicView(routines, [retinoid, aha], 2);

      expect(result.steps).toHaveLength(0);
      expect(result.cycledOut).toHaveLength(2);
    });

    it('overrides weekday scheduling for cycled actives — the phase decides, not the calendar', () => {
      // Retinoid scheduled Mondays only, but tonight (Saturday) is retinoid night
      const retinoid = makeProduct({ activeTags: ['retinoid'] });
      const routines = [makeRoutine('evening', [makeStep(retinoid, { scheduledDays: [1] })])];

      const [result] = dynamicView(routines, [retinoid], 1);

      expect(result.steps.map((s) => s.productId)).toEqual([retinoid.id]);
    });

    it('leaves morning routines and non-cycled products untouched by the phase', () => {
      const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
      const routines = [makeRoutine('morning', [makeStep(vitC)])];

      const [result] = dynamicView(routines, [vitC], 2); // recovery night

      expect(result.steps).toHaveLength(1);
      expect(result.cycledOut).toHaveLength(0);
    });

    it('lets a clinical freeze win over the cycle mask', () => {
      // AHA on its own exfoliation night, but a peel freezes it → frozen, not cycledOut
      const aha = makeProduct({ activeTags: ['aha'] });
      const routines = [makeRoutine('evening', [makeStep(aha)])];
      const [result] = getDailyView(routines, [aha], {
        procedures: [PEEL],
        profile: { fitzpatrick: null },
        seasonMask: { season: 'spring', source: 'calendar' },
        cycle: { type: 'dynamic', state: { cyclePhaseIndex: 0, lastAppliedDate: null } },
        now: NOW,
      });

      expect(result.frozen).toHaveLength(1);
      expect(result.cycledOut).toHaveLength(0);
    });
  });
});
