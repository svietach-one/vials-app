import { create } from 'zustand';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import { generateId } from '@/utils/generateId';
import type { ProductType, Routine, RoutineStep } from '@/types';

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
  /** Add or update the step for a product in a routine. */
  upsertProductStep: (routineId: string, productId: string, productType: ProductType, scheduledDays: number[]) => void;
  /** Remove the step for a product from a routine. */
  removeProductStep: (routineId: string, productId: string) => void;
  /** Replace the steps array for a routine (used for drag-and-drop reordering). */
  reorderSteps: (routineId: string, steps: RoutineStep[]) => void;
  /**
   * Remove a step for a specific day of week only.
   * If the step was scheduled for all days (scheduledDays=[]), it becomes scheduled
   * for every other day. If it was only scheduled for that day, it is removed entirely.
   */
  removeStepFromDay: (routineId: string, stepId: string, dow: number) => void;
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

  upsertProductStep: (routineId, productId, productType, scheduledDays) => {
    const routines = get().routines.map((r) => {
      if (r.id !== routineId) return r;
      const exists = r.steps.some((s) => s.productId === productId);
      const steps = exists
        ? r.steps.map((s) =>
            s.productId === productId ? { ...s, scheduledDays, hidden: false } : s,
          )
        : [...r.steps, { id: generateId(), productType, productId, hidden: false, scheduledDays }];
      return { ...r, steps };
    });
    set({ routines });
    void saveJson(STORAGE_KEYS.routines, routines);
  },

  removeProductStep: (routineId, productId) => {
    const routines = get().routines.map((r) => {
      if (r.id !== routineId) return r;
      return { ...r, steps: r.steps.filter((s) => s.productId !== productId) };
    });
    set({ routines });
    void saveJson(STORAGE_KEYS.routines, routines);
  },

  reorderSteps: (routineId, steps) => {
    const routines = get().routines.map((r) =>
      r.id === routineId ? { ...r, steps } : r,
    );
    set({ routines });
    void saveJson(STORAGE_KEYS.routines, routines);
  },

  removeStepFromDay: (routineId, stepId, dow) => {
    const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
    const routines = get().routines.map((r) => {
      if (r.id !== routineId) return r;
      const steps = r.steps.reduce<RoutineStep[]>((acc, s) => {
        if (s.id !== stepId) {
          acc.push(s);
          return acc;
        }
        const effectiveDays = s.scheduledDays.length === 0 ? ALL_DAYS : s.scheduledDays;
        const remaining = effectiveDays.filter((d) => d !== dow);
        if (remaining.length > 0) acc.push({ ...s, scheduledDays: remaining });
        return acc;
      }, []);
      return { ...r, steps };
    });
    set({ routines });
    void saveJson(STORAGE_KEYS.routines, routines);
  },
}));
