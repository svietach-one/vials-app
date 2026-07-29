/**
 * Integration tests — Surface A (routine engine), PREGNANCY_SAFETY_ENABLED OFF
 * (the real shipped default — @/constants/featureFlags is NOT mocked here).
 * Spec: docs/specs/pregnancy-safety-handling.md §4 Story 1 AC4, Story 2 (flag off)
 * Tech design: docs/tech-design/pregnancy-safety-handling.md §3 FE-1
 *
 * This is the most important suite for a safety feature that must not
 * activate before clinical sign-off (spec §2/§3): it proves the mechanism is
 * truly inert under the ACTUAL configuration this app ships with today, not
 * a simulated one. Mirrors the guard-rail style of
 * src/constants/rulesets/proposedPairRules.test.ts.
 */
import { PREGNANCY_SAFETY_ENABLED } from '@/constants/featureFlags';
import { getDailyView } from '@/utils/routineEngine/dailyView';
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  makePregnancyDailyViewInput,
  makePregnancyEngineInput,
  makeProduct,
  makeRetinoidProduct,
  makeRoutine,
  makeRoutineStep,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Guard rail: PREGNANCY_SAFETY_ENABLED ships off pending clinical sign-off (spec §10)', () => {
  it('is false', () => {
    expect(PREGNANCY_SAFETY_ENABLED).toBe(false);
  });
});

describe('Story 1 AC4: routine generation for a pregnant profile is unchanged while the flag is off', () => {
  it('produces an identical plan for a pregnant and a non-pregnant profile', () => {
    // Arrange
    const retinoid = makeRetinoidProduct();
    const cleanser = makeProduct({ productType: 'cleanser' });

    // Act
    const pregnantPlan = generatePlan(makePregnancyEngineInput([cleanser, retinoid], true));
    const notPregnantPlan = generatePlan(makePregnancyEngineInput([cleanser, retinoid], false));

    // Assert
    expect(pregnantPlan).toEqual(notPregnantPlan);
    expect(pregnantPlan.frozen.some((f) => f.reasonCode === 'pregnancy_blocked')).toBe(false);
  });
});

describe('Story 2 (flag off): the Today screen is unchanged for a pregnant profile', () => {
  it('renders the retinoid step as an ordinary active step, not frozen', () => {
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
    expect(view.steps.map((s) => s.productId)).toEqual([cleanser.id, retinoid.id]);
    expect(view.frozen).toHaveLength(0);
  });
});
