import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ACTIVE_INGREDIENT_LABELS } from '@/constants/labels';
import { colors, radius, space, typography } from '@/constants/tokens';
import type { ActiveIngredientKey } from '@/types';

import { ACTIVES_GROUPS } from './activesGroups';
import type { ActivesGroup } from './activesGroups';

export interface ActivesChecklistProps {
  selectedKeys: ActiveIngredientKey[];
  onToggle: (key: ActiveIngredientKey) => void;
}

interface ChecklistChipProps {
  group: ActivesGroup;
  activeKey: ActiveIngredientKey;
  checked: boolean;
  onToggle: (key: ActiveIngredientKey) => void;
}

function ChecklistChip({ group, activeKey, checked, onToggle }: ChecklistChipProps) {
  return (
    <Pressable
      onPress={() => onToggle(activeKey)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={ACTIVE_INGREDIENT_LABELS[activeKey]}
      style={({ pressed }) => [
        styles.chip,
        checked
          ? { backgroundColor: group.tint, borderColor: group.line }
          : styles.chipUnchecked,
        pressed && styles.chipPressed,
      ]}
    >
      {checked ? <Feather name="check" size={12} color={group.color} /> : null}
      <Text style={[styles.chipLabel, { color: checked ? group.color : colors.textSecondary }]}>
        {ACTIVE_INGREDIENT_LABELS[activeKey]}
      </Text>
    </Pressable>
  );
}

/** Manual actives checklist, grouped by conflict-engine tag family. */
export function ActivesChecklist({ selectedKeys, onToggle }: ActivesChecklistProps) {
  return (
    <View style={styles.wrap}>
      {ACTIVES_GROUPS.map((group) => (
        <View key={group.label} style={styles.group}>
          <View style={styles.groupHeader}>
            <View style={[styles.dot, { backgroundColor: group.color }]} />
            <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
          </View>
          <View style={styles.chips}>
            {group.keys.map((key) => (
              <ChecklistChip
                key={key}
                group={group}
                activeKey={key}
                checked={selectedKeys.includes(key)}
                onToggle={onToggle}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space[4],
  },
  group: {
    gap: space[2],
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groupLabel: {
    ...typography.caption,
    fontFamily: 'DMSans-Medium',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space[3],
    height: space[8],
  },
  chipUnchecked: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipLabel: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    includeFontPadding: false,
  },
});
