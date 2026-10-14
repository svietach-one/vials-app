/**
 * Integration tests — Stories 1 and 3 (engine half): `generatePlan` end to
 * end (skeleton.ts detection -> resolve.ts admission -> generate.ts
 * assembly), the same cross-module boundary tests/routine-engine/generate.ts
 * already exercises for this pipeline. Individual pipeline-stage behaviour
 * (skeleton.ts's tiebreak internals, resolve.ts's admission-loop branch,
 * cycleSplit.ts's pure day math) is the engineer's co-located unit-test
 * territory (skeleton.test.ts, resolve.test.ts, cycleSplit.test.ts per tech
 * design FE-7/FE-8) — this file only proves the PUBLIC entry point behaves
 * per spec when the stages cooperate.
 *
 * Spec: docs/specs/day-split-alternation.md §4 Stories 1, 3
 * Tech design: docs/tech-design/day-split-alternation.md (FE-1..FE-4)
 *
 * Written BEFORE the engineer's implementation. Two failure modes are both
 * EXPECTED until FE-1..FE-4 ship:
 *  - `tsc --noEmit` errors on any access to `ReserveItem.rivalOfProductId`/
 *    `.period` or the `'cycle_class_rival'` reasonCode literal (fields/union
 *    member don't exist yet — see ./fixtures.ts header).
 *  - Runtime assertion failures on every "both admitted, non-overlapping
 *    days" test: TODAY, `pickTreatment`/`attemptDaySplit` collide (both
 *    compute the same Tue/Sat preferred days) and the override-forced rival
 *    FREEZES instead of being admitted — the exact defect this feature
 *    fixes (see progress/day-split-alternation.md planner log).
 */
import type { RoutineStep } from '@/types';
import { generatePlan } from '@/utils/routineEngine/generate';
import { buildStepsFromPlan } from '@/utils/routineEngine/planApply';
import {
  AHA,
  BHA,
  BHA_SECONDARY,
  RETINOID,
  cycleRivalProfile,
  makeEngineInput,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

// ─── Story 1: detection ───────────────────────────────────────────────────────

describe('Story 1 AC1: the losing cross-cycleClass product is tagged cycle_class_rival', () => {
  it('reserves the AHA loser with cycle_class_rival, naming the retinoid winner and pm', () => {
    const plan = generatePlan(
      makeEngineInput([RETINOID, AHA], { profile: cycleRivalProfile() }),
    );

    expect(plan.periods.evening.map((s) => s.productId)).toContain(RETINOID.id);
    const reserved = plan.reserve.find((r) => r.productId === AHA.id);
    expect(reserved?.reasonCode).toBe('cycle_class_rival');
    expect(reserved?.rivalOfProductId).toBe(RETINOID.id);
    expect(reserved?.period).toBe('pm');
  });

  it('reserves the BHA loser with cycle_class_rival the same way (aha/bha are both exfoliant cycleClass)', () => {
    const plan = generatePlan(
      makeEngineInput([RETINOID, BHA], { profile: cycleRivalProfile() }),
    );

    const reserved = plan.reserve.find((r) => r.productId === BHA.id);
    expect(reserved?.reasonCode).toBe('cycle_class_rival');
    expect(reserved?.rivalOfProductId).toBe(RETINOID.id);
  });
});

describe('Story 1 AC2: a same-cycleClass loser keeps the existing duplicate_function reason', () => {
  it('does not reclassify a second retinoid product as a cycle_class_rival', () => {
    const secondRetinoid = { ...RETINOID, id: 'p-retinoid-2', name: 'Backup Retinol', addedAt: '2025-11-01' };
    const plan = generatePlan(
      makeEngineInput([RETINOID, secondRetinoid], { profile: cycleRivalProfile() }),
    );

    const reserved = plan.reserve.find((r) => r.productId === secondRetinoid.id);
    expect(reserved?.reasonCode).toBe('duplicate_function');
  });
});

describe('Story 1 AC3: only the single best-ranked cross-cycleClass rival is ever tagged', () => {
  it('tags exactly one of two exfoliants losing to the same retinoid; the other keeps cumulative_active_cap', () => {
    const plan = generatePlan(
      makeEngineInput([RETINOID, AHA, BHA_SECONDARY], { profile: cycleRivalProfile() }),
    );

    const ahaReserve = plan.reserve.find((r) => r.productId === AHA.id);
    const bhaReserve = plan.reserve.find((r) => r.productId === BHA_SECONDARY.id);
    const reasons = [ahaReserve?.reasonCode, bhaReserve?.reasonCode];

    expect(reasons.filter((r) => r === 'cycle_class_rival')).toHaveLength(1);
    expect(reasons.filter((r) => r === 'cumulative_active_cap')).toHaveLength(1);
  });
});

// ─── Story 3: accepting the alternating schedule ─────────────────────────────

describe('Story 3 AC1: accepting admits both products with non-overlapping, min(cap)-sized days', () => {
  it('admits the retinoid on [Tue, Sat] and the AHA on [Mon, Thu] — never overlapping', () => {
    const plan = generatePlan(
      makeEngineInput([RETINOID, AHA], {
        profile: cycleRivalProfile(),
        userOverrides: [AHA.id],
      }),
    );

    const winnerStep = plan.periods.evening.find((s) => s.productId === RETINOID.id);
    const rivalStep = plan.periods.evening.find((s) => s.productId === AHA.id);

    expect(winnerStep).toBeDefined();
    expect(rivalStep).toBeDefined();
    // Byte-identical to today's solo-capped split (tech design FE-3): the
    // winner's own [Tue, Sat] preference is unchanged by this feature.
    expect([...(winnerStep?.scheduledDays ?? [])].sort()).toEqual([2, 6]);
    expect([...(rivalStep?.scheduledDays ?? [])].sort()).toEqual([1, 4]);

    const overlap = (winnerStep?.scheduledDays ?? []).some((d) =>
      (rivalStep?.scheduledDays ?? []).includes(d),
    );
    expect(overlap).toBe(false);

    // Never reserved or frozen once admitted.
    expect(plan.reserve.find((r) => r.productId === AHA.id)).toBeUndefined();
    expect(plan.frozen.find((f) => f.productId === AHA.id)).toBeUndefined();
  });

  it('never exceeds either product\'s own frequency cap (both land at exactly 2/week today)', () => {
    const plan = generatePlan(
      makeEngineInput([RETINOID, BHA], {
        profile: cycleRivalProfile(),
        userOverrides: [BHA.id],
      }),
    );

    const winnerStep = plan.periods.evening.find((s) => s.productId === RETINOID.id);
    const rivalStep = plan.periods.evening.find((s) => s.productId === BHA.id);

    expect(winnerStep?.scheduledDays).toHaveLength(2);
    expect(rivalStep?.scheduledDays).toHaveLength(2);
  });

  it('logs a day_split decision for both the winner and the rival', () => {
    const plan = generatePlan(
      makeEngineInput([RETINOID, AHA], {
        profile: cycleRivalProfile(),
        userOverrides: [AHA.id],
      }),
    );

    const daySplitProductIds = plan.decisions
      .filter((d) => d.action === 'day_split')
      .map((d) => d.productId);
    expect(daySplitProductIds).toEqual(expect.arrayContaining([RETINOID.id, AHA.id]));
  });
});

describe('Story 3 AC2: the choice persists across regeneration without re-prompting', () => {
  it('admits the same pair with the same days on a second generatePlan call with the same override', () => {
    const input = makeEngineInput([RETINOID, AHA], {
      profile: cycleRivalProfile(),
      userOverrides: [AHA.id],
    });

    const first = generatePlan(input);
    const second = generatePlan(input);

    expect(second).toEqual(first);
    expect(second.reserve.find((r) => r.productId === AHA.id)).toBeUndefined();
  });
});

describe('Story 3 AC3: a pre-existing manual scheduledDays edit is silently overwritten on accept', () => {
  it('overwrites both products\' prior manually-set scheduledDays when the commit is applied', () => {
    const plan = generatePlan(
      makeEngineInput([RETINOID, AHA], {
        profile: cycleRivalProfile(),
        userOverrides: [AHA.id],
      }),
    );

    const existingSteps: RoutineStep[] = [
      { id: 'existing-winner', productType: 'serum', productId: RETINOID.id, hidden: false, scheduledDays: [1, 3, 5] },
      { id: 'existing-rival', productType: 'serum', productId: AHA.id, hidden: false, scheduledDays: [0] },
    ];

    const nextSteps = buildStepsFromPlan(plan.periods.evening, existingSteps, plan.frozen, () => 'new-step');

    const winnerNext = nextSteps.find((s) => s.productId === RETINOID.id);
    const rivalNext = nextSteps.find((s) => s.productId === AHA.id);

    expect(winnerNext?.scheduledDays).not.toEqual([1, 3, 5]);
    expect(rivalNext?.scheduledDays).not.toEqual([0]);
    expect([...(winnerNext?.scheduledDays ?? [])].sort()).toEqual([2, 6]);
    expect([...(rivalNext?.scheduledDays ?? [])].sort()).toEqual([1, 4]);
  });
});

// ─── Non-Goal regression: declining changes nothing about today's behavior ───

describe('regression: without an override, the shelf behaves exactly as it does today', () => {
  it('keeps the retinoid scheduled and the AHA reserved when no override is present', () => {
    const plan = generatePlan(
      makeEngineInput([RETINOID, AHA], { profile: cycleRivalProfile() }),
    );

    expect(plan.periods.evening.map((s) => s.productId)).toContain(RETINOID.id);
    expect(plan.periods.evening.map((s) => s.productId)).not.toContain(AHA.id);
    expect(plan.reserve.some((r) => r.productId === AHA.id)).toBe(true);
  });
});
