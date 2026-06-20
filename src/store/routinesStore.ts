import { create } from 'zustand';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import { generateId } from '@/utils/generateId';
import type { Routine } from '@/types';

// ─── Default routines ─────────────────────────────────────────────────────────

const DEFAULT_ROUTINES: Routine[] = [
  {
    id: generateId(),
    name: 'Morning',
    timeOfDay: 'morning',
    steps: [],
  },
  {
    id: generateId(),
    name: 'Evening',
    timeOfDay: 'evening',
    steps: [],
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

interface RoutinesState {
  routines: Routine[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setRoutines: (routines: Routine[]) => void;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  /** Hide or restore a single step without replacing the full routine. */
  setStepHidden: (routineId: string, stepId: string, hidden: boolean) => void;
}

export const useRoutinesStore = create<RoutinesState>((set, get) => ({
  routines: [],
  hydrated: false,

  hydrate: async () => {
    const raw = await loadJson<Routine[]>(STORAGE_KEYS.routines, []);

    // Normalise scheduledDays for steps stored before the field was added
    let routines = raw.map((r) => ({
      ...r,
      steps: r.steps.map((s) => ({
        ...s,
        scheduledDays: s.scheduledDays ?? [],
      })),
    }));

    // Seed default AM/PM routines on first launch
    if (routines.length === 0) {
      routines = DEFAULT_ROUTINES;
      void saveJson(STORAGE_KEYS.routines, routines);
    }

    set({ routines, hydrated: true });
  },

  setRoutines: (routines) => {
    set({ routines });
    void saveJson(STORAGE_KEYS.routines, routines);
  },

  updateRoutine: (id, patch) => {
    const routines = get().routines.map((r) => (r.id === id ? { ...r, ...patch } : r));
    set({ routines });
    void saveJson(STORAGE_KEYS.routines, routines);
  },

  setStepHidden: (routineId, stepId, hidden) => {
    const routines = get().routines.map((r) => {
      if (r.id !== routineId) return r;
      return {
        ...r,
        steps: r.steps.map((s) => (s.id === stepId ? { ...s, hidden } : s)),
      };
    });
    set({ routines });
    void saveJson(STORAGE_KEYS.routines, routines);
  },
}));
