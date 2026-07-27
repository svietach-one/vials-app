import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { OnboardingProgressRing } from '@/components/onboarding/OnboardingProgressRing';
import type { IconName } from '@/components/ui/Icon';
import { colors, space } from '@/constants/tokens';
import { useProfileStore } from '@/store/profileStore';
import type { UserProfile } from '@/types';
import type { OnboardingStackParamList } from '@/navigation/AppNavigator';
import { AboutYouStep } from './steps/AboutYouStep';
import { AdditionalInfoStep } from './steps/AdditionalInfoStep';
import { GoalsStep } from './steps/GoalsStep';
import { PhototypeStep } from './steps/PhototypeStep';
import { SkinTypeStep } from './steps/SkinTypeStep';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SkinProfileSetup'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;
const STEP_ICONS: Record<number, IconName> = {
  1: 'droplet',
  2: 'target',
  3: 'sun',
  4: 'user',
  5: 'shield-check',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * 5-step onboarding profile flow. This container is the sole `useProfileStore`
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.ringWrap}>
          <OnboardingProgressRing step={step} totalSteps={TOTAL_STEPS} iconName={STEP_ICONS[step]} />
        </View>

        {step === 1 && (
          <SkinTypeStep
            initialSkinType={profile?.skinType ?? null}
            onNext={handleNext}
            onSkip={handleSkip}
          />
        )}
        {step === 2 && (
          <GoalsStep
            initialPrimaryGoal={profile?.primaryGoal ?? 'maintenance'}
            initialSecondaryGoal={profile?.secondaryGoal ?? null}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
          />
        )}
        {step === 3 && (
          <PhototypeStep
            initialFitzpatrick={profile?.fitzpatrick ?? null}
            onNext={handleNext}
            onSkip={handleSkip}
            onBack={handleBack}
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
  ringWrap: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    paddingBottom: space[2],
  },
});
