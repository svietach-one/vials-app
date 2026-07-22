import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { IconButton } from '@/components/ui/core/IconButton';
import { ACTIVE_INGREDIENT_LABELS } from '@/constants/labels';
import { space, typography, radius } from '@/constants/tokens';
import type { ActiveIngredientKey } from '@/types';

import { getGroupForKey } from './activesGroups';

export interface DetectedActiveChipProps {
  activeKey: ActiveIngredientKey;
  onRemove: (key: ActiveIngredientKey) => void;
}

/** OCR-detected active: colored chip with an × to remove a wrong detection. */
export function DetectedActiveChip({ activeKey, onRemove }: DetectedActiveChipProps) {
  const group = getGroupForKey(activeKey);

  return (
    <View style={[styles.chip, { backgroundColor: group.tint, borderColor: group.line }]}>
      <Text style={[styles.label, { color: group.color }]}>
        {ACTIVE_INGREDIENT_LABELS[activeKey]}
      </Text>
      <IconButton
        icon={<Feather name="x" size={14} color={group.color} />}
        label={`Remove ${ACTIVE_INGREDIENT_LABELS[activeKey]}`}
        variant="ghost"
        size="xs"
        onPress={() => onRemove(activeKey)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space[3],
    height: space[8],
  },
  label: {
    ...typography.bodySmall,
    fontFamily: 'DMSans-Medium',
    includeFontPadding: false,
  },
});
