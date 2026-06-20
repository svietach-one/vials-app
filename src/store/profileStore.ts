import { create } from 'zustand';

import { loadJson, saveJson, STORAGE_KEYS } from '@/services/storage';
import { UserProfile } from '@/types';

interface ProfileState {
  profile: UserProfile | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
}

const DEFAULT_PROFILE: UserProfile = {
  id: 'local-user',
  gender: null,
  age: null,
  skinType: null,
  phototype: null,
  concerns: [],
  spfSensitivity: false,
  onboardingCompleted: false,
  individualDurationMonths: {},
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  hydrated: false,

  hydrate: async () => {
    const profile = await loadJson(STORAGE_KEYS.profile, DEFAULT_PROFILE);
    set({ profile, hydrated: true });
  },

  setProfile: (profile) => {
    set({ profile });
    void saveJson(STORAGE_KEYS.profile, profile);
  },

  updateProfile: (patch) => {
    const current = get().profile ?? DEFAULT_PROFILE;
    const next = { ...current, ...patch };
    set({ profile: next });
    void saveJson(STORAGE_KEYS.profile, next);
  },
}));
