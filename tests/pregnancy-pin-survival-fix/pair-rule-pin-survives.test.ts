/**
 * Integration test — Story 2 AC1 (regression guard): a userPinned step
 * frozen only by a pair-rule/cumulative-cap conflict still survives
 * Draft->Save, unchanged by this fix.
 * Spec: docs/specs/pregnancy-pin-survival-fix.md §4 Story 2 (AC1)
 * Tech design: docs/tech-design/pregnancy-pin-survival-fix.md §3 FE-5
 *
 * Mirrors tests/routine-engine/draft-preview.test.ts's existing "pinned,
 * pair-frozen product" end-to-end test (same hand-constructed RoutinePlan
 * technique — a pair-rule ladder-exhaustion freeze carries no `until` and is
 * awkward to trigger reliably through generatePlan's real ladder, so the
 * FrozenItem is authored directly, same as that precedent). The only
 * addition here is the explicit `overridesPin: false` the fix introduces —
 * this file is EXPECTED to fail to compile until FE-1 (planTypes.ts) lands,
 * since `overridesPin` does not exist on `FrozenItem` yet.
 *
 * Independent of PREGNANCY_SAFETY_ENABLED — a pair-rule freeze is a
 * preference-tier conflict, unrelated to the pregnancy feature flag.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { applyRoutinePlan } from '@/domain/routinePlanActions';
import { useRoutinesStore } from '@/store/routinesStore';
import type { RoutinePlan } from '@/utils/routineEngine/generate';
import { makeProduct, makeRoutineStep, resetFixtureCounters } from './fixtures';

beforeEach(() => resetFixtureCounters());

describe('Story 2 AC1: a pinned step frozen only by a pair-rule conflict still survives Draft->Save', () => {
  it('re-appends the pinned product alongside the freshly admitted one, exactly as before this fix', () => {
    // Arrange
    const retinoid = makeProduct({ id: 'pinned-retinoid', activeTags: ['retinoid'] });
    const aha = makeProduct({ id: 'draft-aha', activeTags: ['aha'] });

    useRoutinesStore.setState({
      routines: [
        { id: 'r-am', name: 'Morning', timeOfDay: 'morning', steps: [] },
        {
          id: 'r-pm',
          name: 'Evening',
          timeOfDay: 'evening',
          steps: [makeRoutineStep(retinoid, { userPinned: true })],
        },
      ],
      hydrated: true,
    });

    const plan: RoutinePlan = {
      rulesetVersion: 'test',
      generatedFor: '2026-07-30',
      periods: {
        morning: [],
        evening: [
          { productId: aha.id, productType: 'serum', scheduledDays: [], slotIndex: 5, score: 0, addedAt: '2026-01-01' },
        ],
      },
      frozen: [
        {
          productId: retinoid.id,
          reasonCode: 'retinoid_acid_conflict',
          ruleId: 'rule_retinol_aha',
          // Pair-rule/cap/relocation outcomes are explicitly NOT pin-overriding
          // (tech design FE-4/Assumption 1) — preserves the pre-fix behavior.
          overridesPin: false,
        },
      ],
      reserve: [],
      placeholders: [],
      decisions: [],
    };

    // Act
    applyRoutinePlan(plan, 'pm');

    // Assert — both the freshly admitted aha AND the re-appended pinned retinoid coexist.
    const pmRoutine = useRoutinesStore.getState().routines.find((r) => r.timeOfDay === 'evening');
    expect(pmRoutine?.steps.map((s) => s.productId).sort()).toEqual([aha.id, retinoid.id].sort());
  });
});
