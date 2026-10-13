/**
 * Integration test — Story 5 (spec §4 Story 5): once the retinoid/AHA pair
 * is genuinely split across non-overlapping `scheduledDays`, the existing
 * day-level conflict machinery must show no warning on any day. This is a
 * REGRESSION check against already-shipped behavior, per the kickoff's item
 * 4 — no new conflictEngine.ts/resolve.ts logic is added by this task, this
 * only proves the existing seam already does the right thing for the new
 * schedules FE-3/FE-4 will produce.
 *
 * The real "no stale warning" mechanism is two-layered, both pre-existing:
 *  1. `rule_retinol_aha`/`rule_retinol_bha` are `resolutionScope: 'day'`
 *     (unaffected by the sibling conflict-resolution-scope task — see
 *     tests/conflict-resolution-scope/pair-rules-day-scope-regression.test.ts),
 *     so `ConflictEngine.detectConflicts` itself does NOT filter by
 *     scheduledDays or period at all for this pair — it fires for any two
 *     visible steps handed to it, unconditionally.
 *  2. The day-filtering actually happens one layer up, at the CALLER
 *     (RoutinesScreen.tsx's `isStepForDay`/`isVisible`, mirrored here via
 *     `isScheduledOnDay`): only steps scheduled for the day actually being
 *     viewed are ever included in the array passed to `detectConflicts`. Two
 *     steps on non-overlapping days are therefore never in the same
 *     `detectConflicts` call together, for any day of the week.
 * This file exercises layer 2 directly (the real seam Story 5 is about),
 * plus a sanity check that layer 1 would still correctly fire if the split
 * were ever removed (proving the test isn't vacuous).
 *
 * Spec: docs/specs/day-split-alternation.md §4 Story 5
 * Tech design: docs/tech-design/day-split-alternation.md (Non-Goal: no new
 * conflict-engine logic)
 *
 * Unlike every other file in this suite, this one is NOT expected to fail
 * red before the engineer's implementation — it exercises only
 * already-shipped code (`ConflictEngine`, `isScheduledOnDay`) against
 * `scheduledDays` shapes FE-3 will produce, so it should already be GREEN
 * today. A red result here before FE-1..FE-4 ship is itself a signal worth
 * escalating to planner, not silently reclassifying as expected.
 */
import { ConflictEngine, type ConflictStepInput } from '@/utils/conflictEngine';
import { isScheduledOnDay } from '@/utils/routineSchedule';
import { AHA, BHA, RETINOID, makeStep, resetFixtureCounters } from './fixtures';

beforeEach(() => resetFixtureCounters());

const ALL_DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6];

function detectConflictsForDay(steps: ConflictStepInput[], dow: number) {
  const visibleToday = steps.filter((s) => isScheduledOnDay(s.scheduledDays, dow));
  return ConflictEngine.detectConflicts(visibleToday, [RETINOID, AHA, BHA]);
}

describe('Story 5: no stale conflict warning once retinoid/AHA are on non-overlapping scheduledDays', () => {
  it('rule_retinol_aha still fires unconditionally when both steps are visible the same day (sanity: the rule is real, this pair is not silently exempt)', () => {
    const sameDayConflicts = ConflictEngine.detectConflicts(
      [
        { ...makeStep(RETINOID.id, { scheduledDays: [1] }), period: 'pm' },
        { ...makeStep(AHA.id, { scheduledDays: [1] }), period: 'pm' },
      ],
      [RETINOID, AHA],
    );
    expect(sameDayConflicts).toHaveLength(1);
    expect(sameDayConflicts[0]?.rule.id).toBe('rule_retinol_aha');
  });

  it('shows zero conflicts on every day of the week once split onto [Tue, Sat] vs [Mon, Thu]', () => {
    const steps: ConflictStepInput[] = [
      { ...makeStep(RETINOID.id, { scheduledDays: [2, 6] }), period: 'pm' },
      { ...makeStep(AHA.id, { scheduledDays: [1, 4] }), period: 'pm' },
    ];

    for (const dow of ALL_DAYS_OF_WEEK) {
      expect(detectConflictsForDay(steps, dow)).toEqual([]);
    }
  });

  it('shows zero conflicts on every day of the week for the retinoid/BHA pairing too (same rule family, both cycleClass: exfoliant)', () => {
    const steps: ConflictStepInput[] = [
      { ...makeStep(RETINOID.id, { scheduledDays: [2, 6] }), period: 'pm' },
      { ...makeStep(BHA.id, { scheduledDays: [1, 4] }), period: 'pm' },
    ];

    for (const dow of ALL_DAYS_OF_WEEK) {
      expect(detectConflictsForDay(steps, dow)).toEqual([]);
    }
  });

  it('never has both products visible on the same day at once, for any day — the structural reason no warning is possible', () => {
    const retinoidDays = [2, 6];
    const ahaDays = [1, 4];

    for (const dow of ALL_DAYS_OF_WEEK) {
      const retinoidVisible = isScheduledOnDay(retinoidDays, dow);
      const ahaVisible = isScheduledOnDay(ahaDays, dow);
      expect(retinoidVisible && ahaVisible).toBe(false);
    }
  });

  it('still warns if the split is ever misconfigured with an overlapping day (regression tripwire, not a feature of this task)', () => {
    const steps: ConflictStepInput[] = [
      { ...makeStep(RETINOID.id, { scheduledDays: [2, 4] }), period: 'pm' },
      { ...makeStep(AHA.id, { scheduledDays: [1, 4] }), period: 'pm' },
    ];

    expect(detectConflictsForDay(steps, 4)).toHaveLength(1);
  });
});
