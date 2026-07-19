import { create } from 'zustand';

import {
  loadJson,
  loadSchemaVersion,
  persistSchemaVersionIfBehind,
  saveJson,
  STORAGE_KEYS,
} from '@/services/storage';
import { UserProfile } from '@/types';
import {
  deriveFitzpatrick,
  deriveGroupedPhototype,
  migrateProfile,
} from '@/utils/routineEngine/migrations';

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
  fitzpatrick: null,
  city: null,
  concerns: [],
  primaryGoal: 'maintenance',
  secondaryGoal: null,
  goalNeedsConfirmation: false,
  phototypeNeedsConfirmation: false,
  spfSensitivity: false,
  onboardingCompleted: false,
  individualDurationMonths: {},
};

/**
 * Keeps the grouped `phototype` and numeric `fitzpatrick` fields in sync.
 * FE-9 flipped the UI to the six-card numeric input, so a patch touching
 * `fitzpatrick` is authoritative and re-derives the grouped field; legacy
 * writes touching only `phototype` re-derive the numeric one (grouped can't
 * distinguish members, so the stricter-member map applies).
 */
function syncPhototypeFields(
  profile: UserProfile,
  patch: Partial<UserProfile>,
): UserProfile {
  if ('fitzpatrick' in patch) {
    const grouped = deriveGroupedPhototype(profile.fitzpatrick);
    return profile.phototype === grouped ? profile : { ...profile, phototype: grouped };
  }
  const derived = deriveFitzpatrick(profile.phototype);
  return profile.fitzpatrick === derived ? profile : { ...profile, fitzpatrick: derived };
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  hydrated: false,

  hydrate: async () => {
    const raw = await loadJson(STORAGE_KEYS.profile, DEFAULT_PROFILE);
    const profile = migrateProfile(raw);
    set({ profile, hydrated: true });
    if (profile !== raw) void saveJson(STORAGE_KEYS.profile, profile);
    persistSchemaVersionIfBehind(await loadSchemaVersion());
  },

  setProfile: (profile) => {
    // A full replacement carries both fields; treat the numeric one as authoritative
    const next = syncPhototypeFields(profile, { fitzpatrick: profile.fitzpatrick });
    set({ profile: next });
    void saveJson(STORAGE_KEYS.profile, next);
  },

  updateProfile: (patch) => {
    const current = get().profile ?? DEFAULT_PROFILE;
    const next = syncPhototypeFields({ ...current, ...patch }, patch);
    set({ profile: next });
    void saveJson(STORAGE_KEYS.profile, next);
  },
}));
