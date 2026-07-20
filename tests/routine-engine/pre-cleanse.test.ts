/**
 * Pre-cleanse slot ruling (deviation-by-ruling 2026-07-19): a surfactant-based
 * makeup/SPF remover (micellar water, cleansing oil/balm) is NOT a standalone
 * cleanse. It occupies a distinct PM-only `pre_cleanse` slot ordered before the
 * cleanse step, never satisfies the cleanse slot itself, and requires a gentle
 * rinse-off cleanser after it. See docs/specs/routine-engine-v2.1/phase-04-*.
 *
 * The stepNote follow-up ruling (2026-07-19, same day) makes the rinse-off
 * requirement visible at EXECUTION time, not just planning: a contextual
 * instruction attached to the micellar step when a cleanser is also
 * scheduled; when no cleanser exists, the unmet-placeholder mechanism from
 * the first ruling is the sole communication channel — no fallback text.
 *
 * These are the ruling's acceptance scenarios, exercised end-to-end through
 * generatePlan (and, for the note, through the save path too).
 */
import { STEP_NOTE_TEXT } from '@/constants/decisionReasons';
import { generatePlan } from '@/utils/routineEngine/generate';
import { buildStepsFromPlan } from '@/utils/routineEngine/planApply';
import { makeEngineInput, makeProduct, NOW, resetFixtureCounters } from './fixtures';

beforeEach(() => resetFixtureCounters());

const ids = (steps: { productId: string }[]) => steps.map((s) => s.productId);

describe('pre_cleanse slot: micellar water is a pre-cleanse, not a cleanse', () => {
  it('micellar-only shelf → no AM cleanse; PM shows micellar + a cleanser placeholder', () => {
    const micellar = makeProduct({ name: 'Micellar Water', productType: 'makeup_remover' });
    const plan = generatePlan(makeEngineInput([micellar], { now: NOW }));

    // AM has no cleanse step — the makeup remover never fills it, and it is PM-only.
    expect(ids(plan.periods.morning)).not.toContain(micellar.id);
    expect(plan.periods.morning).toHaveLength(0);

    // PM schedules the micellar as the pre-cleanse step…
    expect(ids(plan.periods.evening)).toContain(micellar.id);

    // …and the cleanse slot is unmet: a placeholder demands a gentle cleanser.
    expect(plan.placeholders).toContainEqual(
      expect.objectContaining({
        period: 'pm',
        productTypes: ['cleanser'],
        reasonCode: 'pre_cleanse_requires_followup',
      }),
    );
  });

  it('micellar + gentle foam cleanser → PM: micellar then foam; AM: foam only; no placeholder', () => {
    const micellar = makeProduct({ name: 'Micellar Water', productType: 'makeup_remover' });
    const foam = makeProduct({ name: 'Gentle Foaming Cleanser', productType: 'cleanser' });
    const plan = generatePlan(makeEngineInput([micellar, foam], { now: NOW }));

    // PM carries both, micellar (pre_cleanse) ordered before foam (cleanse).
    const pm = ids(plan.periods.evening);
    expect(pm).toContain(micellar.id);
    expect(pm).toContain(foam.id);
    expect(pm.indexOf(micellar.id)).toBeLessThan(pm.indexOf(foam.id));

    // AM has the rinse-off cleanser only — the makeup remover is PM-only.
    expect(ids(plan.periods.morning)).toEqual([foam.id]);

    // The cleanse slot is satisfied by the foam, so no follow-up placeholder.
    expect(plan.placeholders.map((p) => p.reasonCode)).not.toContain('pre_cleanse_requires_followup');
  });

  it('a "Micellar Cleansing Water" mistyped as cleanser in the DB is reclassified', () => {
    // Same behavior as scenario 1 despite the wrong productType.
    const mistyped = makeProduct({ name: 'Micellar Cleansing Water', productType: 'cleanser' });
    const plan = generatePlan(makeEngineInput([mistyped], { now: NOW }));

    expect(plan.periods.morning).toHaveLength(0);
    expect(ids(plan.periods.evening)).toContain(mistyped.id);
    // Reclassified → the scheduled step reads as a makeup remover, not a cleanser.
    expect(plan.periods.evening.find((s) => s.productId === mistyped.id)?.productType).toBe(
      'makeup_remover',
    );
    expect(plan.placeholders).toContainEqual(
      expect.objectContaining({
        period: 'pm',
        productTypes: ['cleanser'],
        reasonCode: 'pre_cleanse_requires_followup',
      }),
    );
  });
});

describe('pre_cleanse follow-up note (stepNote): visible at execution, not just planning', () => {
  it('micellar-only shelf → the PM micellar step carries NO note (placeholder is the sole mechanism)', () => {
    const micellar = makeProduct({ name: 'Micellar Water', productType: 'makeup_remover' });
    const plan = generatePlan(makeEngineInput([micellar], { now: NOW }));

    const step = plan.periods.evening.find((s) => s.productId === micellar.id);
    // No fallback instruction (e.g. "rinse with water") is ever substituted —
    // the note is exactly null, not some other string.
    expect(step?.stepNote ?? null).toBeNull();
  });

  it('micellar + gentle foam cleanser → the micellar step carries the follow-with-cleanser note', () => {
    const micellar = makeProduct({ name: 'Micellar Water', productType: 'makeup_remover' });
    const foam = makeProduct({ name: 'Gentle Foaming Cleanser', productType: 'cleanser' });
    const plan = generatePlan(makeEngineInput([micellar, foam], { now: NOW }));

    const micellarStep = plan.periods.evening.find((s) => s.productId === micellar.id);
    const foamStep = plan.periods.evening.find((s) => s.productId === foam.id);
    expect(micellarStep?.stepNote).toBe(STEP_NOTE_TEXT.pre_cleanse_follow_with_cleanser);
    // The note lives only on the pre-cleanse step, not on every PM step.
    expect(foamStep?.stepNote ?? null).toBeNull();
  });

  it('a non-pre_cleanse step never carries a note (foam-only shelf)', () => {
    const foam = makeProduct({ name: 'Gentle Foaming Cleanser', productType: 'cleanser' });
    const plan = generatePlan(makeEngineInput([foam], { now: NOW }));

    expect(plan.periods.morning.find((s) => s.productId === foam.id)?.stepNote ?? null).toBeNull();
    expect(plan.periods.evening.find((s) => s.productId === foam.id)?.stepNote ?? null).toBeNull();
  });

  it('determinism: regenerating the same shelf twice yields the identical note (or its absence)', () => {
    const micellar = makeProduct({ name: 'Micellar Water', productType: 'makeup_remover' });
    const foam = makeProduct({ name: 'Gentle Foaming Cleanser', productType: 'cleanser' });
    const input = makeEngineInput([micellar, foam], { now: NOW });

    const first = generatePlan(input);
    const second = generatePlan(input);
    expect(second).toEqual(first); // stepNote is part of the plan snapshot the hash covers.
  });

  it('the note survives the save path onto the persisted RoutineStep', () => {
    const micellar = makeProduct({ name: 'Micellar Water', productType: 'makeup_remover' });
    const foam = makeProduct({ name: 'Gentle Foaming Cleanser', productType: 'cleanser' });
    const plan = generatePlan(makeEngineInput([micellar, foam], { now: NOW }));

    let idCounter = 0;
    const savedSteps = buildStepsFromPlan(plan.periods.evening, [], plan.frozen, () => `s${idCounter++}`);
    const savedMicellar = savedSteps.find((s) => s.productId === micellar.id);
    expect(savedMicellar?.stepNote).toBe(STEP_NOTE_TEXT.pre_cleanse_follow_with_cleanser);
  });
});

describe('pre_cleanse + note/placeholder reconciliation (review follow-up, 2026-07-20)', () => {
  // The note and the placeholder previously answered "is there a cleanser"
  // from DIFFERENT pipeline stages: the placeholder checked skeleton-time
  // (pre-admission) candidacy, the note checked resolved (post-admission)
  // existence with no day-overlap check. A cleanser carrying an active that
  // collides with a co-scheduled treatment can be day-split by the SAME
  // pair-rule ladder every other candidate goes through (rinse-off products
  // are NOT exempt from pair-rule matching, only from the cumulative cap) —
  // which used to produce BOTH a false-positive note (shown on days the
  // cleanser doesn't actually run) AND a false-negative placeholder
  // (suppressed because a cleanser candidate existed pre-admission). Both
  // now derive from one shared post-admission coverage predicate.
  it('a day-split cleanser that does not cover every day of the pre_cleanse step: no note, placeholder fires', () => {
    const micellar = makeProduct({ name: 'Micellar Water', productType: 'makeup_remover' });
    const bhaCleanser = makeProduct({
      name: 'BHA Cleanser',
      productType: 'cleanser',
      activeTags: ['bha'],
    });
    const retinoid = makeProduct({ name: 'Retinoid Serum', activeTags: ['retinoid'] });
    const plan = generatePlan(
      makeEngineInput([micellar, bhaCleanser, retinoid], {
        now: NOW,
        profile: { fitzpatrick: null, concerns: [], primaryGoal: 'aging', secondaryGoal: null },
      }),
    );

    const cleanserStep = plan.periods.evening.find((s) => s.productId === bhaCleanser.id);
    const micellarStep = plan.periods.evening.find((s) => s.productId === micellar.id);
    // Sanity: the scenario actually produces a day-split, non-full-coverage
    // cleanser — otherwise this test would be vacuous.
    expect(cleanserStep?.scheduledDays.length).toBeGreaterThan(0);
    expect(micellarStep?.scheduledDays).toEqual([]); // every day

    // No misleading note — the cleanser does not run every day the micellar does.
    expect(micellarStep?.stepNote ?? null).toBeNull();
    // The placeholder is the mechanism instead — it must fire, not be
    // suppressed by the pre-admission "a cleanser candidate exists" view.
    expect(plan.placeholders).toContainEqual(
      expect.objectContaining({ period: 'pm', reasonCode: 'pre_cleanse_requires_followup' }),
    );
  });

  it('a cleanser scheduled on every day (empty scheduledDays) fully covers a partially-scheduled pre_cleanse step', () => {
    // Coverage direction check: the cleanser side, not the pre_cleanse side,
    // is what must be "every day or a superset" — confirms scheduleFullyCovers
    // isn't accidentally checking the relationship backwards.
    const micellar = makeProduct({
      name: 'Micellar Water',
      productType: 'makeup_remover',
      usageTime: 'evening',
    });
    const foam = makeProduct({ name: 'Gentle Foaming Cleanser', productType: 'cleanser' });
    const plan = generatePlan(makeEngineInput([micellar, foam], { now: NOW }));

    const micellarStep = plan.periods.evening.find((s) => s.productId === micellar.id);
    expect(micellarStep?.stepNote).toBe(STEP_NOTE_TEXT.pre_cleanse_follow_with_cleanser);
    expect(plan.placeholders.map((p) => p.reasonCode)).not.toContain('pre_cleanse_requires_followup');
  });
});
