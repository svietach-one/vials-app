import { create } from 'zustand';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';

/**
 * Per-card routine completion (docs/specs/routine-step-grouping/PRD_Spec.md
 * §6). A record is `(productId, routineId, date)` — `period` is deliberately
 * NOT part of the key, since `Routine.timeOfDay` already carries it and a
 * second copy would be a chance for the two to disagree. Completely separate
 * from `ProductApplicationStats` (trackingStore): this store records what
 * the user says they DID; the ramp counts what was SCHEDULED. Never feed one
 * into the other (PRD_Spec.md §6.3 — out of scope).
 *
 * Mirrors `wishlistStore.ts`'s create()/hydrate/loadJson/saveJson shape —
 * the same "local array persisted to AsyncStorage" pattern.
 */

export interface CompletionRecord {
  productId: string;
  routineId: string;
  /** Skincare date (YYYY-MM-DD), see getSkincareDateString — 04:00 boundary. */
  date: string;
}

interface CompletionState {
  completions: CompletionRecord[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  isCompleted: (productId: string, routineId: string, date: string) => boolean;
  toggleCompleted: (productId: string, routineId: string, date: string) => void;
}

function matches(record: CompletionRecord, productId: string, routineId: string, date: string): boolean {
  return record.productId === productId && record.routineId === routineId && record.date === date;
}

export const useCompletionStore = create<CompletionState>((set, get) => ({
  completions: [],
  hydrated: false,

  hydrate: async () => {
    const completions = await loadJson<CompletionRecord[]>(STORAGE_KEYS.completions, []);
    set({ completions, hydrated: true });
  },

  isCompleted: (productId, routineId, date) =>
    get().completions.some((r) => matches(r, productId, routineId, date)),

  toggleCompleted: (productId, routineId, date) => {
    const current = get().completions;
    const exists = current.some((r) => matches(r, productId, routineId, date));
    const next = exists
      ? current.filter((r) => !matches(r, productId, routineId, date))
      : [...current, { productId, routineId, date }];
    set({ completions: next });
    void saveJson(STORAGE_KEYS.completions, next);
  },
}));
