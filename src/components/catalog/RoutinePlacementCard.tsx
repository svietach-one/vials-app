import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/core/Card';
import { Icon } from '@/components/ui/Icon';
import { ROUTINE_PHASE_LABELS } from '@/constants/labels';
import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { RoutinePosition } from '@/types';

interface Props {
  position: RoutinePosition;
}

/**
 * Story 8 routine placement (2026-08-26 decision batch, FE-13). Shows only
 * the phase-label position derived from `layeringOrder` — no AM/PM
 * eligibility, rinse-off status, or scheduling detail (spec Story 8, §3
 * Non-Goals). `layeringOrder` is guaranteed non-null whenever this component
 * is reached (the screen only renders it when `category` is set, and
 * `LAYERING_ORDER` is total over `ProductType`), but the lookup still falls
 * back to rendering nothing rather than crashing on an unexpected gap.
 */
export function RoutinePlacementCard({ position }: Props) {
  const label = position.layeringOrder !== null ? ROUTINE_PHASE_LABELS[position.layeringOrder] : undefined;
  if (label === undefined) return null;

  return (
    <View testID="routine-placement">
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconCircle}>
            <Icon name="calendar" size={18} color={palette.plum} />
          </View>
          <Text style={styles.cardTitle}>Routine placement</Text>
        </View>
        <Text style={styles.label}>{label}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[4],
    gap: space[2],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: palette.plumTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.body,
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
  },
  label: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
