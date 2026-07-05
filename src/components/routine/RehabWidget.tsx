import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, palette, radius, space, typography } from '@/constants/tokens';
import type { RehabWidgetState } from '@/types';

export interface RehabWidgetProps {
  /** Render-time derivation from procedure logs; null hides the widget. */
  state: RehabWidgetState | null;
}

const BARRIER_COPY: Record<RehabWidgetState['barrierStatus'], string> = {
  disrupted: 'Skin barrier disrupted — aggressive actives are paused below.',
  sensitive: 'Skin barrier still sensitive — actives return when recovery ends.',
};

/**
 * Top-anchored rehabilitation shield on the Routines screen (research §1.5
 * V3, Rule A): while any procedure has remaining rehab days covering the
 * face, masking is never silent — this widget explains the lock. Pure render
 * of RehabWidgetState; it self-destructs on day Y+1 with zero mutations.
 * Long-term effects (Botox month 2) never render here — Clinic timeline only.
 */
export function RehabWidget({ state }: RehabWidgetProps) {
  if (!state) return null;

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.headerRow}>
        <Feather name="shield" size={14} color={palette.cabernet} />
        <Text style={styles.headerText}>
          🩹 Rehabilitation: {state.procedureName}
        </Text>
      </View>
      <Text style={styles.dayText}>
        Day {state.currentDay} of {state.totalDays}
      </Text>
      <Text style={styles.bodyText}>{BARRIER_COPY[state.barrierStatus]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.statusSOSTint,
    borderWidth: 1,
    borderColor: colors.statusSOSLine,
    borderRadius: radius.md,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    gap: space[1],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  headerText: {
    ...typography.label,
    color: palette.cabernet,
    flexShrink: 1,
  },
  dayText: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.cabernet,
  },
  bodyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
