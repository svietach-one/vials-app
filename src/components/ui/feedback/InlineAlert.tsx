import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { colors, palette, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertTone = 'sos' | 'warning' | 'safe' | 'info' | 'neutral';

export interface InlineAlertProps {
  tone?: AlertTone;
  icon?: React.ReactNode;
  title?: string;
  /** Trailing node — e.g. a "Learn more" link. Ignored when `onDismiss` is set. */
  action?: React.ReactNode;
  /** Renders a built-in close-X in the trailing slot and calls this on tap. */
  onDismiss?: () => void;
  /** Accessibility label for the built-in dismiss button. Defaults to "Dismiss". */
  dismissAccessibilityLabel?: string;
  /**
   * Collapsible header: presence of `onToggleCollapse` makes the icon+title
   * row tappable and renders a chevron in the trailing slot instead of
   * `action`. `children` render only while expanded; `summary` (if given)
   * always renders regardless of collapse state — e.g. RehabNoticeCard's
   * "Day X of Y" line.
   */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Accessibility label for the collapse toggle. Defaults to `title`. */
  collapseAccessibilityLabel?: string;
  summary?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ─── Tone maps ────────────────────────────────────────────────────────────────

const toneBackground: Record<AlertTone, string> = {
  sos:     colors.statusSOSTint,
  warning: colors.statusWarningTint,
  safe:    colors.statusSafeTint,
  info:    colors.statusInfoTint,
  neutral: colors.surfaceSunken,
};

const toneBorder: Record<AlertTone, string> = {
  sos:     colors.statusSOSLine,
  warning: colors.statusWarningLine,
  safe:    colors.statusSafeLine,
  info:    colors.statusInfoLine,
  neutral: colors.borderStrong,
};

const toneText: Record<AlertTone, string> = {
  sos:     colors.statusSOS,
  warning: colors.statusWarning,
  safe:    colors.statusSafe,
  info:    colors.statusInfo,
  neutral: colors.textSecondary,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function InlineAlert({
  tone = 'info',
  icon,
  title,
  action,
  onDismiss,
  dismissAccessibilityLabel = 'Dismiss',
  collapsed = false,
  onToggleCollapse,
  collapseAccessibilityLabel,
  summary,
  children,
  style,
}: InlineAlertProps) {
  const bg = toneBackground[tone];
  const border = toneBorder[tone];
  const textColor = toneText[tone];
  const isCollapsible = !!onToggleCollapse;

  const resolvedAction = onDismiss ? (
    <Pressable
      onPress={onDismiss}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={dismissAccessibilityLabel}
    >
      <Icon name="x" size={16} color={textColor} />
    </Pressable>
  ) : isCollapsible ? (
    <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={16} color={textColor} />
  ) : (
    action
  );

  // icon + title + action always share one row, whether or not a title is
  // given, so a close/X (often a larger tap target than the title's
  // line-height) lines up against the icon the same way everywhere. When
  // title is absent, an invisible flex:1 spacer still pushes a trailing
  // action to the end. Body text renders full-width below, never indented
  // to match the icon — the same pattern RehabNoticeCard's header/body
  // split already used, now applied uniformly instead of only when a title
  // happens to be present.
  const headerRowContent = (
    <>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      {title ? (
        <Text style={[styles.title, styles.titleText, { color: textColor }]}>{title}</Text>
      ) : (
        <View style={styles.titleText} />
      )}
      {resolvedAction ? <View style={styles.actionInline}>{resolvedAction}</View> : null}
    </>
  );
  const hasHeaderRow = !!(icon || title || resolvedAction);

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: border }, style]}>
      <View style={styles.body}>
        {hasHeaderRow ? (
          isCollapsible ? (
            <Pressable
              style={styles.titleRow}
              onPress={onToggleCollapse}
              accessibilityRole="button"
              accessibilityState={{ expanded: !collapsed }}
              accessibilityLabel={collapseAccessibilityLabel ?? title}
            >
              {headerRowContent}
            </Pressable>
          ) : (
            <View style={styles.titleRow}>{headerRowContent}</View>
          )
        ) : null}
        {summary != null ? (
          typeof summary === 'string' ? (
            <Text style={[styles.bodyText, { color: textColor }]}>{summary}</Text>
          ) : (
            summary
          )
        ) : null}
        {(!isCollapsible || !collapsed) && children != null ? (
          typeof children === 'string' ? (
            <Text style={[styles.bodyText, { color: textColor }]}>{children}</Text>
          ) : (
            children
          )
        ) : null}
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
  iconWrap: {
    marginTop: 2,
    flexShrink: 0,
  },
  body: {
    gap: space[1],
  },
  titleRow: {
    flexDirection: 'row',
    // flex-start, not center: centering against the row would center the
    // icon on the whole title block once it wraps to 2+ lines. flex-start
    // plus iconWrap/actionInline's marginTop instead pins both to the
    // vertical center of the title's first line specifically, regardless of
    // how many lines it wraps to.
    alignItems: 'flex-start',
    gap: space[2],
  },
  title: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
  },
  titleText: {
    flex: 1,
  },
  actionInline: {
    marginTop: 2,
    flexShrink: 0,
  },
  bodyText: {
    ...typography.bodySmall,
  },
});
