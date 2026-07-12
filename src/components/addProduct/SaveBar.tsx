import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/core/Button';
import { colors, space, typography } from '@/constants/tokens';

export interface SaveBarProps {
  enabled: boolean;
  onPress: () => void;
  /** Pass '' to suppress when an equivalent note already shows in a section. */
  privacyNote?: string;
}

const DEFAULT_PRIVACY_NOTE =
  'Only brand, name, category, and ingredients are shared. Dates stay private.';

/**
 * Bottom save bar — a normal sibling view below the scroll container, not an
 * absolutely-positioned overlay. Deliberately NEVER rendered in a disabled/
 * low-contrast state: it always looks tappable and always fires onPress, even
 * when `enabled` is false — the screen-level handler owns the "not ready yet"
 * response (inline validation + auto-expanding the first incomplete section).
 * This is the single primary-filled action on the Add Product screen.
 */
export function SaveBar({ enabled, onPress, privacyNote = DEFAULT_PRIVACY_NOTE }: SaveBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + space[3] }]}>
      {privacyNote ? <Text style={styles.privacyNote}>{privacyNote}</Text> : null}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onPress={onPress}
        accessibilityState={{ disabled: !enabled }}
      >
        Save and put on shelf
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[3],
    gap: space[3],
    backgroundColor: colors.bgBase,
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  privacyNote: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
