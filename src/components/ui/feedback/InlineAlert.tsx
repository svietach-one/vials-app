import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, palette, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertTone = 'sos' | 'warning' | 'safe' | 'info';

export interface InlineAlertProps {
  tone?: AlertTone;
  icon?: React.ReactNode;
  title?: string;
  /** Trailing node — e.g. a dismiss Pressable. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ─── Tone maps ────────────────────────────────────────────────────────────────

const toneBackground: Record<AlertTone, string> = {
  sos:     colors.statusSOSTint,
  warning: colors.statusWarningTint,
  safe:    colors.statusSafeTint,
  info:    colors.statusInfoTint,
};

const toneBorder: Record<AlertTone, string> = {
  sos:     colors.statusSOSLine,
  warning: colors.statusWarningLine,
  safe:    colors.statusSafeLine,
  info:    colors.statusInfoLine,
};

const toneText: Record<AlertTone, string> = {
  sos:     colors.statusSOS,
  warning: colors.statusWarning,
  safe:    colors.statusSafe,
  info:    colors.statusInfo,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function InlineAlert({
  tone = 'info',
  icon,
  title,
  action,
  children,
  style,
}: InlineAlertProps) {
  const bg = toneBackground[tone];
  const border = toneBorder[tone];
  const textColor = toneText[tone];

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: border }, style]}>
      {/* Main row: icon + content + action */}
      <View style={styles.row}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}

        <View style={styles.body}>
          {title ? (
            <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          ) : null}
          {children != null ? (
            typeof children === 'string' ? (
              <Text style={[styles.bodyText, { color: textColor }]}>{children}</Text>
            ) : (
              children
            )
          ) : null}
        </View>

        {action ? <View style={styles.actionWrap}>{action}</View> : null}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  iconWrap: {
    marginTop: 2,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: space[1],
  },
  title: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
  },
  bodyText: {
    ...typography.bodySmall,
  },
  actionWrap: {
    flexShrink: 0,
    marginLeft: space[2],
  },
});
