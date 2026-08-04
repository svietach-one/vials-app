import { create } from 'zustand';

import {
  loadJson,
  loadSchemaVersion,
  persistSchemaVersionIfBehind,
  saveJson,
  STORAGE_KEYS,
} from '@/services/storage';
import {
  AppSettings,
  ContributionConsentStatus,
  NoticeCollapseEntry,
  RoutineAccordionSettings,
  RoutineCycleType,
} from '@/types';

interface SettingsState extends AppSettings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setGamificationEnabled: (enabled: boolean) => void;
  markLocalDataWarningSeen: () => void;
  dismissBanner: (key: string) => void;
  setRoutineCycleType: (type: RoutineCycleType) => void;
  /** Bumps the local per-device community contribution counter. */
  incrementCommunityContribution: () => void;
  /** Overwrites today's Routines screen accordion snapshot. */
  setRoutineAccordion: (snapshot: RoutineAccordionSettings) => void;
  /** Overwrites one RehabNoticeCard's collapse decision, keyed by RehabNotice.key. */
  setRehabNoticeCollapsed: (key: string, entry: NoticeCollapseEntry) => void;
  /**
   * Overwrites one ConflictWarningInline row's collapse decision on the
   * Routines screen, keyed by the row's own stable id.
   */
  setRoutineNoticeCollapsed: (key: string, entry: NoticeCollapseEntry) => void;
  /** Records acceptance of the onboarding medical disclaimer (slide 3). */
  acceptMedicalDisclaimer: (version: number) => void;
  /**
   * Transitions the product-contribution consent state machine. Setting to
   * 'accepted', 'disabled', or 'unset' resets declinedSaveCountSinceLastReminder;
   * setting to 'unset' (re-enabling from 'disabled') also resets reminderCountShown,
   * so a re-enabled user gets the full first-time modal and cadence again.
   */
  setContributionConsentStatus: (status: ContributionConsentStatus) => void;
  incrementDeclinedSaveCount: () => void;
  resetDeclinedSaveCount: () => void;
  incrementReminderCountShown: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  gamificationEnabled: false,
  hasSeenLocalDataWarning: false,
  dismissedBanners: [],
  routineCycleType: 'fixed',
  communityContributionCount: 0,
  routineAccordion: null,
  rehabNoticeCollapsed: {},
  routineNoticeCollapsed: {},
  medicalDisclaimerAcceptedAt: null,
  medicalDisclaimerVersion: 0,
  contributionConsentStatus: 'unset',
  declinedSaveCountSinceLastReminder: 0,
  reminderCountShown: 0,
};

function pickSettings(s: SettingsState): AppSettings {
  return {
    gamificationEnabled: s.gamificationEnabled,
    hasSeenLocalDataWarning: s.hasSeenLocalDataWarning,
    dismissedBanners: s.dismissedBanners,
    routineCycleType: s.routineCycleType,
    communityContributionCount: s.communityContributionCount,
    routineAccordion: s.routineAccordion,
    rehabNoticeCollapsed: s.rehabNoticeCollapsed,
    routineNoticeCollapsed: s.routineNoticeCollapsed,
    medicalDisclaimerAcceptedAt: s.medicalDisclaimerAcceptedAt,
    medicalDisclaimerVersion: s.medicalDisclaimerVersion,
    contributionConsentStatus: s.contributionConsentStatus,
    declinedSaveCountSinceLastReminder: s.declinedSaveCountSinceLastReminder,
    reminderCountShown: s.reminderCountShown,
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

  incrementCommunityContribution: () => {
    const next = get().communityContributionCount + 1;
    set({ communityContributionCount: next });
    void saveJson(
      STORAGE_KEYS.settings,
      pickSettings({ ...get(), communityContributionCount: next }),
    );
  },

  setRoutineAccordion: (snapshot) => {
    set({ routineAccordion: snapshot });
    void saveJson(STORAGE_KEYS.settings, pickSettings({ ...get(), routineAccordion: snapshot }));
  },

  setRehabNoticeCollapsed: (key, entry) => {
    const next = { ...get().rehabNoticeCollapsed, [key]: entry };
    set({ rehabNoticeCollapsed: next });
    void saveJson(STORAGE_KEYS.settings, pickSettings({ ...get(), rehabNoticeCollapsed: next }));
  },

  setRoutineNoticeCollapsed: (key, entry) => {
    const next = { ...get().routineNoticeCollapsed, [key]: entry };
    set({ routineNoticeCollapsed: next });
    void saveJson(STORAGE_KEYS.settings, pickSettings({ ...get(), routineNoticeCollapsed: next }));
  },

  acceptMedicalDisclaimer: (version) => {
    const acceptedAt = new Date().toISOString();
    set({ medicalDisclaimerAcceptedAt: acceptedAt, medicalDisclaimerVersion: version });
    void saveJson(
      STORAGE_KEYS.settings,
      pickSettings({
        ...get(),
        medicalDisclaimerAcceptedAt: acceptedAt,
        medicalDisclaimerVersion: version,
      }),
    );
  },

  setContributionConsentStatus: (status) => {
    const resetsDeclinedCount = status === 'accepted' || status === 'disabled' || status === 'unset';
    const resetsReminderCount = status === 'unset';
    const patch = {
      contributionConsentStatus: status,
      ...(resetsDeclinedCount ? { declinedSaveCountSinceLastReminder: 0 } : null),
      ...(resetsReminderCount ? { reminderCountShown: 0 } : null),
    };
    set(patch);
    void saveJson(STORAGE_KEYS.settings, pickSettings({ ...get(), ...patch }));
  },

  incrementDeclinedSaveCount: () => {
    const next = get().declinedSaveCountSinceLastReminder + 1;
    set({ declinedSaveCountSinceLastReminder: next });
    void saveJson(
      STORAGE_KEYS.settings,
      pickSettings({ ...get(), declinedSaveCountSinceLastReminder: next }),
    );
  },

  resetDeclinedSaveCount: () => {
    set({ declinedSaveCountSinceLastReminder: 0 });
    void saveJson(
      STORAGE_KEYS.settings,
      pickSettings({ ...get(), declinedSaveCountSinceLastReminder: 0 }),
    );
  },

  incrementReminderCountShown: () => {
    const next = get().reminderCountShown + 1;
    set({ reminderCountShown: next });
    void saveJson(STORAGE_KEYS.settings, pickSettings({ ...get(), reminderCountShown: next }));
  },
}));
