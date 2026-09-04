import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/core/Button';
import { colors, space, typography } from '@/constants/tokens';

export interface SaveBarProps {
  enabled: boolean;
  onPress: () => void;
  /** Pass '' to suppress when an equivalent note already shows in a section. */
  privacyNote?: string;
  /**
   * Owned vs Wishlist framing (docs/tasks/ux-explore-vials/01-entry-points.md
   * §1) — "Put on My Shelf" for the default Add-new outcome, "Add to
   * Wishlist" when the entry point was Explore new.
   */
  label?: string;
}

const DEFAULT_PRIVACY_NOTE =
  'Only brand, name, category, and ingredients are shared. Dates stay private.';
const DEFAULT_LABEL = 'Put on My Shelf';

/**
 * Bottom save bar — a normal sibling view below the scroll container, not an
 * absolutely-positioned overlay. Deliberately NEVER rendered in a disabled/
 * low-contrast state: it always looks tappable and always fires onPress, even
 * when `enabled` is false — the screen-level handler owns the "not ready yet"
 * response (inline validation + auto-expanding the first incomplete section).
 * This is the single primary-filled action on the Add Product screen.
 */
export function SaveBar({
  enabled,
  onPress,
  privacyNote = DEFAULT_PRIVACY_NOTE,
  label = DEFAULT_LABEL,
}: SaveBarProps) {
  return (
    <View style={styles.bar}>
      {privacyNote ? <Text style={styles.privacyNote}>{privacyNote}</Text> : null}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onPress={onPress}
        accessibilityState={{ disabled: !enabled }}
      >
        {label}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.gutterScreen,
    paddingTop: space[3],
    paddingBottom: space[4],
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
