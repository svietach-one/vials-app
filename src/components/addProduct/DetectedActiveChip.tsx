import React from 'react';

import { ACTIVE_INGREDIENT_LABELS } from '@/constants/labels';
import type { ActiveIngredientKey } from '@/types';

import { ActiveGroupChip } from './ActiveGroupChip';
import { getGroupForKey } from './activesGroups';

export interface DetectedActiveChipProps {
  activeKey: ActiveIngredientKey;
  onRemove: (key: ActiveIngredientKey) => void;
}

/** OCR-detected active: colored chip with an × to remove a wrong detection. */
export function DetectedActiveChip({ activeKey, onRemove }: DetectedActiveChipProps) {
  const group = getGroupForKey(activeKey);
  const label = ACTIVE_INGREDIENT_LABELS[activeKey];

  return (
    <ActiveGroupChip
      label={label}
      group={group}
      checked
      accessibilityLabel={label}
      onRemove={() => onRemove(activeKey)}
    />
  );
}
