import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { WeeklySchedulePicker } from '@/components/routine/WeeklySchedulePicker';
import { colors, palette, radius, shadow, space, typography } from '@/constants/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlannerBlockProps {
  activePeriod: 'morning' | 'evening';
  onPeriodChange: (p: 'morning' | 'evening') => void;
  /** Scheduled days for the active routine (empty = every day). */
  scheduledDays: number[];
  /** Count of visible steps for today in the active period. */
  stepCount: number;
  onEditPress: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlannerBlock({
  activePeriod,
  onPeriodChange,
  scheduledDays,
  stepCount,
  onEditPress,
}: PlannerBlockProps) {
  return (
    // Outer wrapper carries the shadow; inner card clips children to border-radius.
    // Splitting the two prevents iOS from clipping the shadow via overflow:hidden.
    <View style={styles.shadowWrap}>
      <View style={styles.card}>
        {/* Period toggle */}
        <View style={styles.periodRow}>
          <PeriodChip
            icon="sun"
            label="Morning"
            active={activePeriod === 'morning'}
            onPress={() => onPeriodChange('morning')}
          />
          <View style={styles.periodSeparator} />
          <PeriodChip
            icon="moon"
            label="Evening"
            active={activePeriod === 'evening'}
            onPress={() => onPeriodChange('evening')}
          />
        </View>

        {/* Weekly day chips (read-only, cabernet accent) */}
        <View style={styles.dayRow}>
          <WeeklySchedulePicker
            scheduledDays={scheduledDays}
            readOnly
            accentColor={palette.cabernet}
          />
        </View>

        {/* Footer: step count + edit link */}
        <View style={styles.footer}>
          <Text style={styles.stepCount}>
            {stepCount > 0 ? `${stepCount} steps today` : 'No steps today'}
          </Text>
          <Pressable
            onPress={onEditPress}
            style={styles.editBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit routine order"
            hitSlop={8}
          >
            <Text style={styles.editLabel}>Edit order</Text>
            <Feather name="arrow-right" size={13} color={palette.cabernet} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Period chip ──────────────────────────────────────────────────────────────

function PeriodChip({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        chipStyles.chip,
        active ? chipStyles.chipActive : pressed && chipStyles.chipPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Feather
        name={icon}
        size={14}
        color={active ? palette.white : colors.textSecondary}
      />
      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDivider,
    overflow: 'hidden',
  },

  periodRow: {
    flexDirection: 'row',
    height: 44,
  },
  periodSeparator: {
    width: 1,
    backgroundColor: colors.borderDivider,
  },

  dayRow: {
    paddingHorizontal: space[4],
    paddingTop: space[1],
    paddingBottom: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.borderDivider,
  },
  stepCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editLabel: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: palette.cabernet,
  },
});

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    backgroundColor: colors.surfaceSunken,
  },
  chipActive: {
    backgroundColor: palette.cabernet,
  },
  chipPressed: {
    backgroundColor: colors.surfaceCard,
  },
  label: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
  },
  labelActive: {
    color: palette.white,
  },
});
