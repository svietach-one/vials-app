import { create } from 'zustand';

import {
  loadJson,
  loadSchemaVersion,
  persistSchemaVersionIfBehind,
  saveJson,
  STORAGE_KEYS,
} from '@/services/storage';
import { AppSettings, RoutineCycleType } from '@/types';

interface SettingsState extends AppSettings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setGamificationEnabled: (enabled: boolean) => void;
  markLocalDataWarningSeen: () => void;
  dismissBanner: (key: string) => void;
  setRoutineCycleType: (type: RoutineCycleType) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  gamificationEnabled: false,
  hasSeenLocalDataWarning: false,
  dismissedBanners: [],
  routineCycleType: 'fixed',
};

function pickSettings(s: SettingsState): AppSettings {
  return {
    gamificationEnabled: s.gamificationEnabled,
    hasSeenLocalDataWarning: s.hasSeenLocalDataWarning,
    dismissedBanners: s.dismissedBanners,
    routineCycleType: s.routineCycleType,
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,

  hydrate: async () => {
    const stored = await loadJson<Partial<AppSettings>>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    // Merge defaults so schema-v2 fields (routineCycleType) fill in for
    // settings persisted before they existed.
    const settings: AppSettings = { ...DEFAULT_SETTINGS, ...stored };
    set({ ...settings, hydrated: true });
    if (stored.routineCycleType === undefined) {
      void saveJson(STORAGE_KEYS.settings, settings);
    }
    persistSchemaVersionIfBehind(await loadSchemaVersion());
  },

  setGamificationEnabled: (enabled) => {
    set({ gamificationEnabled: enabled });
    void saveJson(STORAGE_KEYS.settings, pickSettings({ ...get(), gamificationEnabled: enabled }));
  },

  markLocalDataWarningSeen: () => {
    set({ hasSeenLocalDataWarning: true });
    void saveJson(STORAGE_KEYS.settings, pickSettings({ ...get(), hasSeenLocalDataWarning: true }));
  },

  dismissBanner: (key) => {
    const current = get();
    const next = [...new Set([...current.dismissedBanners, key])];
    set({ dismissedBanners: next });
    void saveJson(STORAGE_KEYS.settings, pickSettings({ ...current, dismissedBanners: next }));
  },

  setRoutineCycleType: (type) => {
    set({ routineCycleType: type });
    void saveJson(STORAGE_KEYS.settings, pickSettings({ ...get(), routineCycleType: type }));
  },
}));
