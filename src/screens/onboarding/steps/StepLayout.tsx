import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { IconButton } from '@/components/ui/core/IconButton';
import { Icon } from '@/components/ui/Icon';
import { colors, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepLayoutProps {
  title: string;
  subtitle: string;
  /** Omit on the first step — there is nothing to go back to. */
  onBack?: () => void;
  onSkip: () => void;
  onNext: () => void;
  /** "Finish" on the last step, "Next" everywhere else. */
  nextLabel?: string;
  nextDisabled?: boolean;
  children: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shared body/footer chrome for the 5 onboarding steps. The progress ring and
 * SafeAreaView/KeyboardAvoidingView wrapping live in the container
 * (SkinProfileSetupScreen) — this only renders what differs per step.
 */
export function StepLayout({
  title,
  subtitle,
  onBack,
  onSkip,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  children,
}: StepLayoutProps) {
  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {onBack ? (
          <IconButton
            icon={<Icon name="arrow-left" size={20} />}
            label="Back"
            variant="ghost"
            onPress={onBack}
            style={styles.backBtn}
          />
        ) : null}

        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {children}
      </ScrollView>

      <View style={styles.footer}>
        <Button variant="ghost" size="lg" style={styles.footerButton} onPress={onSkip}>
          Skip
        </Button>
        <Button
          variant="primary"
          size="lg"
          style={styles.footerButton}
          disabled={nextDisabled}
          onPress={onNext}
        >
          {nextLabel}
        </Button>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[4],
    paddingBottom: space[4],
    gap: space[6],
  },
  backBtn: {
    alignSelf: 'flex-start',
  },
  header: { gap: space[2] },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.body, color: colors.textSecondary },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: space.gutterScreen,
    paddingBottom: space[8],
    gap: space[2],
  },
  footerButton: {
    flex: 1,
  },
});
