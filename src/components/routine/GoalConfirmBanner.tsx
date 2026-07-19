import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors, space, typography } from '@/constants/tokens';

/**
 * One-time confirmation for a heuristically derived care goal (V2.1 phase-03
 * §3.1). Dumb presenter: the host renders it only while the profile carries
 * goalNeedsConfirmation, so confirming (or adjusting and saving) makes it
 * disappear for good.
 */
export interface GoalConfirmBannerProps {
  goalLabel: string;
  onConfirm: () => void;
  onAdjust: () => void;
}

export function GoalConfirmBanner({ goalLabel, onConfirm, onAdjust }: GoalConfirmBannerProps) {
  return (
    <InlineAlert
      tone="info"
      icon={<Feather name="target" size={16} color={colors.statusInfo} />}
      title="Confirm your care goal"
    >
      <Text style={styles.body}>
        Based on your skin profile, routines will be built around{' '}
        <Text style={styles.goal}>{goalLabel}</Text>. Does that match what you want to focus on?
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onConfirm}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="Confirm care goal"
        >
          <Text style={styles.actionText}>Confirm</Text>
        </Pressable>
        <Pressable
          onPress={onAdjust}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="Change care goal"
        >
          <Text style={styles.actionText}>Change</Text>
        </Pressable>
      </View>
    </InlineAlert>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  goal: {
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: space[4],
    marginTop: space[2],
  },
  action: {
    paddingVertical: space[1],
  },
  actionText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.statusInfo,
  },
});
