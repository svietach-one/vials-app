/**
 * Integration tests — Surface A (routine engine), PREGNANCY_SAFETY_ENABLED ON.
 * Spec: docs/specs/pregnancy-safety-handling.md §4 Story 1 (AC1-3, AC5), Story 2
 * Tech design: docs/tech-design/pregnancy-safety-handling.md §3 FE-1..FE-7
 *
 * `src/constants/rulesets/pregnancy.ts`, the `pregnancy_freeze` eligibility
 * gate, and the `dailyView.ts` union of `context.pregnancyRules` do not exist
 * yet — this file is EXPECTED to fail to compile/run until FE-1..FE-7 land
 * (qa-lead writes tests before code, .claude/rules/testing.md).
 *
 * PREGNANCY_SAFETY_ENABLED ships OFF by default (spec §3 non-goals — no
 * clinical sign-off yet), so "flag on" behavior is exercised here by mocking
 * the flags module. Tech design FE-2/FE-9 self-gate their exports by reading
 * `@/constants/featureFlags` internally, so this mock transitively covers
 * every consumer resolved within this file's module registry (pregnancy.ts,
 * and anything else it touches) without needing per-module mocks.
 *
 * Mirrors the real-module, no-mocking-of-the-engine style already established
 * by tests/routine-engine/clinical-freeze.test.ts for the analogous
 * clinical-procedure freeze.
 */
jest.mock('@/constants/featureFlags', () => ({
  ...jest.requireActual('@/constants/featureFlags'),
  PREGNANCY_SAFETY_ENABLED: true,
}));

import { reasonText } from '@/constants/decisionReasons';
import { getDailyView } from '@/utils/routineEngine/dailyView';
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  makeHydroquinoneProduct,
  makePregnancyDailyViewInput,
  makePregnancyEngineInput,
  makeProduct,
  makeRetinoidProduct,
  makeRoutine,
  makeRoutineStep,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 1 AC1: no retinoid-class product is admitted to any period of a generated plan', () => {
  it('excludes a retinoid product from both periods even under an "aging" goal that would otherwise rank it as the top treatment', () => {
    // Arrange — 'aging' ranks retinoid FIRST in ACTIVES_RULESET.goals (actives.json),
    // so absent the pregnancy freeze this product would be admitted, not reserved.
    // A maintenance-goal shelf would exclude it via ordinary minimalism regardless
    // of pregnancy, which would make this assertion pass for the wrong reason.
    const retinoid = makeRetinoidProduct();
    const cleanser = makeProduct({ productType: 'cleanser' });

    // Act
    const plan = generatePlan(
      makePregnancyEngineInput([cleanser, retinoid], true, {
        profile: { primaryGoal: 'aging', secondaryGoal: null },
      }),
    );

    // Assert
    expect(plan.periods.morning.map((s) => s.productId)).not.toContain(retinoid.id);
    expect(plan.periods.evening.map((s) => s.productId)).not.toContain(retinoid.id);
  });
});

describe('Story 1 AC2: the excluded product carries reasonCode pregnancy_blocked and the Phase 7 reason text', () => {
  it('records the retinoid in plan.frozen with reasonCode pregnancy_blocked, resolving to real dictionary copy', () => {
    // Arrange
    const retinoid = makeRetinoidProduct();

    // Act
    const plan = generatePlan(makePregnancyEngineInput([retinoid], true));

    // Assert
    expect(plan.frozen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: retinoid.id, reasonCode: 'pregnancy_blocked' }),
      ]),
    );
    // reasonText falls back to a generic line for any code missing from the
    // dictionary (decisionReasons.ts) — a non-generic result proves FE-7's
    // dictionary entry actually round-trips, not just that the code exists.
    expect(reasonText('pregnancy_blocked')).not.toBe('Adjusted to keep your routine safe.');
  });
});

describe('Story 1 AC3: the frozen product cannot be forced back in via the override flow', () => {
  it('keeps the retinoid out of both periods even when its id is passed as a userOverride', () => {
    // Arrange
    const retinoid = makeRetinoidProduct();
    const cleanser = makeProduct({ productType: 'cleanser' });

    // Act — simulate the exact "add anyway" override attempt a reserved
    // (non-frozen) product would use successfully.
    const plan = generatePlan(
      makePregnancyEngineInput([cleanser, retinoid], true, { userOverrides: [retinoid.id] }),
    );

    // Assert — rejected by applyEligibilityGates before selectSkeleton ever
    // runs, so the override pool never sees it (tech design §1/§4, mirrors
    // retinoid-in-AM's structural non-overridability).
    expect(plan.periods.morning.map((s) => s.productId)).not.toContain(retinoid.id);
    expect(plan.periods.evening.map((s) => s.productId)).not.toContain(retinoid.id);
    expect(plan.frozen.map((f) => f.productId)).toContain(retinoid.id);
  });
});

describe('Story 1 AC5: a non-pregnant profile contributes no pregnancy freeze, even with the flag on', () => {
  it('never rejects the retinoid for pregnancy, leaving it eligible or in ordinary reserve instead', () => {
    // Arrange
    const retinoid = makeRetinoidProduct();

    // Act
    const plan = generatePlan(makePregnancyEngineInput([retinoid], false));

    // Assert — no freeze source fires at all (no procedures logged either),
    // so the retinoid must be either scheduled or in ordinary (non-frozen) reserve.
    expect(plan.frozen).toHaveLength(0);
    expect(plan.reserve.some((r) => r.productId === retinoid.id)).toBe(true);
  });
});

describe('engine4.1 §4: hydroquinone is frozen the same way retinoid is', () => {
  it('excludes a hydroquinone product from both periods, with reasonCode pregnancy_blocked in plan.frozen', () => {
    // Arrange
    const hydroquinone = makeHydroquinoneProduct();
    const cleanser = makeProduct({ productType: 'cleanser' });

    // Act
    const plan = generatePlan(makePregnancyEngineInput([cleanser, hydroquinone], true));

    // Assert
    expect(plan.periods.morning.map((s) => s.productId)).not.toContain(hydroquinone.id);
    expect(plan.periods.evening.map((s) => s.productId)).not.toContain(hydroquinone.id);
    expect(plan.frozen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: hydroquinone.id, reasonCode: 'pregnancy_blocked' }),
      ]),
    );
  });

  it('never rejects hydroquinone for pregnancy when the profile is not pregnant, even with the flag on', () => {
    // Arrange
    const hydroquinone = makeHydroquinoneProduct();

    // Act
    const plan = generatePlan(makePregnancyEngineInput([hydroquinone], false));

    // Assert
    expect(plan.frozen).toHaveLength(0);
    expect(plan.reserve.some((r) => r.productId === hydroquinone.id)).toBe(true);
  });
});

describe('Story 2 AC: a saved routine\'s retinoid step is excluded on the Today screen once the freeze applies', () => {
  it('renders the retinoid step as frozen (not active) in getDailyView, the same way a clinical procedure freeze does', () => {
    // Arrange
    const cleanser = makeProduct({ productType: 'cleanser' });
    const retinoid = makeRetinoidProduct();
    const routine = makeRoutine('evening', [makeRoutineStep(cleanser), makeRoutineStep(retinoid)]);

    // Act
    const view = getDailyView(
      [routine],
      [cleanser, retinoid],
      makePregnancyDailyViewInput(true),
    )[0];

    // Assert
    expect(view.steps.map((s) => s.productId)).toEqual([cleanser.id]);
    expect(view.frozen.map((f) => f.productId)).toContain(retinoid.id);
    expect(view.frozen.find((f) => f.productId === retinoid.id)?.reasonCode).toBe('pregnancy_blocked');
  });
});
