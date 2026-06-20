import { create } from 'zustand';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import { AppSettings } from '@/types';

interface SettingsState extends AppSettings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setGamificationEnabled: (enabled: boolean) => void;
  markLocalDataWarningSeen: () => void;
  dismissBanner: (key: string) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  gamificationEnabled: false,
  hasSeenLocalDataWarning: false,
  dismissedBanners: [],
};

function pickSettings(s: SettingsState): AppSettings {
  return {
    gamificationEnabled: s.gamificationEnabled,
    hasSeenLocalDataWarning: s.hasSeenLocalDataWarning,
    dismissedBanners: s.dismissedBanners,
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,

  hydrate: async () => {
    const settings = await loadJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    set({ ...settings, hydrated: true });
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
}));
