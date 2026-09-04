/**
 * Integration test — Story 1: a pinned step under a persistent safety freeze
 * does not survive a Draft->Save regeneration.
 * Spec: docs/specs/pregnancy-pin-survival-fix.md §4 Story 1 (AC1)
 * Tech design: docs/tech-design/pregnancy-pin-survival-fix.md §3 FE-1..FE-5
 *
 * `FrozenItem.overridesPin` does not exist yet — this file is EXPECTED to
 * fail to compile/run until FE-1..FE-5 land (qa-lead writes tests before
 * code, .claude/rules/testing.md). Today, `buildStepsFromPlan` keys off
 * `until` alone, so a pregnancy freeze (which never sets `until`) lets the
 * pin survive — the exact regression this fix closes.
 *
 * Exercises the real Draft->Save write path (`applyRoutinePlan` against the
 * real `routinesStore`), mirroring tests/routine-engine/draft-preview.test.ts's
 * "pinned, pair-frozen product" end-to-end style, with
 * PREGNANCY_SAFETY_ENABLED mocked on per
 * tests/pregnancy-safety-handling/pregnancy-freeze-enabled.test.ts's
 * convention.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/constants/featureFlags', () => ({
  ...jest.requireActual('@/constants/featureFlags'),
  PREGNANCY_SAFETY_ENABLED: true,
}));

import { applyRoutinePlan } from '@/domain/routinePlanActions';
import { useRoutinesStore } from '@/store/routinesStore';
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  makePregnancyEngineInput,
  makeProduct,
  makeRetinoidProduct,
  makeRoutine,
  makeRoutineStep,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 1 AC1: a userPinned retinoid step does not survive Draft->Save under an active pregnancy freeze', () => {
  it('drops the pinned retinoid from the saved evening routine once the draft is committed', () => {
    // Arrange — the retinoid was pinned before the user became pregnant; the
    // 'aging' goal makes it the top treatment candidate absent the freeze
    // (same rigor as pregnancy-freeze-enabled.test.ts's AC1), so this proves
    // the pin genuinely gets overridden by the freeze, not by ordinary
    // minimalism.
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
    // Sanity: the engine itself froze the retinoid for pregnancy — otherwise
    // this test would pass for the wrong reason (product simply re-admitted).
    expect(plan.frozen.map((f) => f.productId)).toContain(retinoid.id);

    // Act
    applyRoutinePlan(plan, 'pm');

    // Assert
    const pmRoutine = useRoutinesStore.getState().routines.find((r) => r.timeOfDay === 'evening');
    expect(pmRoutine?.steps.map((s) => s.productId)).not.toContain(retinoid.id);
  });
});
