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
}

interface TrackingState extends PersistedTracking {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setCycleState: (cycleState: CycleState) => void;
  setApplicationStats: (applicationStats: ProductApplicationStats[]) => void;
  setSeasonMaskCache: (seasonMaskCache: SeasonMaskCache | null) => void;
  /** Discards cycle progress (mode switches); counters are kept — they never decrement. */
  resetCycleState: () => void;
}

const DEFAULT_TRACKING: PersistedTracking = {
  cycleState: INITIAL_CYCLE_STATE,
  applicationStats: [],
  seasonMaskCache: null,
};

function persist(state: TrackingState): void {
  void saveJson(STORAGE_KEYS.tracking, {
    cycleState: state.cycleState,
    applicationStats: state.applicationStats,
    seasonMaskCache: state.seasonMaskCache,
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

  setSeasonMaskCache: (seasonMaskCache) => {
    set({ seasonMaskCache });
    persist(get());
  },

  resetCycleState: () => {
    set({ cycleState: INITIAL_CYCLE_STATE });
    persist(get());
  },
}));
