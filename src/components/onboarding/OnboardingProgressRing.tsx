import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, palette, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingProgressRingProps {
  step: number;
  totalSteps: number;
  iconName: IconName;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIZE = 64;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Onboarding step indicator: a circular arc (fill = step/totalSteps) with the
 * step's icon centered inside, plus a visible "Step N of M" text sibling —
 * screen-reader/low-vision parity, not conveyed by the ring fill alone.
 */
export function OnboardingProgressRing({ step, totalSteps, iconName }: OnboardingProgressRingProps) {
  const progress = totalSteps > 0 ? step / totalSteps : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={styles.row}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.borderDivider}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={palette.plum}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            fill="none"
            rotation="-90"
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <View style={styles.iconSlot} pointerEvents="none">
          <Icon name={iconName} size={24} color={palette.plum} />
        </View>
      </View>
      <Text style={styles.stepText}>{`Step ${step} of ${totalSteps}`}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  ringWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    position: 'absolute',
  },
  stepText: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
