import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadow } from '@/constants/tokens';
import type { SkinPhototype } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhototypeCardProps {
  phototype: SkinPhototype;
  selected: boolean;
  onSelect: () => void;
}

// ─── Shade mapping (visual only — no text labels per US-03) ───────────────────

const SHADE: Record<SkinPhototype, string> = {
  type_1_2: '#F5DEB3', // light warm
  type_3_4: '#C68642', // medium tan
  type_5_6: '#6B3A2A', // deep
};

// US-03: full accessibility label required even though card is visually unlabeled
const A11Y_LABEL: Record<SkinPhototype, string> = {
  type_1_2: 'Light or fair skin tone, burns easily, high UV sensitivity',
  type_3_4: 'Medium or olive skin tone, tans moderately, prone to dark spots',
  type_5_6: 'Dark or deep skin tone, rarely burns, elevated laser and peel risk',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PhototypeCard({ phototype, selected, onSelect }: PhototypeCardProps) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={A11Y_LABEL[phototype]}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      {/* Shade circle — the only visual differentiator between cards */}
      <View style={[styles.swatch, { backgroundColor: SHADE[phototype] }]} />

      {/* Selection ring */}
      {selected ? <View style={styles.selectedRing} /> : null}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDivider,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  cardSelected: {
    borderColor: colors.controlFill,
    borderWidth: 2,
    ...shadow.md,
  },
  cardPressed: {
    opacity: 0.8,
  },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
  },
  selectedRing: {
    position: 'absolute',
    bottom: 10,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.controlFill,
  },
});
