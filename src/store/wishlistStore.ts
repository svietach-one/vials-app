import { create } from 'zustand';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import { WishlistEntry } from '@/types';

/**
 * `WishlistEntry` store — Explore Composition flow
 * (docs/specs/explore-composition.md §6, tech design FE-5).
 *
 * Deliberately isolated: no import of `productsStore`, `conflictEngine.ts`,
 * or the Catalog filter/biomarker logic. Mirrors `productsStore.ts`'s
 * create()/hydrate/loadJson/saveJson pattern exactly, since this is the same
 * "local array persisted to AsyncStorage" shape, just for a different entity.
 */
interface WishlistState {
  entries: WishlistEntry[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addEntry: (entry: WishlistEntry) => void;
  updateEntry: (id: string, patch: Partial<WishlistEntry>) => void;
  removeEntry: (id: string) => void;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  entries: [],
  hydrated: false,

  hydrate: async () => {
    const entries = await loadJson<WishlistEntry[]>(STORAGE_KEYS.wishlistEntries, []);
    set({ entries, hydrated: true });
  },

  addEntry: (entry) => {
    const entries = [...get().entries, entry];
    set({ entries });
    void saveJson(STORAGE_KEYS.wishlistEntries, entries);
  },

  updateEntry: (id, patch) => {
    const entries = get().entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    set({ entries });
    void saveJson(STORAGE_KEYS.wishlistEntries, entries);
  },

  removeEntry: (id) => {
    const entries = get().entries.filter((e) => e.id !== id);
    set({ entries });
    void saveJson(STORAGE_KEYS.wishlistEntries, entries);
  },
}));
