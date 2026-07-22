import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/ui/core/Button';
import { InlineAlert } from '@/components/ui/feedback/InlineAlert';
import { colors, space, typography } from '@/constants/tokens';

/**
 * One-time confirmation for an auto-derived Fitzpatrick skin tone (V2.1
 * phase-08 §8.1). The migration conservatively derived a numeric type from the
 * old grouped phototype; this asks the user to confirm or refine it once.
 * Dumb presenter: the host renders it only while phototypeNeedsConfirmation is
 * set, so confirming (or adjusting and saving) makes it disappear for good.
 */
export interface PhototypeConfirmBannerProps {
  /** The migrated Fitzpatrick number to confirm (1–6). */
  fitzpatrick: number | null;
  onConfirm: () => void;
  onAdjust: () => void;
}

export function PhototypeConfirmBanner({
  fitzpatrick,
  onConfirm,
  onAdjust,
}: PhototypeConfirmBannerProps) {
  return (
    <InlineAlert
      tone="info"
      icon={<Feather name="sun" size={16} color={colors.statusInfo} />}
      title="Confirm your skin tone"
    >
      <Text style={styles.body}>
        We set your skin tone to{' '}
        <Text style={styles.value}>Fitzpatrick {fitzpatrick ?? '—'}</Text> from your earlier
        answers. It guides sun-sensitivity and pigmentation safety — does it look right?
      </Text>
      <View style={styles.actions}>
        <Button variant="textActive" size="sm" onPress={onConfirm} accessibilityLabel="Confirm skin tone">
          Confirm
        </Button>
        <Button variant="textActive" size="sm" onPress={onAdjust} accessibilityLabel="Change skin tone">
          Change
        </Button>
      </View>
    </InlineAlert>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  value: {
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: space[4],
    marginTop: space[2],
  },
});
