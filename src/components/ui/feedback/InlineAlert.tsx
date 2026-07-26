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

export type AlertTone = 'sos' | 'warning' | 'safe' | 'info';

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

  const titleRowContent = (
    <>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={[styles.title, styles.titleText, { color: textColor }]}>{title}</Text>
      {resolvedAction ? <View style={styles.actionInline}>{resolvedAction}</View> : null}
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: border }, style]}>
      {/* Main row: icon + content + action */}
      <View style={styles.row}>
        {/* With a title, icon + title + action all share one centered row
            so a close/X control (often a larger tap-target box than the
            title's line-height) lines up against both the title text and
            the icon, instead of centering itself against the whole card.
            Body text then renders full-width below, unindented — the same
            pattern RehabNoticeCard's header/body split already uses. With
            no title, the icon keeps its original position beside the body
            column, unchanged for those callers. */}
        {!title && icon ? <View style={styles.iconWrap}>{icon}</View> : null}

        <View style={styles.body}>
          {title ? (
            isCollapsible ? (
              <Pressable
                style={styles.titleRow}
                onPress={onToggleCollapse}
                accessibilityRole="button"
                accessibilityState={{ expanded: !collapsed }}
                accessibilityLabel={collapseAccessibilityLabel ?? title}
              >
                {titleRowContent}
              </Pressable>
            ) : (
              <View style={styles.titleRow}>{titleRowContent}</View>
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

        {!title && resolvedAction ? <View style={styles.actionWrap}>{resolvedAction}</View> : null}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexShrink: 0,
  },
  bodyText: {
    ...typography.bodySmall,
  },
  actionWrap: {
    flexShrink: 0,
    marginLeft: space[2],
  },
});
