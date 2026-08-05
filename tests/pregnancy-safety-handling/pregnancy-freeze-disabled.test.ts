/**
 * Integration tests — Surface A (routine engine), PREGNANCY_SAFETY_ENABLED
 * mocked OFF.
 * Spec: docs/specs/pregnancy-safety-handling.md §4 Story 1 AC4, Story 2 (flag off)
 * Tech design: docs/tech-design/pregnancy-safety-handling.md §3 FE-1
 *
 * Clinical sign-off landed 2026-07-30 (spec §10) and the flag now ships
 * `true` (see pregnancy-freeze-enabled.test.ts, which now exercises the real
 * shipped configuration, not a simulated one). This suite continues to
 * exercise the off-path in isolation via an explicit mock, mirroring
 * pregnancy-freeze-enabled.test.ts's own mocking style — proving the
 * mechanism stays truly inert whenever the flag IS off, independent of what
 * it happens to ship as today.
 */
jest.mock('@/constants/featureFlags', () => ({
  ...jest.requireActual('@/constants/featureFlags'),
  PREGNANCY_SAFETY_ENABLED: false,
}));

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

describe('Guard rail: this suite is exercising the off-path (mocked)', () => {
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
