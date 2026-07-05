import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow, typography } from '@/constants/tokens';
import type { FitzpatrickType, SkinPhototype } from '@/types';

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

// ─── Fitzpatrick 1–6 variant (FE-9 / research §2.4) ───────────────────────────

interface FitzpatrickCardProps {
  type: FitzpatrickType;
  selected: boolean;
  onSelect: () => void;
}

/** Skin-tone swatches for the full scale — consumer-friendly, no racial labels. */
const FITZPATRICK_SHADE: Record<FitzpatrickType, string> = {
  1: '#F8E7D1',
  2: '#F5DEB3',
  3: '#E0AC69',
  4: '#C68642',
  5: '#8D5524',
  6: '#6B3A2A',
};

/** Sun-reaction behavior per type (visual card + full a11y description). */
const FITZPATRICK_A11Y: Record<FitzpatrickType, string> = {
  1: 'Type one: very fair skin, always burns, never tans, highest UV sensitivity',
  2: 'Type two: fair skin, burns easily, tans minimally',
  3: 'Type three: light olive skin, sometimes burns, tans gradually',
  4: 'Type four: olive or light brown skin, rarely burns, tans easily, prone to dark spots',
  5: 'Type five: brown skin, very rarely burns, elevated post-inflammatory pigmentation risk',
  6: 'Type six: deep brown skin, almost never burns, highest laser and peel caution',
};

/**
 * One of the six Fitzpatrick onboarding cards. Compact — six render in two
 * rows of three; the roman numeral is the only text (≥14 px), the swatch
 * carries the meaning, and the full description lives on the a11y label.
 */
export function FitzpatrickCard({ type, selected, onSelect }: FitzpatrickCardProps) {
  const NUMERALS: Record<FitzpatrickType, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={FITZPATRICK_A11Y[type]}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.swatchSmall, { backgroundColor: FITZPATRICK_SHADE[type] }]} />
      <Text style={[styles.numeral, selected && styles.numeralSelected]}>{NUMERALS[type]}</Text>
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
  swatchSmall: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
  },
  numeral: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 6,
  },
  numeralSelected: {
    fontFamily: 'DMSans-Medium',
    color: colors.textPrimary,
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
