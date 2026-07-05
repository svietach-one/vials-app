import type { ProductApplicationStats, RoutineCycleType } from '@/types';
import { getActiveSeasonMask } from '@/domain/seasonActions';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTrackingStore } from '@/store/trackingStore';
import { virtualApplicationCount } from '@/utils/routineEngine/adaptation';
import { checkInCycle } from '@/utils/routineEngine/cycleState';
import { getDailyView } from '@/utils/routineEngine/dailyView';
import { getSkincareDateString } from '@/utils/timeHelpers';

/**
 * Cross-store tracking actions (research §1.4/§2.6): the "Complete My
 * Routine" check-in and cycle-type switching. Screens call these; the pure
 * engine modules stay store-free.
 */

/**
 * Records the daily check-in (dynamic mode only): advances the cycle phase
 * (idempotent per skincare day) and increments the application counter of
 * every product visible in today's view. A first-ever counter entry is
 * seeded from the virtual count so long-owned products are not retroactively
 * re-throttled (research §2.6).
 */
export function performDailyCheckIn(now: Date = new Date()): { advanced: boolean } {
  if (useSettingsStore.getState().routineCycleType !== 'dynamic') return { advanced: false };

  const tracking = useTrackingStore.getState();
  const result = checkInCycle(tracking.cycleState, now);
  if (!result.advanced) return { advanced: false };

  const products = useProductsStore.getState().products;
  const views = getDailyView(useRoutinesStore.getState().routines, products, {
    procedures: useProceduresStore.getState().procedures,
    profile: { fitzpatrick: useProfileStore.getState().profile?.fitzpatrick ?? null },
    // Weather-derived when a fresh cache exists, calendar otherwise — the
    // engine never knows which source produced it (research §1.7)
    seasonMask: getActiveSeasonMask(now),
    cycle: { type: 'dynamic', state: tracking.cycleState },
    now,
  });

  const today = getSkincareDateString(now);
  const visibleIds = new Set(
    views.flatMap((v) => v.steps.flatMap((s) => (s.productId ? [s.productId] : []))),
  );

  const byId = new Map(tracking.applicationStats.map((s) => [s.productId, s]));
  for (const productId of visibleIds) {
    const existing = byId.get(productId);
    if (existing) {
      byId.set(productId, { ...existing, count: existing.count + 1, lastAppliedDate: today });
    } else {
      const product = products.find((p) => p.id === productId);
      const seed = product ? virtualApplicationCount(product.addedAt, now) : 0;
      byId.set(productId, { productId, count: seed + 1, lastAppliedDate: today });
    }
  }
  const nextStats: ProductApplicationStats[] = [...byId.values()];

  useTrackingStore.getState().setCycleState(result.state);
  useTrackingStore.getState().setApplicationStats(nextStats);
  return { advanced: true };
}

/**
 * Switches the routine cycle type. Any actual switch discards cycle progress
 * (dynamic → fixed drops state after the UI's confirmation; fixed → dynamic
 * starts at phase 0 on the next check-in). Application counters are kept —
 * they never decrement (research §1.4/§2.6).
 */
export function switchCycleType(type: RoutineCycleType): void {
  const settings = useSettingsStore.getState();
  if (settings.routineCycleType === type) return;

  settings.setRoutineCycleType(type);
  useTrackingStore.getState().resetCycleState();
}
