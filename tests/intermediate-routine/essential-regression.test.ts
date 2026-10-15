/**
 * Regression contract: Essential == today's engine (spec G6, Story 6 AC2).
 *
 * The oracle is essential-plans.golden.json, captured from the engine at
 * origin/dev 5ed283f BEFORE any intermediate-routine production code existed
 * (see its _meta block and golden/regenerate-essential-golden.test.ts).
 * It is NOT a snapshot of this task's output: a mismatch means Essential moved.
 *
 * Only two things are normalised, both named in the spec: the one relabelled
 * reserve reason (outside_routine_depth -> not_needed_for_goals) and the
 * ruleset version stamp (FE-6 bumps it for the new enzyme class).
 *
 * This suite is expected to PASS today (the engine ignores `depth`, so it is
 * Essential) and must STAY green through the whole implementation.
 */
import goldenFile from './golden/essential-plans.golden.json';
import { generatePlan } from '@/utils/routineEngine/generate';
import type { EngineInput } from '@/utils/routineEngine/generate';
import { normaliseEssentialPlan, resetFixtureCounters, reviveEngineInput } from './fixtures';
import { makeDepthInput } from './fixtures';

type GoldenCase = { seed: number; input: EngineInput & { now: string }; plan: unknown };
const golden = goldenFile as unknown as {
  _meta: { capturedFromCommit: string; cases: number };
  cases: GoldenCase[];
};

beforeEach(() => resetFixtureCounters());

describe('Essential style reproduces the engine as it was before Balanced existed', () => {
  it('records which commit the oracle was captured from', () => {
    expect(golden._meta.capturedFromCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(golden.cases).toHaveLength(golden._meta.cases);
    expect(golden.cases.length).toBeGreaterThanOrEqual(600);
  });

  it('yields the identical plan for all 600 stored shelves once the one relabelled reason is normalised', () => {
    const mismatches: number[] = [];
    for (const c of golden.cases) {
      const input = reviveEngineInput(c.input);
      const actual = normaliseEssentialPlan(generatePlan(makeDepthInput(input.products, 'essential', input)));
      if (JSON.stringify(actual) !== JSON.stringify(c.plan)) mismatches.push(c.seed);
    }
    expect(mismatches).toEqual([]);
  });

  it('is not a vacuous corpus: many stored shelves hold a toner or eye cream the Essential plan keeps in reserve', () => {
    let withReservedToneOrEye = 0;
    for (const c of golden.cases) {
      const plan = c.plan as { reserve: { productId: string }[] };
      const byId = new Map(c.input.products.map((p) => [p.id, p.productType]));
      if (plan.reserve.some((r) => ['toner', 'eye_cream'].includes(byId.get(r.productId) ?? ''))) withReservedToneOrEye += 1;
    }
    expect(withReservedToneOrEye).toBeGreaterThan(150);
  });

  it('keeps the Essential reserve reason for a toner the style leaves out under its new name', () => {
    // The relabel is the ONLY permitted difference, so prove it happens: on the
    // stored shelves, every reserve row the oracle calls not_needed_for_goals for a
    // TAGLESS toner/eye cream must read outside_routine_depth in a fresh Essential
    // plan. (A toner carrying an active may sit in the treatment pool instead, and
    // which reason it then gets is not pinned by the spec - see report finding.)
    let checked = 0;
    for (const c of golden.cases.slice(0, 200)) {
      const input = reviveEngineInput(c.input);
      const tagless = new Map(
        input.products.filter((p) => (p.activeTags ?? []).length === 0).map((p) => [p.id, p.productType]),
      );
      const fresh = generatePlan(makeDepthInput(input.products, 'essential', input));
      const oracle = c.plan as { reserve: { productId: string; reasonCode: string }[] };
      for (const row of oracle.reserve) {
        if (!['toner', 'eye_cream'].includes(tagless.get(row.productId) ?? '')) continue;
        if (row.reasonCode !== 'not_needed_for_goals') continue;
        const now = fresh.reserve.find((r) => r.productId === row.productId);
        expect(now?.reasonCode).toBe('outside_routine_depth');
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});
