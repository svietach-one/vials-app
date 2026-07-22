import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '@/components/ui/core/Button';
import { colors, space, typography } from '@/constants/tokens';
import { useProfileStore } from '@/store/profileStore';
import { setContributionConsent } from '@/utils/contributionConsent';
import type { OnboardingStackParamList } from '@/navigation/AppNavigator';

/**
 * 3rd-of-4 onboarding step (spec Stories 1 & 2), between SkinProfileSetup and
 * FirstProduct. Both actions are equal-weight and non-blocking: "Agree and
 * share" and "Not now" persist a different `granted` value but always land on
 * the identical next screen — declining has zero effect on anything else the
 * app does (GDPR Art. 7(4): consent freely given, never bundled with access
 * to unrelated functionality).
 */
type Props = NativeStackScreenProps<OnboardingStackParamList, 'ContributionConsent'>;

export default function ContributionConsentScreen({ navigation }: Props) {
  const updateProfile = useProfileStore((s) => s.updateProfile);

  function recordChoice(granted: boolean) {
    updateProfile({ contributionConsent: setContributionConsent(granted) });
    navigation.replace('FirstProduct');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Help grow the Vials database</Text>

        <Text style={styles.body}>
          {"When you add a product we don't recognize, you can choose to share it with the Vials community — so the next person who scans it gets instant results too."}
        </Text>
        <Text style={styles.body}>
          {'Sharing includes the product photo and details you enter. No personal data, location, or device info is ever included.'}
        </Text>
        <Text style={styles.body}>
          {"A person reviews every submission before it's added. You can change this anytime in Settings."}
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button variant="primary" size="lg" fullWidth onPress={() => recordChoice(true)}>
          Agree and share
        </Button>
        <Button variant="secondary" size="lg" fullWidth onPress={() => recordChoice(false)}>
          Not now
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSubtle },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[6],
    paddingBottom: space[4],
    gap: space[4],
  },
  title: { ...typography.h1, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  footer: {
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[8],
    gap: space[2],
  },
});
