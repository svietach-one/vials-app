/**
 * Draft Preview summary names re-added steps (spec Story 5 AC5; owner ruling
 * 2026-10-15: IMPROVE THE SUMMARY, do not soften the AC).
 *
 * The summary must ALWAYS say "N products added" when a save will bring back a
 * step the user removed or hid, including a step removed for only ONE weekday
 * and a hidden step being un-hidden, and it must not lose its other lines to
 * the old 3-line cap.
 *
 * ASSUMED signature (the existing name, one new trailing argument):
 *   buildDraftSummaryLines(plan, diff, products, routines?: Routine[]): string[]
 * `routines` are the SAVED routines; today's function cannot see them, and the
 * plan/diff pair alone cannot tell a one-weekday removal or an un-hide from "no
 * change" (validate.ts diffs visible steps by period membership only).
 * Calling a 3-parameter function with 4 arguments is the one expected `tsc` error here.
 */
import type { Routine } from '@/types';
import { generatePlan } from '@/utils/routineEngine/generate';
import { buildDraftSummaryLines } from '@/utils/routineEngine/planApply';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import { validateRoutines } from '@/utils/routineEngine/validate';
import { makeEngineInput, makeS3, resetFixtureCounters, routinesFromPlan, S3, shelfProduct } from './fixtures';

beforeEach(() => resetFixtureCounters());

const ADDED_1 = '1 product added';
const ADDED_2 = '2 products added';

function summarise(plan: RoutinePlan, saved: Routine[], products = makeS3()): string[] {
  const input = makeEngineInput(products);
  const diff = validateRoutines(saved, input).diff;
  return buildDraftSummaryLines(plan, diff, products, saved);
}

function withSteps(saved: Routine[], edit: (stepProductId: string, days: number[], hidden: boolean) => { days: number[]; hidden: boolean } | null) {
  return saved.map((r) => ({
    ...r,
    steps: r.steps.flatMap((s) => {
      const out = edit(s.productId ?? '', s.scheduledDays, s.hidden);
      return out === null ? [] : [{ ...s, scheduledDays: out.days, hidden: out.hidden }];
    }),
  }));
}

describe('a save that brings a step back says so', () => {
  const plan = () => generatePlan(makeEngineInput(makeS3()));

  it('names a step removed from BOTH routines (full removal)', () => {
    const saved = withSteps(routinesFromPlan(plan()), (id, days, hidden) => (id === S3.cream ? null : { days, hidden }));

    expect(summarise(plan(), saved)).toContain(ADDED_1);
  });

  it('names a step removed for only ONE weekday (the plan restores every day)', () => {
    const saved = withSteps(routinesFromPlan(plan()), (id, days, hidden) =>
      id === S3.cream ? { days: [1, 2, 3, 4, 5, 6], hidden } : { days, hidden },
    );

    expect(summarise(plan(), saved)).toContain(ADDED_1);
  });

  it('names a hidden step that the save will un-hide', () => {
    const saved = withSteps(routinesFromPlan(plan()), (id, days) => ({ days, hidden: id === S3.cream }));

    expect(summarise(plan(), saved)).toContain(ADDED_1);
  });

  it('counts several different re-added products together', () => {
    const saved = withSteps(routinesFromPlan(plan()), (id, days, hidden) => {
      if (id === S3.cream) return null;
      if (id === S3.spf) return { days: [1, 2, 3, 4, 5, 6], hidden };
      return { days, hidden };
    });

    expect(summarise(plan(), saved)).toContain(ADDED_2);
  });

  it('counts a product once even when it comes back in both periods', () => {
    const saved = withSteps(routinesFromPlan(plan()), (id, days, hidden) => (id === S3.cream ? null : { days, hidden }));

    const lines = summarise(plan(), saved);

    expect(lines.filter((l) => /product.* added/.test(l))).toEqual([ADDED_1]);
  });
});

describe('what the save does NOT bring back is not named', () => {
  it('says nothing when the saved routine already matches the plan', () => {
    const p = generatePlan(makeEngineInput(makeS3()));

    expect(summarise(p, routinesFromPlan(p)).filter((l) => /added/.test(l))).toEqual([]);
  });

  it('does not name a removed step whose product the plan does not schedule', () => {
    const products = [...makeS3(), shelfProduct('oil', 'Face Oil', 'oil')]; // oil stays in reserve
    const p = generatePlan(makeEngineInput(products));
    const saved = routinesFromPlan(p); // oil has no step at all

    expect(summarise(p, saved, products).filter((l) => /added/.test(l))).toEqual([]);
  });
});

describe('the added line is never crowded out by the other summary lines', () => {
  it('keeps the day-split, paused and reserve lines AND the added line together', () => {
    const base = generatePlan(makeEngineInput(makeS3()));
    const crowded: RoutinePlan = {
      ...base,
      decisions: [...base.decisions, { action: 'day_split', productId: S3.cleanser, reasonCode: 'retinoid_acid_conflict' }],
      frozen: [{ productId: 'x-paused', reasonCode: 'peel_rehab_no_exfoliants', until: '2026-07-18', overridesPin: true }],
      reserve: [{ productId: 'x-reserve', reasonCode: 'not_needed_for_goals' }],
    };
    const saved = withSteps(routinesFromPlan(base), (id, days, hidden) => (id === S3.cream ? null : { days, hidden }));

    const lines = summarise(crowded, saved);

    expect(lines).toContain(ADDED_1);
    expect(lines.some((l) => /alternate nights/.test(l))).toBe(true);
    expect(lines.some((l) => /paused until/.test(l))).toBe(true);
    expect(lines.some((l) => /kept in reserve/.test(l))).toBe(true);
  });
});
