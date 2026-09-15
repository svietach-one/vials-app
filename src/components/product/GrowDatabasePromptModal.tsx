import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { colors, space, typography } from '@/constants/tokens';

/**
 * "Help grow the Vials database" prompt (docs/tech-design/
 * onboarding-simplification.md FE-3, spec Story 3 / §5). Relocated from the
 * former onboarding-only `ContributionConsentScreen` into a full-screen
 * modal shown right after a qualifying manual save completes, wherever that
 * happens (onboarding's FirstProduct flow or later from "My Shelf") — see
 * `shouldShowGrowDatabasePrompt` (src/utils/contributionConsent.ts) for the
 * gating rule. Copy is identical to the former screen.
 */
export interface GrowDatabasePromptModalProps {
  visible: boolean;
  onAgree: () => void;
  onNotNow: () => void;
}

export function GrowDatabasePromptModal({
  visible,
  onAgree,
  onNotNow,
}: GrowDatabasePromptModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onNotNow}>
      <View style={styles.safe}>
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
          <Button variant="primary" size="lg" fullWidth onPress={onAgree}>
            Agree and share
          </Button>
          <Button variant="secondary" size="lg" fullWidth onPress={onNotNow}>
            Not now
          </Button>
        </View>
      </View>
    </Modal>
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
