import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Switch } from '@/components/ui/forms/Switch';
import { colors, palette, space, typography } from '@/constants/tokens';

/**
 * Compact inline toggle rendered inside ManualProductFormScreen on every
 * manual save that doesn't trigger ContributionConsentModal (status
 * 'declined' or 'accepted' — never shown while 'disabled').
 * See docs/specs/contribution-consent-flow/01-copy-and-consent-states.md §4.3.
 */

export interface ContributionToggleProps {
  checked: boolean;
  onValueChange: (checked: boolean) => void;
}

export function ContributionToggle({ checked, onValueChange }: ContributionToggleProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Share with Vials</Text>
      <Switch
        checked={checked}
        onValueChange={onValueChange}
        activeColor={palette.plum}
        size="sm"
        accessibilityLabel="Share with Vials"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.label,
    color: colors.textPrimary,
  },
});
