import { create } from 'zustand';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import { CycleState, ProductApplicationStats } from '@/types';
import { INITIAL_CYCLE_STATE } from '@/utils/routineEngine/cycleState';
import type { SeasonMaskCache } from '@/utils/routineEngine/seasonMask';

/**
 * Behavioral + environmental runtime state: dynamic cycling, adaptation
 * counters, and the weather-derived season-mask cache (research §2.7). Thin
 * state holder — all mutation logic lives in src/domain/ actions.
 */

interface PersistedTracking {
  cycleState: CycleState;
  applicationStats: ProductApplicationStats[];
  seasonMaskCache: SeasonMaskCache | null;
  /**
   * productId → skincare date the product first appeared in a generated,
   * saved plan (V2.1 phase-05 usage anchor). Drives the virtual adaptation
   * count for products the user hasn't checked in yet — so a shelf backfill
   * never counts as prior use.
   */
  firstScheduledDates: Record<string, string>;
  /**
   * Product ids the user forced back into the routine (V2.1 phase-07 "add
   * anyway"), plus the shelf/goal hash they were valid for. Threaded into the
   * engine as input (generatePlan stays pure); dropped when the hash no longer
   * matches, so a shelf or goal change invalidates the override.
   */
  overrides: string[];
  overrideHash: string;
}

interface TrackingState extends PersistedTracking {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setCycleState: (cycleState: CycleState) => void;
  setApplicationStats: (applicationStats: ProductApplicationStats[]) => void;
  setSeasonMaskCache: (seasonMaskCache: SeasonMaskCache | null) => void;
  /** Anchors newly-scheduled products at `date`; never overwrites an existing anchor. */
  recordFirstScheduled: (productIds: string[], date: string) => void;
  /** Adds a product id to the override set, tagged with the current shelf/goal hash. */
  addOverride: (productId: string, hash: string) => void;
  /** Clears all overrides (e.g. on invalidation). */
  clearOverrides: () => void;
  /** Discards cycle progress (mode switches); counters are kept — they never decrement. */
  resetCycleState: () => void;
}

const DEFAULT_TRACKING: PersistedTracking = {
  cycleState: INITIAL_CYCLE_STATE,
  applicationStats: [],
  seasonMaskCache: null,
  firstScheduledDates: {},
  overrides: [],
  overrideHash: '',
};

function persist(state: TrackingState): void {
  void saveJson(STORAGE_KEYS.tracking, {
    cycleState: state.cycleState,
    applicationStats: state.applicationStats,
    seasonMaskCache: state.seasonMaskCache,
    firstScheduledDates: state.firstScheduledDates,
    overrides: state.overrides,
    overrideHash: state.overrideHash,
  });
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  ...DEFAULT_TRACKING,
  hydrated: false,

  hydrate: async () => {
    const stored = await loadJson<Partial<PersistedTracking>>(
      STORAGE_KEYS.tracking,
      DEFAULT_TRACKING,
    );
    set({
      cycleState: stored.cycleState ?? INITIAL_CYCLE_STATE,
      applicationStats: stored.applicationStats ?? [],
      seasonMaskCache: stored.seasonMaskCache ?? null,
      firstScheduledDates: stored.firstScheduledDates ?? {},
      overrides: stored.overrides ?? [],
      overrideHash: stored.overrideHash ?? '',
      hydrated: true,
    });
  },

  setCycleState: (cycleState) => {
    set({ cycleState });
    persist(get());
  },

  setApplicationStats: (applicationStats) => {
    set({ applicationStats });
    persist(get());
  },

  recordFirstScheduled: (productIds, date) => {
    const current = get().firstScheduledDates;
    let changed = false;
    const next = { ...current };
    for (const id of productIds) {
      if (next[id] === undefined) {
        next[id] = date;
        changed = true;
      }
    }
    if (!changed) return; // idempotent — an existing anchor is never moved
    set({ firstScheduledDates: next });
    persist(get());
  },

  setSeasonMaskCache: (seasonMaskCache) => {
    set({ seasonMaskCache });
    persist(get());
  },

  addOverride: (productId, hash) => {
    const current = get();
    // A new hash invalidates the old set: overrides only apply to the shelf/goal
    // they were made against.
    const base = current.overrideHash === hash ? current.overrides : [];
    if (base.includes(productId) && current.overrideHash === hash) return;
    set({ overrides: [...new Set([...base, productId])], overrideHash: hash });
    persist(get());
  },

  clearOverrides: () => {
    if (get().overrides.length === 0) return;
    set({ overrides: [], overrideHash: '' });
    persist(get());
  },

  resetCycleState: () => {
    set({ cycleState: INITIAL_CYCLE_STATE });
    persist(get());
  },
}));
