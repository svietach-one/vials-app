import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';

import { EmptyState } from '@/components/ui/core/EmptyState';
import { colors, radius, shadow, space } from '@/constants/tokens';

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
      <EmptyState
        icon={<Icon name="layers" size={24} color={colors.textSecondary} />}
        title="Build your routine"
        description="Let Vials arrange your shelf into a morning and evening routine — or start from scratch."
        actions={[
          {
            label: 'Generate Routine',
            onPress: onGenerate,
            icon: <Icon name="zap" size={16} color={colors.controlOn} />,
          },
          {
            label: 'Add Products Manually',
            onPress: onAddManually,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    paddingVertical: space[8],
    paddingHorizontal: space[6],
    ...shadow.sm,
  },
});
