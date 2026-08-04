import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { OnboardingProgressRing } from '@/components/onboarding/OnboardingProgressRing';
import type { IconName } from '@/components/ui/Icon';
import { colors } from '@/constants/tokens';
import { useProfileStore } from '@/store/profileStore';
import type { UserProfile } from '@/types';
import type { OnboardingStackParamList } from '@/navigation/AppNavigator';
import { AboutYouStep } from './steps/AboutYouStep';
import { AdditionalInfoStep } from './steps/AdditionalInfoStep';
import { CityStep } from './steps/CityStep';
import { GoalsStep } from './steps/GoalsStep';
import { PhototypeStep } from './steps/PhototypeStep';
import { SkinTypeStep } from './steps/SkinTypeStep';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SkinProfileSetup'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;
const STEP_ICONS: Record<number, IconName> = {
  1: 'droplet',
  2: 'target',
  3: 'sun',
  4: 'user',
  5: 'shield-check',
  6: 'map-pin',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * 6-step onboarding profile flow. This container is the sole `useProfileStore`
 * caller — each step is presentational (props/callbacks only) and re-seeds
 * its local state from the current profile whenever it (re)mounts, so
 * Back/Skip never resurrect an abandoned edit. Skip advances without
 * persisting; Next/Finish persists via `updateProfile` first.
 */
export default function SkinProfileSetupScreen({ navigation }: Props) {
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const [step, setStep] = useState(1);

  function advance() {
    if (step === TOTAL_STEPS) {
      navigation.replace('ContributionConsent');
      return;
    }
    setStep((s) => s + 1);
  }

  function handleNext(patch: Partial<UserProfile>) {
    updateProfile(patch);
    advance();
  }

  function handleSkip() {
    advance();
  }

  function handleBack() {
    setStep((s) => s - 1);
  }

  // Rendered inside each step's header row, next to Back — not above the
  // step content — so the two sit on the same line (Back left, ring right).
  const progressRing = (
    <OnboardingProgressRing step={step} totalSteps={TOTAL_STEPS} iconName={STEP_ICONS[step]} />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 1 && (
          <SkinTypeStep
            initialSkinType={profile?.skinType ?? null}
            onNext={handleNext}
            onSkip={handleSkip}
            progressRing={progressRing}
          />
        )}
        {step === 2 && (
          <GoalsStep
            initialPrimaryGoal={profile?.primaryGoal ?? 'maintenance'}
            initialSecondaryGoal={profile?.secondaryGoal ?? null}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
            progressRing={progressRing}
          />
        )}
        {step === 3 && (
          <PhototypeStep
            initialFitzpatrick={profile?.fitzpatrick ?? null}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
            progressRing={progressRing}
          />
        )}
        {step === 4 && (
          <AboutYouStep
            initialAge={profile?.age ?? null}
            initialGender={profile?.gender ?? null}
            initialHormoneTherapy={profile?.hormoneTherapy ?? false}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
            progressRing={progressRing}
          />
        )}
        {step === 5 && (
          <AdditionalInfoStep
            initialPregnantOrBreastfeeding={profile?.pregnantOrBreastfeeding ?? false}
            initialSkinConditions={profile?.skinConditions ?? []}
            initialConcerns={profile?.concerns ?? []}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
            progressRing={progressRing}
          />
        )}
        {step === 6 && (
          <CityStep
            initialCity={profile?.city ?? null}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
            progressRing={progressRing}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  flex: { flex: 1 },
});
