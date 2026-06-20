import { create } from 'zustand';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import { UserProcedureLog } from '@/types';

interface ProceduresState {
  procedures: UserProcedureLog[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addProcedure: (log: UserProcedureLog) => void;
  updateProcedure: (id: string, patch: Partial<UserProcedureLog>) => void;
  removeProcedure: (id: string) => void;
}

export const useProceduresStore = create<ProceduresState>((set, get) => ({
  procedures: [],
  hydrated: false,

  hydrate: async () => {
    const procedures = await loadJson<UserProcedureLog[]>(STORAGE_KEYS.procedures, []);
    set({ procedures, hydrated: true });
  },

  addProcedure: (log) => {
    const procedures = [...get().procedures, log];
    set({ procedures });
    void saveJson(STORAGE_KEYS.procedures, procedures);
  },

  updateProcedure: (id, patch) => {
    const procedures = get().procedures.map((p) =>
      p.id === id ? { ...p, ...patch } : p,
    );
    set({ procedures });
    void saveJson(STORAGE_KEYS.procedures, procedures);
  },

  removeProcedure: (id) => {
    const procedures = get().procedures.filter((p) => p.id !== id);
    set({ procedures });
    void saveJson(STORAGE_KEYS.procedures, procedures);
  },
}));
