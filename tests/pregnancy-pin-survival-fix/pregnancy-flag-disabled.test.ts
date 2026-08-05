/**
 * Integration test — flag-off control: with PREGNANCY_SAFETY_ENABLED mocked
 * off, no pregnancy freeze exists at all, so a pinned retinoid step survives
 * Draft->Save regardless of `pregnantOrBreastfeeding`.
 * Spec: docs/specs/pregnancy-pin-survival-fix.md §9 (zero behavior change
 * when the parent feature is off).
 *
 * Clinical sign-off landed 2026-07-30 and the flag now ships `true`
 * (pregnancy-pin-not-surviving.test.ts exercises that real, shipped
 * configuration). This file continues to prove the off-path stays inert via
 * an explicit mock, mirroring pregnancy-freeze-disabled.test.ts's updated
 * style — independent of what the flag happens to ship as today.
 *
 * This fix's own two other independence cases — a pair-rule freeze
 * (pair-rule-pin-survives.test.ts) and a clinical procedure freeze
 * (clinical-freeze-pin-not-surviving.test.ts) — are unaffected by
 * PREGNANCY_SAFETY_ENABLED regardless of its value (neither mocks it), so
 * their continuing to pass is itself proof those two sources behave
 * identically either way; this file adds the one case those two don't
 * cover, the pregnancy source itself.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/constants/featureFlags', () => ({
  ...jest.requireActual('@/constants/featureFlags'),
  PREGNANCY_SAFETY_ENABLED: false,
}));

import { PREGNANCY_SAFETY_ENABLED } from '@/constants/featureFlags';
import { applyRoutinePlan } from '@/domain/routinePlanActions';
import { useRoutinesStore } from '@/store/routinesStore';
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  makePregnancyEngineInput,
  makeProduct,
  makeRetinoidProduct,
  makeRoutineStep,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Flag-off control: a pinned retinoid survives Draft->Save even for a pregnant profile, when PREGNANCY_SAFETY_ENABLED is off', () => {
  it('re-appends the pinned retinoid — this fix is inert for pregnancy specifically while the flag is off', () => {
    // Guard: this test is only meaningful while the flag is actually off.
    expect(PREGNANCY_SAFETY_ENABLED).toBe(false);

    // Arrange
    const cleanser = makeProduct({ productType: 'cleanser' });
    const retinoid = makeRetinoidProduct();

    useRoutinesStore.setState({
      routines: [
        { id: 'r-am', name: 'Morning', timeOfDay: 'morning', steps: [] },
        {
          id: 'r-pm',
          name: 'Evening',
          timeOfDay: 'evening',
          steps: [makeRoutineStep(cleanser), makeRoutineStep(retinoid, { userPinned: true })],
        },
      ],
      hydrated: true,
    });

    const plan = generatePlan(
      makePregnancyEngineInput([cleanser, retinoid], true, {
        profile: { primaryGoal: 'aging', secondaryGoal: null },
      }),
    );
    // Sanity: no pregnancy freeze fires at all while the flag is off.
    expect(plan.frozen.map((f) => f.productId)).not.toContain(retinoid.id);

    // Act
    applyRoutinePlan(plan, 'pm');

    // Assert
    const pmRoutine = useRoutinesStore.getState().routines.find((r) => r.timeOfDay === 'evening');
    expect(pmRoutine?.steps.map((s) => s.productId)).toContain(retinoid.id);
  });
});
