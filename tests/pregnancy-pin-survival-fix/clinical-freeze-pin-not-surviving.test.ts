/**
 * Integration test — Story 2 AC2 (generalization check): a userPinned step
 * frozen by an existing clinical/procedure rehab freeze still does not
 * survive Draft->Save, exactly as before this fix.
 * Spec: docs/specs/pregnancy-pin-survival-fix.md §4 Story 2 (AC2)
 * Tech design: docs/tech-design/pregnancy-pin-survival-fix.md §3 FE-2..FE-5
 *
 * Confirms the fix isn't pregnancy-special-cased: `overridesPin` must be
 * `true` for BOTH safety-gate sources (`clinical_freeze` and
 * `pregnancy_freeze`), derived via the shared `isSafetyFreezeGate` helper.
 * This path already has `until` today, so the pre-fix proxy already gets it
 * right — this test is a regression guard that must stay green before AND
 * after the fix, not a red-before/green-after case like Story 1's.
 *
 * Independent of PREGNANCY_SAFETY_ENABLED — a clinical procedure freeze is
 * unrelated to the pregnancy feature flag.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { applyRoutinePlan } from '@/domain/routinePlanActions';
import { useRoutinesStore } from '@/store/routinesStore';
import { generatePlan } from '@/utils/routineEngine/generate';
import {
  makeEngineInput,
  makeProcedureLog,
  makeProduct,
  makeRoutineStep,
  NOW,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 2 AC2: a pinned step frozen by a clinical procedure rehab freeze still does not survive Draft->Save', () => {
  it('drops the pinned retinoid, exactly as before this fix', () => {
    // Arrange — a same-day deep peel puts the routine engine's rehab window
    // in force (elapsed day 0 of 14), which freezes the retinoid class via
    // peel_rehab_no_aggressive_actives (tests/routine-engine/clinical-freeze.test.ts).
    const cleanser = makeProduct({ productType: 'cleanser' });
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const peel = makeProcedureLog({ procedureKey: 'chemical_peel_deep', datePerformed: '2026-07-04' });

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

    const plan = generatePlan(makeEngineInput([cleanser, retinoid], { procedures: [peel], now: NOW }));
    // Sanity: the engine itself froze the retinoid for the peel rehab window —
    // otherwise this test would pass for the wrong reason.
    expect(plan.frozen).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: retinoid.id,
          reasonCode: 'peel_rehab_no_aggressive_actives',
        }),
      ]),
    );

    // Act
    applyRoutinePlan(plan, 'pm');

    // Assert
    const pmRoutine = useRoutinesStore.getState().routines.find((r) => r.timeOfDay === 'evening');
    expect(pmRoutine?.steps.map((s) => s.productId)).not.toContain(retinoid.id);
  });
});
