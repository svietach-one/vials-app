import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FitzpatrickCard } from '@/components/onboarding/PhototypeCard';
import { GoalSelector } from '@/components/profile/GoalSelector';
import { Button } from '@/components/ui/core/Button';
import { Input } from '@/components/ui/forms/Input';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import { useProfileStore } from '@/store/profileStore';
import type { FitzpatrickType, SkinConcern, SkinGoal, SkinType } from '@/types';
import type { OnboardingStackParamList } from '@/navigation/AppNavigator';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SkinProfileSetup'>;

// ─── Data ─────────────────────────────────────────────────────────────────────

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
];

const FITZPATRICK_TYPES: FitzpatrickType[] = [1, 2, 3, 4, 5, 6];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SkinProfileSetupScreen({ navigation }: Props) {
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  const [ageText, setAgeText] = useState('');
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [fitzpatrick, setFitzpatrick] = useState<FitzpatrickType | null>(null);
  const [concerns, setConcerns] = useState<SkinConcern[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<SkinGoal>('maintenance');
  const [secondaryGoal, setSecondaryGoal] = useState<SkinGoal | null>(null);

  function toggleConcern(c: SkinConcern) {
    setConcerns((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function buildProfilePatch() {
    const age = parseInt(ageText, 10);
    return {
      gender,
      age: Number.isFinite(age) && age > 0 ? age : null,
      skinType,
      fitzpatrick,
      concerns,
      primaryGoal,
      secondaryGoal,
      // Chosen (or deliberately left at maintenance) during onboarding —
      // never prompt this user to confirm a derived goal.
      goalNeedsConfirmation: false,
    };
  }

  function handleContinue() {
    updateProfile(buildProfilePatch());
    navigation.replace('FirstProduct');
  }

  function handleSkip() {
    // Save whatever was entered so the user doesn't lose partial data
    updateProfile(buildProfilePatch());
    navigation.replace('FirstProduct');
  }

  const canContinue = skinType !== null && fitzpatrick !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Step 1 of 2</Text>
            <Text style={styles.title}>Tell us about{'\n'}your skin.</Text>
            <Text style={styles.subtitle}>
              This helps Vials catch conflicts and suggest the right products.
            </Text>
          </View>

          {/* Gender */}
          <Section label="Gender (optional)">
            <View style={styles.chipRow}>
              {(['female', 'male'] as const).map((g) => (
                <SelectChip
                  key={g}
                  label={g === 'female' ? 'Female' : 'Male'}
                  selected={gender === g}
                  onPress={() => setGender(gender === g ? null : g)}
                />
              ))}
            </View>
          </Section>

          {/* Age — uses DS Input for consistent styling and future DS updates */}
          <Section label="Age (optional)">
            <Input
              value={ageText}
              onChangeText={setAgeText}
              placeholder="e.g. 28"
              keyboardType="number-pad"
              maxLength={3}
              returnKeyType="done"
            />
          </Section>

          {/* Skin type */}
          <Section label="Skin type">
            <View style={styles.chipRow}>
              {SKIN_TYPES.map((t) => (
                <SelectChip
                  key={t.value}
                  label={t.label}
                  selected={skinType === t.value}
                  onPress={() => setSkinType(t.value)}
                />
              ))}
            </View>
          </Section>

          {/* Concerns */}
          <Section label="Skin concerns (optional)">
            <View style={styles.chipWrap}>
              {CONCERNS.map((c) => (
                <SelectChip
                  key={c.value}
                  label={c.label}
                  selected={concerns.includes(c.value)}
                  onPress={() => toggleConcern(c.value)}
                />
              ))}
            </View>
          </Section>

          {/* Care goals (V2.1 Step 0) */}
          <Section
            label="Care goals (optional)"
            hint="Pick up to two. Routines are built around your primary goal; leave empty for maintenance care."
          >
            <GoalSelector
              primaryGoal={primaryGoal}
              secondaryGoal={secondaryGoal}
              onChange={(primary, secondary) => {
                setPrimaryGoal(primary);
                setSecondaryGoal(secondary);
              }}
            />
          </Section>

          {/* Phototype — visually unlabeled cards (US-03) */}
          <Section
            label="UV sensitivity"
            hint="Select the option that best describes how your skin reacts to sun."
          >
            <View style={styles.phototypeRow} accessibilityRole="radiogroup">
              {FITZPATRICK_TYPES.map((p) => (
                <FitzpatrickCard
                  key={p}
                  type={p}
                  selected={fitzpatrick === p}
                  onSelect={() => setFitzpatrick(p)}
                />
              ))}
            </View>
          </Section>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canContinue}
            onPress={handleContinue}
          >
            Continue
          </Button>
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            onPress={handleSkip}
          >
            Skip for now
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function SelectChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    paddingBottom: space[4],
    gap: space[6],
  },

  header: { gap: space[2] },
  eyebrow: { ...typography.label, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },

  section: { gap: space[2] },
  // Matches the Input component's default field label
  sectionLabel: {
    ...typography.label,
    color: colors.textPrimary,
  },
  sectionHint: { ...typography.bodySmall, color: colors.textTertiary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },

  chip: {
    height: 36,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.controlFill,
    borderColor: colors.controlFill,
  },
  chipLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  chipLabelSelected: {
    color: palette.white,
  },

  phototypeRow: {
    flexDirection: 'row',
    gap: space[3],
    marginTop: space[1],
  },

  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[8],
    gap: space[2],
  },
});
