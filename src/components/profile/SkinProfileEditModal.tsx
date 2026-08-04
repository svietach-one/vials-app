import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { FitzpatrickCard } from '@/components/onboarding/PhototypeCard';
import { GoalSelector } from '@/components/profile/GoalSelector';
import { SkinConcernsSelector } from '@/components/profile/SkinConcernsSelector';
import { Button } from '@/components/ui/core/Button';
import { FilterChip } from '@/components/ui/core/FilterChip';
import { IconButton } from '@/components/ui/core/IconButton';
import { ListRow } from '@/components/ui/core/ListRow';
import { Input } from '@/components/ui/forms/Input';
import { Switch } from '@/components/ui/forms/Switch';
import { colors, space, typography } from '@/constants/tokens';
import {
  GENDER_CAPTION,
  GENDER_OPTIONS,
  HORMONE_THERAPY_HINT,
  HORMONE_THERAPY_LABEL,
  PREGNANCY_HINT,
  PREGNANCY_LABEL,
  SKIN_TYPE_OPTIONS,
} from '@/constants/labels';
import type {
  FitzpatrickType,
  SkinConcern,
  SkinConditionType,
  SkinGoal,
  SkinType,
  UserProfile,
} from '@/types';

// ─── Data ─────────────────────────────────────────────────────────────────────

const FITZPATRICK_TYPES: FitzpatrickType[] = [1, 2, 3, 4, 5, 6];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SkinProfileEditModalProps {
  visible: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onSave: (patch: Partial<UserProfile>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SkinProfileEditModal({
  visible,
  profile,
  onClose,
  onSave,
}: SkinProfileEditModalProps) {
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<SkinGoal>('maintenance');
  const [secondaryGoal, setSecondaryGoal] = useState<SkinGoal | null>(null);
  const [fitzpatrick, setFitzpatrick] = useState<FitzpatrickType | null>(null);
  const [ageText, setAgeText] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  const [hormoneTherapy, setHormoneTherapy] = useState(false);
  const [pregnantOrBreastfeeding, setPregnantOrBreastfeeding] = useState(false);
  const [concerns, setConcerns] = useState<SkinConcern[]>([]);
  const [skinConditions, setSkinConditions] = useState<SkinConditionType[]>([]);
  const [spfSensitivity, setSpfSensitivity] = useState(false);

  // Pre-fill from current profile on open
  useEffect(() => {
    if (!visible) return;
    setSkinType(profile?.skinType ?? null);
    setPrimaryGoal(profile?.primaryGoal ?? 'maintenance');
    setSecondaryGoal(profile?.secondaryGoal ?? null);
    setFitzpatrick(profile?.fitzpatrick ?? null);
    setAgeText(profile?.age != null ? String(profile.age) : '');
    setGender(profile?.gender ?? null);
    setHormoneTherapy(profile?.hormoneTherapy ?? false);
    setPregnantOrBreastfeeding(profile?.pregnantOrBreastfeeding ?? false);
    setConcerns(profile?.concerns ?? []);
    setSkinConditions(profile?.skinConditions ?? []);
    setSpfSensitivity(profile?.spfSensitivity ?? false);
  }, [visible, profile]);

  function handleSave() {
    const parsedAge = parseInt(ageText, 10);
    onSave({
      skinType,
      primaryGoal,
      secondaryGoal,
      // Saving from the editor IS the user choosing — no confirmation owed
      goalNeedsConfirmation: false,
      fitzpatrick,
      // Choosing on the 6-card selector IS confirming the skin tone.
      phototypeNeedsConfirmation: false,
      age: Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : null,
      gender,
      hormoneTherapy,
      pregnantOrBreastfeeding,
      concerns,
      skinConditions,
      spfSensitivity,
    });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.safe}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Skin Profile</Text>
            <IconButton
              icon={<Icon name="x" size={20} color={colors.textSecondary} />}
              label="Close"
              variant="secondary"
              size="sm"
              onPress={onClose}
            />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Skin type — order below mirrors the onboarding flow (SkinTypeStep
                → GoalsStep → PhototypeStep → AboutYouStep → AdditionalInfoStep)
                field for field, so editing here matches what onboarding asked. */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Skin Type</Text>
              <View style={styles.chipRow}>
                {SKIN_TYPE_OPTIONS.map(({ value, label }) => (
                  <FilterChip
                    key={value}
                    selected={skinType === value}
                    onPress={() => setSkinType(skinType === value ? null : value)}
                  >
                    {label}
                  </FilterChip>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Care goals (V2.1 Step 0) */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Care Goals</Text>
              <Text style={styles.fieldHint}>
                Pick up to two. Routines are built around your primary goal; leave empty for
                maintenance care.
              </Text>
              <GoalSelector
                primaryGoal={primaryGoal}
                secondaryGoal={secondaryGoal}
                onChange={(primary, secondary) => {
                  setPrimaryGoal(primary);
                  setSecondaryGoal(secondary);
                }}
              />
            </View>

            <View style={styles.divider} />

            {/* Phototype */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Skin Tone (Fitzpatrick)</Text>
              <View style={styles.phototypeRow}>
                {FITZPATRICK_TYPES.map((ft) => (
                  <FitzpatrickCard
                    key={ft}
                    type={ft}
                    selected={fitzpatrick === ft}
                    onSelect={() => setFitzpatrick(fitzpatrick === ft ? null : ft)}
                    style={styles.phototypeCard}
                  />
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Age */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Age</Text>
              <Input
                value={ageText}
                onChangeText={setAgeText}
                placeholder="e.g. 28"
                keyboardType="number-pad"
                maxLength={3}
                returnKeyType="done"
              />
            </View>

            {/* Gender */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.chipRow}>
                {GENDER_OPTIONS.map(({ value, label }) => (
                  <FilterChip
                    key={value ?? 'unspecified'}
                    selected={gender === value}
                    onPress={() => setGender(value)}
                  >
                    {label}
                  </FilterChip>
                ))}
              </View>
              <Text style={styles.fieldHint}>{GENDER_CAPTION}</Text>
            </View>

            {/* Hormone therapy */}
            <ListRow
              title={HORMONE_THERAPY_LABEL}
              titleStyle={styles.fieldLabel}
              subtitle={HORMONE_THERAPY_HINT}
              divider={false}
              style={styles.listRowFlush}
              trailing={
                <Switch
                  checked={hormoneTherapy}
                  onValueChange={setHormoneTherapy}
                  accessibilityLabel={HORMONE_THERAPY_LABEL}
                />
              }
            />

            <View style={styles.divider} />

            {/* Pregnant or breastfeeding */}
            <ListRow
              title={PREGNANCY_LABEL}
              titleStyle={styles.fieldLabel}
              subtitle={PREGNANCY_HINT}
              divider={false}
              style={styles.listRowFlush}
              trailing={
                <Switch
                  checked={pregnantOrBreastfeeding}
                  onValueChange={setPregnantOrBreastfeeding}
                  accessibilityLabel={PREGNANCY_LABEL}
                />
              }
            />

            {/* Skin concerns — merges skin concerns with skin conditions (v1.2,
                US-23) into one deduplicated chip list; shared with onboarding
                (SkinProfileSetupScreen) so the two screens can't drift apart. */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Skin concerns (optional)</Text>
              <SkinConcernsSelector
                concerns={concerns}
                skinConditions={skinConditions}
                onChangeConcerns={setConcerns}
                onChangeConditions={setSkinConditions}
              />
            </View>

            <View style={styles.divider} />

            {/* SPF sensitivity — profile-only setting, no onboarding step asks
                for it, so it stays last rather than slotted into the mirrored
                order above. */}
            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <Text style={styles.switchTitle}>SPF Sensitivity</Text>
                <Text style={styles.switchDesc}>
                  Flag chemical SPF ingredient conflicts in routines
                </Text>
              </View>
              <Switch
                checked={spfSensitivity}
                onValueChange={setSpfSensitivity}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button variant="secondary" size="lg" onPress={onClose} style={styles.footerBtn}>
              Cancel
            </Button>
            <Button size="lg" onPress={handleSave} style={styles.footerBtn}>
              Save
            </Button>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDivider,
  },
  headerTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[5],
    paddingBottom: space[6],
    gap: space[5],
  },
  field: { gap: space[2] },
  divider: { height: 1, backgroundColor: colors.borderDivider },
  // Block heading — one step up from the app's default `label`/`body` sizes,
  // shared by every section title in this sheet (field labels, and the
  // hormone-therapy / pregnancy / SPF row titles via `titleStyle`/`switchTitle`
  // below) so the heading level reads consistently throughout.
  fieldLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  // Neutralizes ListRow's own internal padding so its distance to the
  // surrounding divider matches every other block, which relies solely on
  // `content`'s gap for spacing.
  listRowFlush: { paddingVertical: 0, paddingHorizontal: 0 },
  fieldHint: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  phototypeRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  // Same fixed-height, non-square shape as onboarding's PhototypeStep cards
  // (flex:0 + aspectRatio:undefined + explicit height) — just shorter, since
  // six sit in one compact row here instead of a 2-column grid.
  phototypeCard: {
    flex: 1,
    aspectRatio: undefined,
    height: 72,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  switchContent: { flex: 1, gap: 2 },
  // Same block-heading size as fieldLabel — see comment above.
  switchTitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  switchDesc: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    gap: space[3],
    paddingHorizontal: space.gutterScreen,
    paddingVertical: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
    backgroundColor: colors.bgBase,
  },
  footerBtn: { flex: 1 },
});
