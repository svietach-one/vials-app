import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ACTIVE_INGREDIENT_LABELS } from '@/constants/labels';
import { colors, space, typography } from '@/constants/tokens';
import type { ActiveIngredientKey } from '@/types';

import { ActiveGroupChip } from './ActiveGroupChip';
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
  const label = ACTIVE_INGREDIENT_LABELS[activeKey];
  return (
    <ActiveGroupChip
      label={label}
      group={group}
      checked={checked}
      accessibilityLabel={label}
      onPress={() => onToggle(activeKey)}
    />
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
            <Text style={styles.groupLabel}>{group.label}</Text>
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
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
});
