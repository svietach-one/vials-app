import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';

/**
 * Minimal floating toast — no toast system existed in this codebase yet
 * (SCREENS.md §3's "success toast" was aspirational). Success-only for now
 * per docs/specs/contribution-consent-flow/03-visual-spec.md: reuses the
 * same green (`statusSafe`/bottleGreen) family InlineAlert's 'safe' tone
 * already uses, rather than introducing a new color.
 */

export interface ToastProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onHide: () => void;
  duration?: number;
}

export function Toast({ visible, title, subtitle, onHide, duration = 3200 }: ToastProps) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onHide, duration);
    return () => clearTimeout(t);
  }, [visible, duration, onHide]);

  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <Icon name="check" size={16} color={palette.white} />
        </View>
        <View style={styles.textStack}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space[5],
    right: space[5],
    bottom: space[8],
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    maxWidth: 480,
    width: '100%',
    backgroundColor: colors.statusSafeTint,
    borderWidth: 1,
    borderColor: colors.statusSafeLine,
    borderRadius: radius.lg,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    ...shadow.md,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.statusSafe,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStack: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.body.fontSize,
    color: colors.statusSafe,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
