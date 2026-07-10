/**
 * Integration tests — Story 1: Generate a routine
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 1
 *
 * Exercises `generatePlan` (engine public surface) against a realistic,
 * multi-product shelf combining several classes/layering slots at once —
 * cross-module behaviour, not a re-test of a single pipeline stage (those are
 * covered by the engineer's co-located unit tests in src/utils/routineEngine).
 *
 * AC-1 (empty-state / generate-card copy) and AC-2 (bottom Optimize strip) are
 * UI-only (FE-8) — activated as RoutinesScreen component tests in
 * tests/routine-engine/routines-screen-generation-ux.test.tsx.
 */
import type { Product } from '@/types';
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  daysOverlap,
  makeEngineInput,
  makeProduct,
  NOW,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 1 AC: generate builds a complete, conflict-free AM/PM draft from the shelf', () => {
  it('assembles a realistic multi-product shelf into layering-ordered AM and PM periods', () => {
    const cleanser = makeProduct({ productType: 'cleanser' });
    const toner = makeProduct({ productType: 'toner' });
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const niacinamide = makeProduct({ activeTags: ['niacinamide'] });
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const hyaluronic = makeProduct({ activeTags: ['hyaluronic_acid'] });
    const moisturizer = makeProduct({ productType: 'moisturizer' });
    const spf = makeProduct({ productType: 'spf', usageTime: 'morning' });

    const plan = generatePlan(
      makeEngineInput([cleanser, toner, vitC, niacinamide, retinoid, hyaluronic, moisturizer, spf]),
    );

    // Morning: cleanser -> toner -> vitC (treatment, preferredPeriod am) -> hyaluronic
    // (benign, irritancy 0, renders every allowed period) -> moisturizer -> spf (always last).
    // niacinamide is irritancy 1 (a "treatment" per isTreatment) with no declared
    // preferredPeriod, so its single placement defaults to PM, not AM.
    expect(plan.periods.morning.map((s) => s.productId)).toEqual([
      cleanser.id,
      toner.id,
      vitC.id,
      hyaluronic.id,
      moisturizer.id,
      spf.id,
    ]);
    // Evening: cleanser -> toner -> {niacinamide, retinoid} (both pm-default
    // treatments, equal admission score -> tie-break on product id ascending,
    // niacinamide's id sorts first here) -> hyaluronic -> moisturizer.
    expect(plan.periods.evening.map((s) => s.productId)).toEqual([
      cleanser.id,
      toner.id,
      niacinamide.id,
      retinoid.id,
      hyaluronic.id,
      moisturizer.id,
    ]);
    expect(plan.frozen).toHaveLength(0);
    expect(plan.rulesetVersion).toBe('2026-07-04');
  });

  it('never places a retinoid and an AHA product in the same period on the same day', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const aha = makeProduct({ activeTags: ['aha'] });
    const plan = generatePlan(makeEngineInput([retinoid, aha]));

    for (const period of [plan.periods.morning, plan.periods.evening]) {
      const inPeriod = period.filter((s) => s.productId === retinoid.id || s.productId === aha.id);
      if (inPeriod.length < 2) continue;
      const [a, b] = inPeriod;
      expect(daysOverlap(a.scheduledDays, b.scheduledDays)).toBe(false);
    }
  });

  it('does not mutate the input products or procedures arrays (pure function, no store write)', () => {
    const products: Product[] = [
      makeProduct({ activeTags: ['retinoid'] }),
      makeProduct({ activeTags: ['aha'] }),
    ];
    const snapshot = JSON.parse(JSON.stringify(products));
    const input = makeEngineInput(products);

    generatePlan(input);

    expect(products).toEqual(snapshot);
    expect(input.products).toBe(products); // same reference — the caller's array is untouched
  });

  it('returns an empty draft (no steps, no frozen rows) for an empty shelf, so the UI can show the empty state', () => {
    const plan = generatePlan(makeEngineInput([]));
    expect(plan.periods.morning).toHaveLength(0);
    expect(plan.periods.evening).toHaveLength(0);
    expect(plan.frozen).toHaveLength(0);
  });

  it('stamps the plan with the skincare date it was generated for', () => {
    const plan = generatePlan(makeEngineInput([makeProduct()], { now: NOW }));
    expect(plan.generatedFor).toBe('2026-07-04');
  });
});

// Story 1 UI ACs (empty-state Generate card, bottom Optimize strip, header
// pencil limited to manual reorder/delete) are activated as RoutinesScreen
// component tests in tests/routine-engine/routines-screen-generation-ux.test.tsx
// now that FE-8 has shipped the real wiring (progress/routine-engine.md,
// 2026-07-05 "GENERATION UX" entry) — kept out of this file since they need
// @testing-library/react-native rendering, not a plain generatePlan call.
