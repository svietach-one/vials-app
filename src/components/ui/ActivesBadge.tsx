import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { colors, palette, radius } from '@/constants/tokens';

/**
 * The lightning badge shown on routine cards when a product has detected
 * actives. Rendered standalone here (no press handler) so the product page
 * can show a legend for it next to the actives description.
 */
export function ActivesBadge() {
  return (
    <View testID="actives-badge" accessibilityLabel="Has detected actives" style={styles.badge}>
      <Icon name="zap" size={16} color={palette.zinc600} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.pill,
    height: 28,
    minWidth: 28,
    paddingHorizontal: 6,
  },
});
