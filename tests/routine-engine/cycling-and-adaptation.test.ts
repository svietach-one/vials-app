/**
 * Integration tests — Story 5 (Dynamic skin cycling with lazy tracking)
 * and Story 6 (Adaptation micro-dosing).
 * Spec: docs/specs/2026-07-04-routine-engine.md §4 Story 5 / Story 6
 *
 * FE-6 shipped 2026-07-05 (progress/routine-engine.md): cycleState.ts,
 * adaptation.ts, actives.json adaptation blocks, trackingStore, and
 * src/domain/trackingActions.ts (performDailyCheckIn, switchCycleType) all
 * exist now. Story 5's domain-level ACs are activated here against the REAL
 * zustand stores (trackingStore/settingsStore/productsStore/routinesStore/
 * proceduresStore/profileStore) with AsyncStorage's official jest mock —
 * per-module unit coverage of cycleState.ts/adaptation.ts already lives in
 * src/utils/routineEngine/{cycleState,adaptation}.test.ts (engineer's), so
 * this file exercises the CROSS-STORE composition (performDailyCheckIn) that
 * no other suite touches. Story 6's ACs are activated as generatePlan
 * integration tests (engine + adaptation caps together, distinct from
 * adaptation.test.ts's single-module coverage). The two UI-only Story 5 ACs
 * (button presence/absence) are activated as component tests in
 * tests/routine-engine/today-screen.test.tsx; the adaptation status-line UI
 * AC lives in tests/routine-engine/routine-step-card.test.tsx — both moved
 * out of this file since they need @testing-library/react-native rendering,
 * not a plain describe block here.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { generatePlan } from '@/utils/routineEngine/generate';
import { getCyclePhaseForTonight, INITIAL_CYCLE_STATE } from '@/utils/routineEngine/cycleState';
import { performDailyCheckIn } from '@/domain/trackingActions';
import { useTrackingStore } from '@/store/trackingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useProductsStore } from '@/store/productsStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProfileStore } from '@/store/profileStore';
import {
  makeEngineInput,
  makeProduct,
  NOW,
  resetFixtureCounters,
} from './fixtures';

beforeEach(() => resetFixtureCounters());

// ─── Story 6: adaptation micro-dosing (engine-level, generatePlan) ───────────

describe('Story 6 AC: adaptation phase caps flow through generatePlan end-to-end', () => {
  it('schedules a <=4-application adapting retinoid at 2 days/week, Tue/Sat spread (>=72h apart)', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const plan = generatePlan(
      makeEngineInput([retinoid], {
        tracking: { cycleType: 'dynamic', applicationStats: [{ productId: retinoid.id, count: 2, lastAppliedDate: '2026-07-01' }] },
      }),
    );
    const step = plan.periods.evening.find((s) => s.productId === retinoid.id);
    // [2, 6] = Tuesday, Saturday — 4 days one way, 3 days (72h) the other.
    expect(step?.scheduledDays).toEqual([2, 6]);
  });

  it('schedules a 5-8 application adapting retinoid at most 4 days/week (every other night)', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const plan = generatePlan(
      makeEngineInput([retinoid], {
        tracking: { cycleType: 'dynamic', applicationStats: [{ productId: retinoid.id, count: 5, lastAppliedDate: '2026-07-01' }] },
      }),
    );
    const step = plan.periods.evening.find((s) => s.productId === retinoid.id);
    expect(step?.scheduledDays).toHaveLength(4);
  });

  it('applies only standard conflict rules for a >=9-application adapting retinoid (adaptation phase 3)', () => {
    const retinoid = makeProduct({ activeTags: ['retinoid'] });
    const plan = generatePlan(
      makeEngineInput([retinoid], {
        tracking: { cycleType: 'dynamic', applicationStats: [{ productId: retinoid.id, count: 9, lastAppliedDate: '2026-07-01' }] },
      }),
    );
    const step = plan.periods.evening.find((s) => s.productId === retinoid.id);
    // No adaptation cap once phase 3 is reached — every day, same as any solo product.
    expect(step?.scheduledDays).toEqual([]);
  });

  it('derives a virtual application count from addedAt in fixed (non-tracking) mode: weeks 1-2 -> phase 1, weeks 3-4 -> phase 2, week 5+ -> phase 3', () => {
    // NOW = 2026-07-04. No `tracking` field on the input => fixed mode, virtual counts.
    const week1Product = makeProduct({ activeTags: ['retinoid'], addedAt: '2026-06-26' }); // 8 days -> 1 week
    const week3Product = makeProduct({ activeTags: ['retinoid'], addedAt: '2026-06-12' }); // 22 days -> 3 weeks
    const week5Product = makeProduct({ activeTags: ['retinoid'], addedAt: '2026-05-29' }); // 36 days -> 5 weeks

    const phase1Days = generatePlan(makeEngineInput([week1Product]))
      .periods.evening.find((s) => s.productId === week1Product.id)?.scheduledDays;
    const phase2Days = generatePlan(makeEngineInput([week3Product]))
      .periods.evening.find((s) => s.productId === week3Product.id)?.scheduledDays;
    const phase3Days = generatePlan(makeEngineInput([week5Product]))
      .periods.evening.find((s) => s.productId === week5Product.id)?.scheduledDays;

    expect(phase1Days).toHaveLength(2); // phase 1 cap
    expect(phase2Days).toHaveLength(4); // phase 2 cap
    expect(phase3Days).toEqual([]); // phase 3 -> unlimited
  });

  it('starts a product owned long before this feature shipped directly in phase 3 (grandfathered, no retroactive throttling)', () => {
    const veteran = makeProduct({ activeTags: ['retinoid'], addedAt: '2020-01-01' });
    const plan = generatePlan(makeEngineInput([veteran]));
    const step = plan.periods.evening.find((s) => s.productId === veteran.id);
    expect(step?.scheduledDays).toEqual([]);
  });
});

// ─── Story 5: dynamic skin cycling with lazy tracking (domain-level) ─────────

describe('Story 5 AC: cross-store domain actions (performDailyCheckIn / cycleState)', () => {
  const productA = makeProduct({ id: 'am-product', productType: 'moisturizer', addedAt: '2026-07-04' });
  const productB = makeProduct({ id: 'pm-product', productType: 'cleanser', addedAt: '2026-07-04' });

  function seedStores() {
    useTrackingStore.setState({ cycleState: INITIAL_CYCLE_STATE, applicationStats: [], seasonMaskCache: null, hydrated: true });
    useSettingsStore.setState({
      gamificationEnabled: false,
      hasSeenLocalDataWarning: false,
      dismissedBanners: [],
      routineCycleType: 'fixed',
      hydrated: true,
    });
    useProductsStore.setState({ products: [productA, productB], hydrated: true });
    useRoutinesStore.setState({
      routines: [
        { id: 'r-am', name: 'Morning', timeOfDay: 'morning', steps: [{ id: 's-am', productType: 'moisturizer', productId: productA.id, hidden: false, scheduledDays: [] }] },
        { id: 'r-pm', name: 'Evening', timeOfDay: 'evening', steps: [{ id: 's-pm', productType: 'cleanser', productId: productB.id, hidden: false, scheduledDays: [] }] },
      ],
      hydrated: true,
    });
    useProceduresStore.setState({ procedures: [], hydrated: true });
    useProfileStore.setState({
      profile: {
        id: 'profile-1', gender: null, age: null, skinType: null, phototype: null,
        fitzpatrick: null, city: null, concerns: [], primaryGoal: 'maintenance',
        secondaryGoal: null, goalNeedsConfirmation: false, spfSensitivity: false,
        onboardingCompleted: true, individualDurationMonths: {},
      },
      hydrated: true,
    });
  }

  beforeEach(() => {
    resetFixtureCounters();
    seedStores();
  });

  it('no-ops in fixed mode (default): performDailyCheckIn never advances the cycle', () => {
    const before = useTrackingStore.getState().cycleState;
    const result = performDailyCheckIn(NOW);
    expect(result.advanced).toBe(false);
    expect(useTrackingStore.getState().cycleState).toBe(before); // same reference, no store write
  });

  it('is idempotent: tapping "Complete My Routine" twice on the same skincare day leaves cycle state unchanged', () => {
    useSettingsStore.getState().setRoutineCycleType('dynamic');

    const first = performDailyCheckIn(NOW);
    expect(first.advanced).toBe(true);
    const stateAfterFirst = useTrackingStore.getState().cycleState;

    // Same instant as the first call (timezone-proof way of asserting
    // "same skincare day") — the pure cycleState.test.ts already exercises
    // the 04:00 boundary itself against a fixed offset.
    const second = performDailyCheckIn(NOW);
    expect(second.advanced).toBe(false);
    expect(useTrackingStore.getState().cycleState).toBe(stateAfterFirst);
  });

  it('keeps tonight\'s plan on the pending phase when there was no check-in for weeks (cycle paused, never skipped)', () => {
    useSettingsStore.getState().setRoutineCycleType('dynamic');
    // Stale: last check-in weeks ago, still mid-cycle on the retinoid phase.
    useTrackingStore.setState({ cycleState: { cyclePhaseIndex: 1, lastAppliedDate: '2026-06-01' } });

    // Tonight's phase is still 'retinoid' despite the gap — pause-on-miss.
    expect(getCyclePhaseForTonight(useTrackingStore.getState().cycleState)).toBe('retinoid');

    const result = performDailyCheckIn(NOW);
    expect(result.advanced).toBe(true);
    // Advances by exactly one step (retinoid -> recovery), never skips ahead
    // to "catch up" for the missed weeks.
    expect(useTrackingStore.getState().cycleState.cyclePhaseIndex).toBe(2);
  });

  it('advances the cycle phase by one (mod 4) and increments every visible product\'s application counter by exactly 1 on check-in', () => {
    useSettingsStore.getState().setRoutineCycleType('dynamic');
    useTrackingStore.setState({ cycleState: { cyclePhaseIndex: 3, lastAppliedDate: '2026-07-03' } });

    performDailyCheckIn(NOW);

    expect(useTrackingStore.getState().cycleState.cyclePhaseIndex).toBe(0); // wraps 3 -> 0
    const stats = useTrackingStore.getState().applicationStats;
    const statFor = (id: string) => stats.find((s) => s.productId === id);
    // Both products were added "today" (virtual count 0) -> first count is exactly 1.
    expect(statFor(productA.id)?.count).toBe(1);
    expect(statFor(productB.id)?.count).toBe(1);
  });
});
