import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FitzpatrickCard } from '@/components/onboarding/PhototypeCard';
import { GoalSelector } from '@/components/profile/GoalSelector';
import { SkinConcernsSelector } from '@/components/profile/SkinConcernsSelector';
import { FilterChip } from '@/components/ui/core/FilterChip';
import { Button } from '@/components/ui/core/Button';
import { Input } from '@/components/ui/forms/Input';
import { colors, space, typography } from '@/constants/tokens';
import { useProfileStore } from '@/store/profileStore';
import type {
  FitzpatrickType,
  SkinConcern,
  SkinConditionType,
  SkinGoal,
  SkinType,
} from '@/types';
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

const FITZPATRICK_TYPES: FitzpatrickType[] = [1, 2, 3, 4, 5, 6];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SkinProfileSetupScreen({ navigation }: Props) {
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  const [ageText, setAgeText] = useState('');
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [fitzpatrick, setFitzpatrick] = useState<FitzpatrickType | null>(null);
  const [concerns, setConcerns] = useState<SkinConcern[]>([]);
  const [skinConditions, setSkinConditions] = useState<SkinConditionType[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<SkinGoal>('maintenance');
  const [secondaryGoal, setSecondaryGoal] = useState<SkinGoal | null>(null);

  function buildProfilePatch() {
    const age = parseInt(ageText, 10);
    return {
      gender,
      age: Number.isFinite(age) && age > 0 ? age : null,
      skinType,
      fitzpatrick,
      concerns,
      skinConditions,
      primaryGoal,
      secondaryGoal,
      // Chosen (or deliberately left at maintenance) during onboarding —
      // never prompt this user to confirm a derived goal.
      goalNeedsConfirmation: false,
      // Choosing on the 6-card selector IS confirming the skin tone.
      phototypeNeedsConfirmation: false,
    };
  }

  function handleContinue() {
    updateProfile(buildProfilePatch());
    navigation.replace('ContributionConsent');
  }

  function handleSkip() {
    // Save whatever was entered so the user doesn't lose partial data
    updateProfile(buildProfilePatch());
    navigation.replace('ContributionConsent');
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
                <FilterChip
                  key={g}
                  selected={gender === g}
                  onPress={() => setGender(gender === g ? null : g)}
                >
                  {g === 'female' ? 'Female' : 'Male'}
                </FilterChip>
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
                <FilterChip
                  key={t.value}
                  selected={skinType === t.value}
                  onPress={() => setSkinType(t.value)}
                >
                  {t.label}
                </FilterChip>
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

          {/* Skin concerns — merges skin concerns with skin conditions (v1.2,
              US-23) into one deduplicated chip list; shared with the profile
              editor (SkinProfileEditModal) so the two screens can't drift apart. */}
          <Section label="Skin concerns (optional)">
            <SkinConcernsSelector
              concerns={concerns}
              skinConditions={skinConditions}
              onChangeConcerns={setConcerns}
              onChangeConditions={setSkinConditions}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
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
  subtitle: { fontFamily: 'DMSans-Medium', fontSize: 16, lineHeight: 22, color: colors.textPrimary },

  section: { gap: space[2] },
  sectionLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  sectionHint: { ...typography.bodySmall, color: colors.textPrimary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },

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
