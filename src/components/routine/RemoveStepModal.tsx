import React from 'react';

import { RadioConfirmModal } from '@/components/ui/core/RadioConfirmModal';
import type { RadioOption } from '@/components/ui/forms/RadioOptionGroup';

// ─── Day names ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RemoveStepModalProps {
  visible: boolean;
  productName: string;
  /** 0 = Sunday … 6 = Saturday — the day currently shown in the planner. */
  dow: number;
  onRemoveDay: () => void;
  onRemoveAll: () => void;
  onCancel: () => void;
}

type RemoveScope = 'day' | 'all';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * multi-action-radio-picker (FE-4): converts the old three-stacked-Button
 * layout (Remove from {day}/Remove from all days/Cancel, one tap = select-
 * and-commit) to a `RadioConfirmModal`: a day-scoped/all-days radio pair,
 * default-selected on the narrower, less-destructive "{day}s only" scope
 * (no button was previously primary here — tech design Assumption 3), then
 * a Confirm/Cancel footer. External prop contract unchanged (tech design
 * §1).
 */
export function RemoveStepModal({
  visible,
  productName,
  dow,
  onRemoveDay,
  onRemoveAll,
  onCancel,
}: RemoveStepModalProps) {
  const dayPlural = `${DAY_NAMES[dow]}s`;

  const options: RadioOption<RemoveScope>[] = [
    { value: 'day', label: `${dayPlural} only` },
    { value: 'all', label: 'All days' },
  ];

  const handleConfirm = (scope: RemoveScope) => {
    if (scope === 'day') {
      onRemoveDay();
    } else {
      onRemoveAll();
    }
  };

  return (
    <RadioConfirmModal
      visible={visible}
      title={`Remove ${productName}?`}
      body={`Remove it just from ${dayPlural}, or from every day it's scheduled in this routine.`}
      options={options}
      defaultValue="day"
      onConfirm={handleConfirm}
      onCancel={onCancel}
    />
  );
}
