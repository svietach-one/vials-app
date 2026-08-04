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
import { Icon, type IconName } from '@/components/ui/Icon';

import { DebugAccountSyncCard } from '@/components/debug/DebugAccountSyncCard';
import { DebugOnboardingPreview } from '@/components/debug/DebugOnboardingPreview';
import { SkinProfileEditModal } from '@/components/profile/SkinProfileEditModal';
import { AppHeader } from '@/components/ui/core/AppHeader';
import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { ListRow } from '@/components/ui/core/ListRow';
import { Input } from '@/components/ui/forms/Input';
import { Switch } from '@/components/ui/forms/Switch';
import { LOCAL_STORAGE_NOTICE_ENABLED } from '@/constants/featureFlags';
import { GOAL_LABELS } from '@/constants/labels';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';
import { switchCycleType } from '@/domain/trackingActions';
import { useProceduresStore } from '@/store/proceduresStore';
import { useProductsStore } from '@/store/productsStore';
import { useProfileStore } from '@/store/profileStore';
import { useRoutinesStore } from '@/store/routinesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { searchCities } from '@/utils/citySearch';
import { setContributionConsent } from '@/utils/contributionConsent';
import { contributedProductsCount } from '@/utils/contributionConsentFlow';
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
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.18,
    color: colors.textPrimary,
  },
});

// Shared plum-tinted circle used for every leading glyph on this screen —
// stats, settings rows, weather, data — so icons read as one family.
function IconCircle({ name }: { name: IconName }) {
  return (
    <View style={iconCircleStyles.circle}>
      <Icon name={name} size={18} color={palette.plum} />
    </View>
  );
}

const iconCircleStyles = StyleSheet.create({
  circle: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: palette.plumTint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

function ProfileGrid({ profile }: { profile: UserProfile | null }) {
  const genderValue =
    profile?.gender === 'female' ? 'Female' : profile?.gender === 'male' ? 'Male' : '—';
  const ageValue = profile?.age != null ? String(profile.age) : '—';
  const skinTypeValue = profile?.skinType ? SKIN_TYPE_LABELS[profile.skinType] : '—';
  // Numeric Fitzpatrick is authoritative since FE-9; grouped is the fallback.
  const fitzpatrickValue = profile?.fitzpatrick
    ? ['I', 'II', 'III', 'IV', 'V', 'VI'][profile.fitzpatrick - 1]
    : profile?.phototype
      ? PHOTOTYPE_LABELS[profile.phototype]
      : '—';

  const goalsValue = profile
    ? [profile.primaryGoal, profile.secondaryGoal]
        .filter((g): g is NonNullable<typeof g> => g != null)
        .map((g) => GOAL_LABELS[g])
        .join(', ')
    : '—';

  const concernsValue =
    profile && profile.concerns.length > 0
      ? profile.concerns.map((c) => CONCERN_LABELS[c] ?? c).join(', ')
      : 'None reported';

  return (
    <View style={gridStyles.wrap}>
      <View style={[gridStyles.row, gridStyles.rowDivider]}>
        <GridCell label="Gender" value={genderValue} />
        <View style={gridStyles.colDivider} />
        <GridCell label="Age" value={ageValue} />
      </View>
      <View style={[gridStyles.row, gridStyles.rowDivider]}>
        <GridCell label="Skin type" value={skinTypeValue} />
        <View style={gridStyles.colDivider} />
        <GridCell label="Fitzpatrick" value={fitzpatrickValue} />
      </View>
      <View style={gridStyles.row}>
        <GridCell label="Skin goals" value={goalsValue} />
        <View style={gridStyles.colDivider} />
        <GridCell label="Concerns" value={concernsValue} />
      </View>
    </View>
  );
}

function GridCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={gridStyles.cell}>
      <Text style={gridStyles.cellLabel}>{label}</Text>
      <Text style={gridStyles.cellValue}>{value}</Text>
    </View>
  );
}

const gridStyles = StyleSheet.create({
  wrap: {},
  row: {
    flexDirection: 'row',
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
    paddingBottom: space[3],
    marginBottom: space[3],
  },
  colDivider: {
    width: 1,
    backgroundColor: colors.borderDivider,
    marginHorizontal: space[4],
  },
  cell: {
    flex: 1,
    gap: 4,
  },
  cellLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cellValue: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.16,
    color: colors.textPrimary,
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
        <Icon name="map-pin" size={16} color={colors.textSecondary} />
        <Text style={cityStyles.selectedName}>{city.name}</Text>
        <IconButton
          icon={<Icon name="x" size={16} color={colors.textTertiary} />}
          label="Clear city"
          variant="ghost"
          size="xs"
          onPress={onClear}
        />
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
          <Icon name="map-pin" size={14} color={colors.textTertiary} />
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

  const contributionConsentStatus = useSettingsStore((s) => s.contributionConsentStatus);
  const setContributionConsentStatus = useSettingsStore((s) => s.setContributionConsentStatus);
  const products = useProductsStore((s) => s.products);
  const contributedCount = contributedProductsCount(products);

  function handleContributionToggle(v: boolean) {
    if (v) {
      // Re-enabling from 'disabled' is a fresh start (unset), not a silent
      // resume of 'accepted' — the full explainer modal reappears next save.
      setContributionConsentStatus(contributionConsentStatus === 'disabled' ? 'unset' : 'accepted');
    } else {
      setContributionConsentStatus('disabled');
    }
  }

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

  const productCount = products.length;
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
            <Button
              variant="textActive"
              size="sm"
              icon={<Icon name="edit-2" size={14} color={palette.plum} />}
              onPress={() => setEditModalVisible(true)}
              accessibilityLabel="Edit skin profile"
            >
              Edit
            </Button>
          </View>
          <ProfileGrid profile={profile} />
        </View>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <IconCircle name="package" />
            <View>
              <Text style={styles.statValue}>{productCount}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <IconCircle name="syringe" />
            <View>
              <Text style={styles.statValue}>{procedureCount}</Text>
              <Text style={styles.statLabel}>Procedures</Text>
            </View>
          </View>
        </View>

        {/* ── Settings ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.card}>
            <SectionHeader title="Settings" />
            <ListRow
              leading={<IconCircle name="award" />}
              title="Gamification"
              subtitle="Routine completion streaks and progress rings"
              titleNumberOfLines={0}
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
              leading={<IconCircle name="shield-check" />}
              title="SPF Sensitivity"
              subtitle="Flag chemical SPF conflicts in your routines"
              titleNumberOfLines={0}
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
              leading={<IconCircle name="target" />}
              title="Dynamic Skin Cycling"
              subtitle="4-night cycle driven by your daily check-in instead of fixed weekdays"
              titleNumberOfLines={0}
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
              leading={<IconCircle name="camera" />}
              title="Share my photos with Vials"
              subtitle="Include your product photo in community contributions"
              titleNumberOfLines={0}
              trailing={
                <Switch
                  checked={profile?.contributionConsent?.granted ?? false}
                  onValueChange={(v) => updateProfile({ contributionConsent: setContributionConsent(v) })}
                  accessibilityLabel="Share my photos with Vials"
                  size="sm"
                />
              }
              divider
            />
            <ListRow
              leading={<IconCircle name="gift" />}
              title="Share new products with Vials"
              subtitle={`${contributedCount} products contributed so far`}
              titleNumberOfLines={0}
              trailing={
                <Switch
                  checked={contributionConsentStatus === 'accepted'}
                  onValueChange={handleContributionToggle}
                  accessibilityLabel="Share new products with Vials"
                  size="sm"
                />
              }
              divider={false}
            />
            <InlineAlert tone="neutral">
              <View style={styles.settingsHintStack}>
                <Text style={styles.settingsHintText}>
                  Previously shared photos remain in the database.
                </Text>
                <Text style={styles.settingsHintText}>
                  Turning this off stops future contributions. Products already shared stay in the database.
                </Text>
              </View>
            </InlineAlert>
          </View>
        </View>

        {/* ── Weather & Seasons ────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.card}>
            <SectionHeader title="Weather & Seasons" />
            <ListRow
              leading={<IconCircle name="cloud-sun" />}
              title="Pick your city"
              subtitle="Follow seasonal routine rules based on real weather."
              divider={false}
            />
            <CityField
              city={profile?.city ?? null}
              onSelect={(city) => updateProfile({ city })}
              onClear={() => updateProfile({ city: null })}
            />
          </View>
        </View>

        {/* ── Data ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          {LOCAL_STORAGE_NOTICE_ENABLED ? (
            <InlineAlert
              tone="info"
              icon={<Icon name="hard-drive" size={14} color={colors.statusInfo} />}
              title="Stored locally on this device"
            >
              Vials does not sync to the cloud. Export your data regularly to avoid losing it if you switch devices or reinstall the app.
            </InlineAlert>
          ) : null}
          <View style={styles.card}>
            <SectionHeader title="Your Data" />
            <ListRow
              leading={<IconCircle name="upload-cloud" />}
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
            <View style={[styles.card, styles.debugCard]}>
              <SectionHeader title="Developer Tools (Debug)" />
              <ListRow
                leading={<Icon name="eye" size={18} color={colors.statusWarning} />}
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
          <View style={styles.card}>
            <SectionHeader title="About" />
            <ListRow
              leading={<IconCircle name="info" />}
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
    backgroundColor: colors.bgScreen,
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
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    gap: space[3],
    ...shadow.sm,
  },
  debugCard: {
    borderWidth: 1,
    borderColor: colors.statusWarningLine,
    backgroundColor: colors.statusWarningTint,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  statCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    // Matches the card padding (space[4]) + ListRow's own inset (space[1])
    // so this icon lines up with every leading icon below it (e.g. Settings).
    paddingVertical: space[4],
    paddingLeft: space[4] + space[1],
    gap: space[3],
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.borderDivider,
    marginVertical: space[3],
  },
  statValue: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.16,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  section: { gap: space[2] },

  settingsHintStack: { gap: space[1] },
  settingsHintText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
