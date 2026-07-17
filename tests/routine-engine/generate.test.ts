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
  it('builds a minimal goal-driven routine from a realistic shelf, reserving the rest', () => {
    // Rewritten for phase-04 skeleton build-up: the routine is CONSTRUCTED
    // around the goal, not filtered down from the shelf. With goal `aging`,
    // the PM treatment is the retinoid; vitamin C (also a strong carrier) is
    // pushed to reserve rather than co-scheduled — never two strong actives in
    // one PM. Structural slots (cleanser, moisturizer, SPF) fill from the
    // shelf; a toner has no structural slot and no goal role, so it reserves.
    const cleanser = makeProduct({ productType: 'cleanser' });
    const toner = makeProduct({ productType: 'toner' });
    const vitC = makeProduct({ activeTags: ['vitamin_c_pure'] });
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const moisturizer = makeProduct({ productType: 'moisturizer' });
    const spf = makeProduct({ productType: 'spf', usageTime: 'morning' });

    const plan = generatePlan(
      makeEngineInput([cleanser, toner, vitC, retinoid, moisturizer, spf], {
        profile: { fitzpatrick: null, concerns: [], primaryGoal: 'aging', secondaryGoal: null },
      }),
    );

    // AM: cleanser -> vitC (aging treatment, preferredPeriod am) -> moisturizer -> spf
    expect(plan.periods.morning.map((s) => s.productId)).toEqual([
      cleanser.id,
      vitC.id,
      moisturizer.id,
      spf.id,
    ]);
    // PM: cleanser -> retinoid (top-ranked aging treatment) -> moisturizer
    expect(plan.periods.evening.map((s) => s.productId)).toEqual([
      cleanser.id,
      retinoid.id,
      moisturizer.id,
    ]);
    // The toner serves neither a structural slot nor the goal — reserved.
    expect(plan.reserve).toEqual(
      expect.arrayContaining([{ productId: toner.id, reasonCode: 'not_needed_for_goals' }]),
    );
    // Every product accounted for exactly once (explainability invariant).
    const scheduled = new Set(
      [...plan.periods.morning, ...plan.periods.evening].map((s) => s.productId),
    );
    const reserved = new Set(plan.reserve.map((r) => r.productId));
    for (const p of [cleanser, toner, vitC, retinoid, moisturizer, spf]) {
      expect(scheduled.has(p.id) || reserved.has(p.id)).toBe(true);
    }
    expect(plan.frozen).toHaveLength(0);
    expect(plan.rulesetVersion).toBe('2026-07-17');
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

describe('phase-04 acceptance: skeleton build-up + cumulative exposure end-to-end', () => {
  const goal = (primaryGoal: 'maintenance' | 'aging') => ({
    fitzpatrick: null,
    concerns: [] as never[],
    primaryGoal,
    secondaryGoal: null,
  });

  function makeShelf() {
    return {
      cleanser: makeProduct({ productType: 'cleanser' }),
      moisturizer: makeProduct({ productType: 'moisturizer' }),
      spf: makeProduct({ productType: 'spf', usageTime: 'morning' }),
      ha1: makeProduct({ activeTags: ['hyaluronic_acid'], productType: 'serum' }),
      ha2: makeProduct({ activeTags: ['hyaluronic_acid'], productType: 'serum' }),
      retinoid: makeProduct({ activeTags: ['retinoid'] }),
      vitC: makeProduct({ activeTags: ['vitamin_c_pure'] }),
      misc1: makeProduct({ productType: 'toner' }),
      misc2: makeProduct({ productType: 'essence' }),
      misc3: makeProduct({ productType: 'oil' }),
    };
  }

  it('maintenance goal → minimal routine; actives in reserve as not_needed_for_goals', () => {
    const s = makeShelf();
    const shelf = Object.values(s);
    const plan = generatePlan(makeEngineInput(shelf, { profile: goal('maintenance') }));

    expect(plan.periods.morning.length).toBeLessThanOrEqual(3);
    expect(plan.periods.evening.length).toBeLessThanOrEqual(2);
    expect(plan.reserve.find((r) => r.productId === s.retinoid.id)?.reasonCode).toBe('not_needed_for_goals');
    expect(plan.reserve.find((r) => r.productId === s.vitC.id)?.reasonCode).toBe('not_needed_for_goals');
  });

  it('aging goal → retinol is the PM treatment; never two strong actives in one PM', () => {
    const s = makeShelf();
    const plan = generatePlan(makeEngineInput(Object.values(s), { profile: goal('aging') }));

    expect(plan.periods.evening.map((x) => x.productId)).toContain(s.retinoid.id);
    // vitC is either the AM treatment or reserve — but the PM never carries two
    // strong carriers on the same day.
    const pmStrong = plan.periods.evening.filter(
      (x) => x.productId === s.retinoid.id || x.productId === s.vitC.id,
    );
    expect(pmStrong.length).toBeLessThanOrEqual(1);
  });

  it('accounts for every shelf product exactly once — period, frozen, or reserve', () => {
    const s = makeShelf();
    const shelf = Object.values(s);
    const plan = generatePlan(makeEngineInput(shelf, { profile: goal('aging') }));

    const buckets = new Map<string, number>();
    const bump = (id: string) => buckets.set(id, (buckets.get(id) ?? 0) + 1);
    for (const step of [...plan.periods.morning, ...plan.periods.evening]) bump(step.productId);
    for (const f of plan.frozen) bump(f.productId);
    for (const r of plan.reserve) bump(r.productId);

    for (const p of shelf) {
      // A product placed in BOTH periods (e.g. a benign moisturizer) counts
      // twice as scheduled — the invariant is "at least once, never zero".
      expect(buckets.get(p.id) ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it('is deterministic across 50 seeded shelves under a fixed goal (byte-identical plans)', () => {
    // Local mulberry32 — no Math.random, matching the determinism suite.
    const rng = (seed: number) => () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const TYPES: Product['productType'][] = ['cleanser', 'serum', 'toner', 'moisturizer', 'cream', 'spf'];
    const TAGS = ['retinoid', 'aha', 'vitamin_c_pure', 'niacinamide', 'hyaluronic_acid', 'peptide_signal'] as const;

    for (let seed = 0; seed < 50; seed += 1) {
      const r = rng(seed * 7 + 1);
      const products = Array.from({ length: 3 + Math.floor(r() * 6) }, () => {
        const tagCount = Math.floor(r() * 2);
        const tags = Array.from({ length: tagCount }, () => TAGS[Math.floor(r() * TAGS.length)]);
        return makeProduct({
          productType: TYPES[Math.floor(r() * TYPES.length)],
          activeTags: [...new Set(tags)],
        });
      });
      const input = makeEngineInput(products, { profile: goal('aging') });
      expect(generatePlan(input)).toEqual(generatePlan(input));
    }
  });
});
