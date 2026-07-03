import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { PhototypeCard } from '@/components/onboarding/PhototypeCard';
import { Button } from '@/components/ui/core/Button';
import { Input } from '@/components/ui/forms/Input';
import { Switch } from '@/components/ui/forms/Switch';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type {
  SkinConcern,
  SkinPhototype,
  SkinType,
  UserProfile,
} from '@/types';

// ─── Data ─────────────────────────────────────────────────────────────────────

const GENDER_OPTIONS: { value: 'female' | 'male'; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const SKIN_TYPES: { value: SkinType; label: string }[] = [
  { value: 'oily', label: 'Oily' },
  { value: 'dry', label: 'Dry' },
  { value: 'combination', label: 'Combination' },
  { value: 'normal', label: 'Normal' },
];

const CONCERNS: { value: SkinConcern; label: string }[] = [
  { value: 'acne', label: 'Acne' },
  { value: 'dryness', label: 'Dryness' },
  { value: 'wrinkles', label: 'Wrinkles' },
  { value: 'sensitivity', label: 'Sensitivity' },
  { value: 'redness', label: 'Redness' },
  { value: 'hyperpigmentation', label: 'Hyperpigmentation' },
  { value: 'pores', label: 'Pores' },
  { value: 'dark_spots', label: 'Dark spots' },
  { value: 'eczema', label: 'Eczema' },
];

const PHOTOTYPES: SkinPhototype[] = ['type_1_2', 'type_3_4', 'type_5_6'];

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
  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  const [ageText, setAgeText] = useState('');
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [phototype, setPhototype] = useState<SkinPhototype | null>(null);
  const [concerns, setConcerns] = useState<SkinConcern[]>([]);
  const [spfSensitivity, setSpfSensitivity] = useState(false);

  // Pre-fill from current profile on open
  useEffect(() => {
    if (!visible) return;
    setGender(profile?.gender ?? null);
    setAgeText(profile?.age != null ? String(profile.age) : '');
    setSkinType(profile?.skinType ?? null);
    setPhototype(profile?.phototype ?? null);
    setConcerns(profile?.concerns ?? []);
    setSpfSensitivity(profile?.spfSensitivity ?? false);
  }, [visible, profile]);

  function toggleConcern(c: SkinConcern) {
    setConcerns((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function handleSave() {
    const parsedAge = parseInt(ageText, 10);
    onSave({
      gender,
      age: Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : null,
      skinType,
      phototype,
      concerns,
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
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Gender */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.chipRow}>
                {GENDER_OPTIONS.map(({ value, label }) => {
                  const active = gender === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setGender(active ? null : value)}
                      style={[chipStyles.chip, active && chipStyles.chipActive]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                    >
                      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Age */}
            <Input
              label="Age"
              value={ageText}
              onChangeText={setAgeText}
              placeholder="e.g. 28"
              keyboardType="number-pad"
              maxLength={3}
              returnKeyType="done"
            />

            {/* Skin type */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Skin Type</Text>
              <View style={styles.chipRow}>
                {SKIN_TYPES.map(({ value, label }) => {
                  const active = skinType === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setSkinType(active ? null : value)}
                      style={[chipStyles.chip, active && chipStyles.chipActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Phototype */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Skin Tone (Fitzpatrick)</Text>
              <View style={styles.phototypeRow}>
                {PHOTOTYPES.map((pt) => (
                  <PhototypeCard
                    key={pt}
                    phototype={pt}
                    selected={phototype === pt}
                    onSelect={() => setPhototype(phototype === pt ? null : pt)}
                  />
                ))}
              </View>
            </View>

            {/* Concerns */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Skin Concerns</Text>
              <View style={styles.concernWrap}>
                {CONCERNS.map(({ value, label }) => {
                  const active = concerns.includes(value);
                  return (
                    <Pressable
                      key={value}
                      onPress={() => toggleConcern(value)}
                      style={[chipStyles.chip, active && chipStyles.chipActive]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                    >
                      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* SPF sensitivity */}
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
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[5],
    paddingBottom: space[6],
    gap: space[5],
  },
  field: { gap: space[2] },
  // Matches the Input component's default field label
  fieldLabel: {
    ...typography.label,
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  concernWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  phototypeRow: {
    flexDirection: 'row',
    gap: space[3],
    height: 96,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[1],
  },
  switchContent: { flex: 1, gap: 2 },
  switchTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  switchDesc: {
    ...typography.caption,
    color: colors.textSecondary,
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

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: space[2] - 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  chipActive: {
    backgroundColor: palette.black,
    borderColor: palette.black,
  },
  label: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  labelActive: {
    color: palette.white,
  },
});
