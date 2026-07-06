import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/ui/core/Button';
import { colors, radius, shadow, space, typography } from '@/constants/tokens';

export interface GenerateCardProps {
  onGenerate: () => void;
  onAddManually: () => void;
}

/**
 * Empty-state entry point A (research §3): a central card offering the
 * engine draft as the primary action and the manual flow as the fallback.
 * Final copy per product owner 2026-07-04 — no "AI Engine" wording.
 */
export function GenerateCard({ onGenerate, onAddManually }: GenerateCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Feather name="layers" size={24} color={colors.textSecondary} />
      </View>
      <Text style={styles.title}>Build your routine</Text>
      <Text style={styles.subtitle}>
        Let Vials arrange your shelf into a morning and evening routine — or
        start from scratch.
      </Text>
      <View style={styles.actions}>
        <Button
          variant="primary"
          size="md"
          fullWidth
          onPress={onGenerate}
          accessibilityLabel="Generate Routine"
        >
          ✨ Generate Routine
        </Button>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          onPress={onAddManually}
          accessibilityLabel="Add Products Manually"
        >
          Add Products Manually
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    paddingVertical: space[8],
    paddingHorizontal: space[6],
    alignItems: 'center',
    gap: space[3],
    ...shadow.sm,
  },
  iconWrap: {
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
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: space[2],
  },
  actions: {
    alignSelf: 'stretch',
    gap: space[2],
  },
});
