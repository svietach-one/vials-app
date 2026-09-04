import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, type ButtonVariant } from '@/components/ui/core/Button';
import { colors, radius, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  /** Defaults to 'primary' for the first action, 'secondary' for the rest. */
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
}

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  /** 0, 1, or 2 actions — rendered stacked, full width. */
  actions?: EmptyStateAction[];
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shared icon-in-circle empty state — the pattern first shipped as
 * RoutinesScreen's "Build your routine" card. Description and actions are
 * optional so a bare icon + title empty state (e.g. calendar, catalog,
 * clinic) uses the same component as one with CTAs.
 */
export function EmptyState({ icon, title, description, actions, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.iconCircle}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actions && actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action, i) => (
            <Button
              key={action.label}
              variant={action.variant ?? (i === 0 ? 'primary' : 'secondary')}
              size="md"
              fullWidth
              icon={action.icon}
              onPress={action.onPress}
              accessibilityLabel={action.accessibilityLabel ?? action.label}
            >
              {action.label}
            </Button>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: space[3],
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[1],
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: space[2],
    marginTop: space[1],
  },
});
