import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { DebugAccountSyncCard } from '@/components/debug/DebugAccountSyncCard';
import { DebugOnboardingPreview } from '@/components/debug/DebugOnboardingPreview';
import { SkinProfileEditModal } from '@/components/profile/SkinProfileEditModal';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { ListRow } from '@/components/ui/core/ListRow';
import { Input } from '@/components/ui/forms/Input';
import { Switch } from '@/components/ui/forms/Switch';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { switchCycleType } from '@/domain/trackingActions';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { searchCities } from '@/utils/citySearch';
import { setContributionConsent } from '@/utils/contributionConsent';
import type {
  CityLocation,
  SkinPhototype,
  SkinType,
  UserProfile,
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily: 'Oily',
  dry: 'Dry',
  combination: 'Combination',
  normal: 'Normal',
};

const PHOTOTYPE_LABELS: Record<SkinPhototype, string> = {
  type_1_2: 'I–II',
  type_3_4: 'III–IV',
  type_5_6: 'V–VI',
};

const CONCERN_LABELS: Record<string, string> = {
  acne: 'Acne',
  dryness: 'Dryness',
  wrinkles: 'Wrinkles',
  sensitivity: 'Sensitivity',
  redness: 'Redness',
  hyperpigmentation: 'Hyperpigmentation',
  pores: 'Pores',
  dark_spots: 'Dark spots',
  eczema: 'Eczema',
};

async function exportAllData() {
  const backup = {
    vials_backup_version: 1,
    exported_at: new Date().toISOString(),
    profile: useProfileStore.getState().profile,
    products: useProductsStore.getState().products,
    routines: useRoutinesStore.getState().routines,
    procedures: useProceduresStore.getState().procedures,
  };

  try {
    await Share.share({
      title: 'Vials Data Backup',
      message: JSON.stringify(backup, null, 2),
    });
  } catch {
    // User dismissed — no action needed
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={sectionStyles.header}>{title}</Text>;
}

const sectionStyles = StyleSheet.create({
  header: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: space[1],
    marginTop: space[2],
  },
});

function ProfileSummary({ profile }: { profile: UserProfile | null }) {
  const chips: { label: string; filled: boolean }[] = [
    {
      label: profile?.gender === 'female' ? 'Female' : profile?.gender === 'male' ? 'Male' : 'Gender',
      filled: profile?.gender != null,
    },
    {
      label: profile?.age != null ? `Age ${profile.age}` : 'Age',
      filled: profile?.age != null,
    },
    {
      label: profile?.skinType ? SKIN_TYPE_LABELS[profile.skinType] : 'Skin type',
      filled: profile?.skinType != null,
    },
    {
      // Numeric Fitzpatrick is authoritative since FE-9; grouped is the fallback
      label: profile?.fitzpatrick
        ? `FP ${['I', 'II', 'III', 'IV', 'V', 'VI'][profile.fitzpatrick - 1]}`
        : profile?.phototype
          ? `FP ${PHOTOTYPE_LABELS[profile.phototype]}`
          : 'Phototype',
      filled: profile?.fitzpatrick != null || profile?.phototype != null,
    },
  ];

  return (
    <View style={summaryStyles.wrap}>
      <View style={summaryStyles.chips}>
        {chips.map(({ label, filled }) => (
          <View
            key={label}
            style={[summaryStyles.chip, filled && summaryStyles.chipFilled]}
          >
            <Text style={[summaryStyles.chipText, filled && summaryStyles.chipTextFilled]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {profile && profile.concerns.length > 0 ? (
        <Text style={summaryStyles.concerns}>
          {profile.concerns.map((c) => CONCERN_LABELS[c] ?? c).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  wrap: { gap: space[2] },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    paddingHorizontal: space[2] + 2,
    paddingVertical: 5,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    backgroundColor: colors.surfaceSunken,
  },
  chipFilled: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderStrong,
  },
  chipText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  chipTextFilled: {
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  concerns: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

// ─── City autocomplete (offline, research §1.7 — no GPS, no network) ──────────

function CityField({
  city,
  onSelect,
  onClear,
}: {
  city: CityLocation | null;
  onSelect: (city: CityLocation) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const suggestions = searchCities(query, 5);

  if (city) {
    return (
      <View style={cityStyles.selectedRow}>
        <Feather name="map-pin" size={16} color={colors.textSecondary} />
        <Text style={cityStyles.selectedName}>{city.name}</Text>
        <Pressable
          onPress={onClear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear city"
        >
          <Feather name="x" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={cityStyles.wrap}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search your city…"
        autoCorrect={false}
        returnKeyType="search"
      />
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion.name}
          onPress={() => {
            onSelect(suggestion);
            setQuery('');
          }}
          style={cityStyles.suggestionRow}
          accessibilityRole="button"
          accessibilityLabel={`Select ${suggestion.name}`}
        >
          <Feather name="map-pin" size={14} color={colors.textTertiary} />
          <Text style={cityStyles.suggestionText}>{suggestion.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const cityStyles = StyleSheet.create({
  wrap: { gap: space[1] },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
  },
  selectedName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[2],
  },
  suggestionText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const gamificationEnabled = useSettingsStore((s) => s.gamificationEnabled);
  const setGamificationEnabled = useSettingsStore((s) => s.setGamificationEnabled);
  const routineCycleType = useSettingsStore((s) => s.routineCycleType);

  function handleCycleToggle(enableDynamic: boolean) {
    if (!enableDynamic) {
      // Dynamic → fixed discards cycle progress — confirm first (research §1.4).
      // Manual weekly schedules are preserved: dynamic mode only masks them at
      // render (phase-06), so switching back restores them exactly.
      Alert.alert(
        'Switch to fixed days?',
        'Your skin-cycle progress will be discarded. Your manual weekly schedule and application counters are kept.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Switch', style: 'destructive', onPress: () => switchCycleType('fixed') },
        ],
      );
      return;
    }
    // Enabling dynamic keeps your saved weekly schedule — it is masked while
    // cycling, and returns unchanged if you switch back.
    switchCycleType('dynamic');
  }

  const productCount = useProductsStore((s) => s.products.length);
  const procedureCount = useProceduresStore((s) => s.procedures.length);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [debugOnboardingVisible, setDebugOnboardingVisible] = useState(false);

  function handleSaveProfile(patch: Partial<UserProfile>) {
    updateProfile(patch);
    setEditModalVisible(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader title="Profile" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Skin Profile ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <SectionHeader title="Skin Profile" />
            <Pressable
              onPress={() => setEditModalVisible(true)}
              style={styles.editBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit skin profile"
            >
              <Feather name="edit-2" size={14} color={palette.bottleGreen} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          <ProfileSummary profile={profile} />
        </View>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{productCount}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{procedureCount}</Text>
            <Text style={styles.statLabel}>Procedures</Text>
          </View>
        </View>

        {/* ── Settings ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Settings" />
          <View style={styles.card}>
            <ListRow
              title="Gamification"
              subtitle="Routine completion streaks and progress rings"
              trailing={
                <Switch
                  checked={gamificationEnabled}
                  onValueChange={setGamificationEnabled}
                  size="sm"
                />
              }
              divider
            />
            <ListRow
              title="SPF Sensitivity"
              subtitle="Flag chemical SPF conflicts in your routines"
              trailing={
                <Switch
                  checked={profile?.spfSensitivity ?? false}
                  onValueChange={(v) => updateProfile({ spfSensitivity: v })}
                  size="sm"
                />
              }
              divider
            />
            <ListRow
              title="Dynamic Skin Cycling"
              subtitle="4-night cycle driven by your daily check-in instead of fixed weekdays"
              trailing={
                <Switch
                  checked={routineCycleType === 'dynamic'}
                  onValueChange={handleCycleToggle}
                  size="sm"
                />
              }
              divider
            />
            <ListRow
              title="Share my photos with Vials"
              subtitle="Include your product photo in community contributions"
              trailing={
                <Switch
                  checked={profile?.contributionConsent?.granted ?? false}
                  onValueChange={(v) => updateProfile({ contributionConsent: setContributionConsent(v) })}
                  accessibilityLabel="Share my photos with Vials"
                  size="sm"
                />
              }
              divider={false}
            />
          </View>
          <Text style={styles.settingsHint}>
            Previously shared photos remain in the database.
          </Text>
        </View>

        {/* ── Weather & Seasons ────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Weather & Seasons" />
          <View style={styles.card}>
            <Text style={styles.cityHint}>
              Pick your city to let seasonal routine rules follow the real
              weather. No GPS — a weekly forecast check only.
            </Text>
            <CityField
              city={profile?.city ?? null}
              onSelect={(city) => updateProfile({ city })}
              onClear={() => updateProfile({ city: null })}
            />
          </View>
        </View>

        {/* ── Data ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Your Data" />
          <InlineAlert
            tone="info"
            icon={<Feather name="hard-drive" size={14} color={colors.statusInfo} />}
            title="Stored locally on this device"
          >
            Vials does not sync to the cloud. Export your data regularly to avoid losing it if you switch devices or reinstall the app.
          </InlineAlert>
          <View style={styles.card}>
            <ListRow
              leading={<Feather name="upload-cloud" size={18} color={colors.textSecondary} />}
              title="Export All Data"
              subtitle="Share a JSON backup of your full vault"
              onPress={exportAllData}
              chevron
              divider={false}
            />
          </View>
        </View>

        {/* ── Developer Tools (DEBUG ONLY — remove before shipping) ──────── */}
        {__DEV__ && (
          <View style={styles.section}>
            <SectionHeader title="Developer Tools (Debug)" />
            <View style={[styles.card, styles.debugCard]}>
              <ListRow
                leading={<Feather name="eye" size={18} color={colors.statusWarning} />}
                title="Debug: View Onboarding"
                subtitle="Your skin profile is restored on exit — picking a real product still adds it to My Shelf"
                onPress={() => setDebugOnboardingVisible(true)}
                chevron
                divider
              />
              <DebugAccountSyncCard />
            </View>
          </View>
        )}

        {/* ── About ────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="About" />
          <View style={styles.card}>
            <ListRow
              leading={<Feather name="info" size={18} color={colors.textSecondary} />}
              title="Vials"
              subtitle="Version 1.0.0 — Phase 1 MVP"
              divider={false}
            />
          </View>
        </View>
      </ScrollView>

      <SkinProfileEditModal
        visible={editModalVisible}
        profile={profile}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveProfile}
      />

      {__DEV__ && (
        <DebugOnboardingPreview
          visible={debugOnboardingVisible}
          onClose={() => setDebugOnboardingVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[5],
    paddingBottom: space[16],
    gap: space[4],
  },

  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
  },
  debugCard: {
    borderColor: colors.statusWarningLine,
    backgroundColor: colors.statusWarningTint,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: space[1],
  },
  editBtnText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.bottleGreen,
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space[4],
    gap: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.borderDivider,
    marginVertical: space[3],
  },
  statValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  section: { gap: space[2] },

  settingsHint: {
    ...typography.caption,
    color: colors.textTertiary,
  },

  cityHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
